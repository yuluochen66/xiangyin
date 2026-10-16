<script setup lang="ts">
/**
 * 流程 1：上传已授权采访录音。
 *
 * 交互覆盖：
 * - 文件选择（点击 + 拖拽）与前置校验（格式白名单 / 大小上限 / 时长下限）；
 * - 授权状态确认弹窗（必须逐条确认授权范围）；
 * - 分片上传进度（百分比 + 剩余时间）与断点重传；
 * - 同名 / 重复文件处理提示；
 * - 7 种界面状态（含「上传会话不存在」这类不可用分支）。
 *
 * 涉及的接口衔接点见报头「开发者」开关内的接口面板，或 src/api/upload.ts。
 */
import { computed, reactive, ref, watch } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

import { uploadApi } from '@/api'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import FlowHeader from '@/components/common/FlowHeader.vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { TaskPhase } from '@/composables/useAsyncTask'
import { CURRENT_OPERATOR, UPLOAD_CONSTRAINTS } from '@/mock/dataset'
import { ApiError, isApiError } from '@/services/api/errors'
import type {
  AudioFormat,
  InterviewListResponse,
  LicenseConfirmResponse,
  LicenseStatus,
  LicenseType,
  UploadCompleteResponse,
  UploadInitResponse,
  UploadStatusResponse,
} from '@/types/api'
import { formatBytes, formatDateTime, formatDurationText } from '@/utils/format'

const { notify } = useAppShell()

/* ------------------------------------------------------------------ */
/* 表单                                                               */
/* ------------------------------------------------------------------ */

interface FormState {
  title: string
  narrator: string
  interviewer: string
  recordedAt: string
  recordedPlace: string
  dialect: string
  licenseType: LicenseType
}

const form = reactive<FormState>({
  title: '林水妹：塔巷里的漆器铺与坊巷生活',
  narrator: '林水妹',
  interviewer: CURRENT_OPERATOR.name,
  recordedAt: '2024-03-12',
  recordedPlace: '三坊七巷·塔巷 12 号',
  dialect: '闽东语·福州话',
  licenseType: 'public',
})

const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  public: '公开授权（可对外发布）',
  research_only: '仅研究使用（不得公开发布）',
  internal: '仅项目内部使用',
  limited_time: '限时授权（到期需重新确认）',
}

/* ------------------------------------------------------------------ */
/* 文件选择与校验                                                      */
/* ------------------------------------------------------------------ */

const fileInputEl = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const probedDurationMs = ref<number | null>(null)
const validationError = ref<string | null>(null)
const isDragging = ref(false)

const allowedFormatsText = UPLOAD_CONSTRAINTS.allowedFormats.join(' / ').toUpperCase()
const maxSizeText = formatBytes(UPLOAD_CONSTRAINTS.maxSizeBytes)

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : ''
}

/**
 * 前置校验：格式、大小、时长。返回错误文案，通过则返回 null。
 * @param file 用户选择的文件
 * @returns 校验结果：是否通过与提示文案
 */
function validateFile(file: File): string | null {
  const extension = extensionOf(file.name)
  if (!UPLOAD_CONSTRAINTS.allowedFormats.includes(extension as AudioFormat)) {
    return `格式不支持：${extension || '未知扩展名'}。允许的格式为 ${allowedFormatsText}。`
  }
  if (file.size <= 0) return '文件为空，请确认录音是否导出成功。'
  if (file.size > UPLOAD_CONSTRAINTS.maxSizeBytes) {
    return `文件过大：${formatBytes(file.size)}，单文件上限为 ${maxSizeText}。`
  }
  return null
}

/**
 * 读取音频时长（浏览器不支持时返回 null，不阻断上传）。
 * @param file 用户选择的文件
 * @returns 读取到的音频时长（毫秒）
 */
function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url)
      resolve(null)
    }, 3000)

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timer)
      const ms = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null
      URL.revokeObjectURL(url)
      resolve(ms)
    })
    audio.addEventListener('error', () => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(null)
    })
    audio.src = url
  })
}

async function acceptFile(file: File): Promise<void> {
  const error = validateFile(file)
  validationError.value = error
  if (error) {
    selectedFile.value = null
    notify('error', '文件校验未通过', error)
    return
  }

  selectedFile.value = file
  probedDurationMs.value = await probeDuration(file)
  if (!form.title.trim()) form.title = file.name.replace(/\.[^.]+$/, '')

  if (
    probedDurationMs.value !== null &&
    probedDurationMs.value < UPLOAD_CONSTRAINTS.minDurationMs
  ) {
    validationError.value = `录音过短（${formatDurationText(probedDurationMs.value)}），有效录音应不短于 ${formatDurationText(UPLOAD_CONSTRAINTS.minDurationMs)}。`
    notify('warning', '录音过短', validationError.value)
  }
}

function handleInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void acceptFile(file)
  input.value = ''
}

function handleDrop(event: DragEvent): void {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void acceptFile(file)
}

function clearFile(): void {
  selectedFile.value = null
  probedDurationMs.value = null
  validationError.value = null
}

/* ------------------------------------------------------------------ */
/* 上传会话（分片上传由本组件驱动，非 AI 任务）                          */
/* ------------------------------------------------------------------ */

type SessionPhase = 'idle' | 'uploading' | 'merging' | 'done' | 'failed'

interface UploadSession {
  phase: SessionPhase
  uploadId: string
  interviewId: string
  doneChunks: number
  totalChunks: number
  progress: number
  uploadedBytes: number
  remainingMs: number | null
  error: ApiError | null
  result: UploadCompleteResponse | null
}

const session = reactive<UploadSession>({
  phase: 'idle',
  uploadId: '',
  interviewId: '',
  doneChunks: 0,
  totalChunks: 0,
  progress: 0,
  uploadedBytes: 0,
  remainingMs: null,
  error: null,
  result: null,
})

/** 缓存初始化结果，供断点重传复用。 */
const lastInit = ref<UploadInitResponse | null>(null)
/** 「覆盖已有记录」意图；覆盖语义待后端确认（TODO-UP-3）。 */
const overwriteIntent = ref(false)
const duplicateModalOpen = ref(false)

function buildInitRequest() {
  const file = selectedFile.value
  if (!file) throw new ApiError({ code: 'validation', message: '请先选择音频文件。' })

  const request: Parameters<typeof uploadApi.init>[0] = {
    title: form.title.trim(),
    narrator: form.narrator.trim(),
    interviewer: form.interviewer.trim(),
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type || 'audio/mpeg',
    recordedAt: form.recordedAt,
    recordedPlace: form.recordedPlace.trim(),
    licenseType: form.licenseType,
  }
  if (probedDurationMs.value !== null) request.durationMs = probedDurationMs.value
  if (form.dialect.trim()) request.dialect = form.dialect.trim()
  return request
}

/* ------------------------------------------------------------------ */
/* 任务：初始化上传 / 采访列表 / 授权确认                                */
/* ------------------------------------------------------------------ */

const {
  state: initState,
  isBusy: initBusy,
  isRetrying: initRetrying,
  isError: initError,
  needsConfirm: initNeedsConfirm,
  isUnavailable: initUnavailable,
  canRetry: initCanRetry,
  run: runInit,
  retry: retryInit,
  respondConfirm: respondInitConfirm,
  reset: resetInit,
} = useAsyncTask<UploadInitResponse, []>(() => uploadApi.init(buildInitRequest()), {
  // 「需人工确认」：命中重复文件时必须由用户决定如何处理
  needsConfirm: (data) =>
    data.duplicate
      ? {
          title: '检测到同名 / 重复录音',
          message: `已有采访记录「${data.duplicate.title}」与本次上传高度相似（相似度 ${(data.duplicate.similarity * 100).toFixed(0)}%）。`,
          details: [
            `已有记录：${data.duplicate.interviewId}`,
            `上传人：${data.duplicate.uploadedBy.name} · ${formatDateTime(data.duplicate.uploadedAt)}`,
            `后端建议：${data.duplicate.suggestion === 'skip' ? '跳过本次上传' : data.duplicate.suggestion === 'overwrite' ? '覆盖已有记录' : '仍然新建'}`,
          ],
          confirmText: '仍然新建',
          cancelText: '取消上传',
        }
      : null,
})

const {
  state: listState,
  isBusy: listBusy,
  canRetry: listCanRetry,
  run: runList,
  retry: retryList,
} = useAsyncTask<InterviewListResponse, []>(() => uploadApi.listInterviews(), {
  emptyHint: {
    reason: '当前还没有任何采访记录。',
    suggestion: '选择一段已获得授权的录音并完成上传，即可创建第一条记录。',
  },
})

const licenseDecision = ref<'confirmed' | 'rejected'>('confirmed')
const licenseSigner = ref('林水妹')
const licenseNote = ref('')

const {
  state: licenseState,
  isBusy: licenseBusy,
  isError: licenseIsError,
  canRetry: licenseCanRetry,
  run: runLicense,
  retry: retryLicense,
  reset: resetLicense,
} = useAsyncTask<LicenseConfirmResponse, []>(
  () =>
    uploadApi.confirmLicense({
      interviewId: session.interviewId,
      decision: licenseDecision.value,
      licenseType: form.licenseType,
      signer: licenseSigner.value.trim(),
      signedAt: new Date().toISOString(),
      ...(licenseNote.value.trim() ? { note: licenseNote.value.trim() } : {}),
      attachments: [],
      operator: CURRENT_OPERATOR,
    }),
  {
    onConfirm: () => undefined,
  },
)

const licenseModalOpen = ref(false)

/* ------------------------------------------------------------------ */
/* 上传主流程                                                          */
/* ------------------------------------------------------------------ */

function applyStatus(status: UploadStatusResponse): void {
  session.progress = status.progress
  session.uploadedBytes = status.uploadedBytes
  session.remainingMs = status.remainingMs
}

async function startUpload(init: UploadInitResponse, resume = false): Promise<void> {
  lastInit.value = init
  session.uploadId = init.uploadId
  session.interviewId = init.interviewId
  session.totalChunks = init.totalChunks
  session.error = null

  if (!resume) {
    session.doneChunks = 0
    session.progress = 0
    session.uploadedBytes = 0
    session.remainingMs = null
    session.result = null
    resetLicense()
  }

  session.phase = 'uploading'

  try {
    for (let index = session.doneChunks; index < init.totalChunks; index += 1) {
      const response = await uploadApi.uploadChunk(init.uploadId, index, init.totalChunks)
      session.doneChunks = index + 1
      session.progress = response.data.progress
      session.uploadedBytes = response.data.uploadedBytes
      session.remainingMs = response.data.remainingMs
    }

    session.phase = 'merging'
    const status = await uploadApi.getStatus(init.uploadId)
    applyStatus(status.data)

    const done = await uploadApi.complete(init.uploadId)
    session.result = done.data
    session.phase = 'done'
    notify('success', '录音上传完成', '请确认授权状态后再进入转写流程。')
    licenseModalOpen.value = true
    void refreshList()
  } catch (error) {
    session.phase = 'failed'
    session.error = isApiError(error)
      ? error
      : new ApiError({ code: 'unknown', message: String(error) })
    notify('error', '上传中断', session.error.message)
  }
}

async function refreshList(): Promise<void> {
  await runList()
}

/** 初始化成功后自动进入分片上传；确认重复文件后同样如此。 */
watch(
  () => initState.value.phase,
  (phase) => {
    if (phase === 'success' && initState.value.data) {
      void startUpload(initState.value.data)
    }
  },
)

function beginUpload(): void {
  if (!selectedFile.value) {
    notify('error', '请先选择音频文件。')
    return
  }
  if (validationError.value) {
    notify('error', '文件校验未通过，请更换文件。', validationError.value)
    return
  }
  overwriteIntent.value = false
  session.phase = 'idle'
  session.progress = 0
  session.doneChunks = 0
  void runInit()
}

function resumeUpload(): void {
  const init = lastInit.value
  if (!init) {
    // 上传会话丢失：走「不可用」而非静默失败
    notify('warning', '上传会话已失效，需要重新初始化上传。')
    beginUpload()
    return
  }
  void startUpload(init, true)
}

function handleDuplicateSkip(): void {
  duplicateModalOpen.value = false
  resetInit()
  clearFile()
  notify('info', '已跳过重复录音的上传。')
}

function handleDuplicateOverwrite(): void {
  duplicateModalOpen.value = false
  overwriteIntent.value = true
  notify('warning', '将覆盖已有记录（覆盖语义待后端确认 TODO-UP-3）。')
  void respondInitConfirm('confirmed')
}

function handleDuplicateCreateNew(): void {
  duplicateModalOpen.value = false
  void respondInitConfirm('confirmed')
}

function handleDuplicateCancel(): void {
  duplicateModalOpen.value = false
  void respondInitConfirm('rejected')
}

/* ------------------------------------------------------------------ */
/* 授权确认                                                            */
/* ------------------------------------------------------------------ */

async function submitLicense(decision: 'confirmed' | 'rejected'): Promise<void> {
  if (licenseSigner.value.trim().length === 0) {
    notify('error', '请填写授权人姓名。')
    return
  }
  licenseDecision.value = decision
  await runLicense()
  if (licenseState.value.phase === 'success') {
    licenseModalOpen.value = false
    notify(
      decision === 'confirmed' ? 'success' : 'warning',
      decision === 'confirmed' ? '授权已确认' : '授权已标记为驳回',
      decision === 'confirmed'
        ? `凭证编号 ${licenseState.value.data?.certificateNo ?? '—'}`
        : '该录音将不可公开发布，仅供内部留档。',
    )
    void refreshList()
  }
}

/* ------------------------------------------------------------------ */
/* 状态机聚合                                                          */
/* ------------------------------------------------------------------ */

const phase = computed<TaskPhase>(() => {
  if (licenseState.value.phase === 'success') return 'success'
  if (initBusy.value) return initRetrying.value ? 'retrying' : 'loading'
  if (initNeedsConfirm.value) return 'confirm'
  if (initUnavailable.value) return 'unavailable'
  if (initError.value) return 'error'
  if (session.phase === 'uploading' || session.phase === 'merging') return 'loading'
  if (session.phase === 'failed') return 'error'
  if (session.phase === 'done') return 'confirm'
  if (licenseBusy.value) return 'loading'
  if (licenseState.value.phase === 'error') return 'error'
  return 'idle'
})

const phaseCanRetry = computed(() => {
  if (initError.value) return initCanRetry.value
  if (session.phase === 'failed') return true
  if (licenseIsError.value) return licenseCanRetry.value
  return false
})

const phaseError = computed(() => {
  if (initError.value) return initState.value.error
  if (session.phase === 'failed') return session.error
  return licenseState.value.error
})

function handleRetry(): void {
  if (initError.value) {
    void retryInit()
    return
  }
  if (session.phase === 'failed') {
    resumeUpload()
    return
  }
  void retryLicense()
}

/* ------------------------------------------------------------------ */
/* 列表展示                                                            */
/* ------------------------------------------------------------------ */

const interviews = computed(() => listState.value.data?.list ?? [])

const LICENSE_META: Record<
  LicenseStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  confirmed: { label: '授权已确认', tone: 'success' },
  pending: { label: '待确认授权', tone: 'warning' },
  rejected: { label: '授权已驳回', tone: 'danger' },
  not_required: { label: '无需授权', tone: 'neutral' },
}

const progressTone = computed<'normal' | 'success' | 'danger' | 'warning'>(() => {
  if (session.phase === 'failed') return 'danger'
  if (session.phase === 'done') return 'success'
  if (session.phase === 'merging') return 'warning'
  return 'normal'
})

const progressLabel = computed(() =>
  session.phase === 'merging'
    ? '正在合并分片…'
    : `上传中（${session.doneChunks}/${session.totalChunks} 分片）`,
)

// 进入页面即拉取一次采访列表
void runList()
</script>

<template>
  <div class="space-y-4">
    <FlowHeader
      :step="1"
      title="上传已授权采访录音"
      description="上传前先确认授权范围：口述史材料的可用范围决定了后续能否公开发布。支持拖拽、分片上传与断点重传，上传中断不会丢失已完成的分片。"
      :phase="phase"
      :attempts="initState.attempts"
      :endpoints="[
        'POST /interviews/uploads:init',
        'POST /interviews/uploads/{uploadId}/chunks',
        'GET /interviews/uploads/{uploadId}',
        'POST /interviews/uploads/{uploadId}:complete',
        'POST /interviews/{interviewId}/license',
        'GET /interviews',
      ]"
    >
      <template #actions>
        <StatusPill tone="violet" dense>允许格式 {{ allowedFormatsText }}</StatusPill>
        <StatusPill tone="neutral" dense>单文件上限 {{ maxSizeText }}</StatusPill>
      </template>
    </FlowHeader>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <!-- ==================== 左：表单与文件 ==================== -->
      <div class="space-y-4">
        <PanelSection
          title="1 · 采访信息"
          description="这些字段会随录音一起入库，也是检索时的结构化条件。"
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="space-y-1">
              <span class="text-2xs text-ink-3"
                >采访标题 <span class="text-vermilion">*</span></span
              >
              <input
                v-model="form.title"
                type="text"
                class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
              />
            </label>
            <label class="space-y-1">
              <span class="text-2xs text-ink-3">讲述人 <span class="text-vermilion">*</span></span>
              <input
                v-model="form.narrator"
                type="text"
                class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
              />
            </label>
            <label class="space-y-1">
              <span class="text-2xs text-ink-3">采访人</span>
              <input
                v-model="form.interviewer"
                type="text"
                class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
              />
            </label>
            <label class="space-y-1">
              <span class="text-2xs text-ink-3">采录日期</span>
              <input
                v-model="form.recordedAt"
                type="date"
                class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
              />
            </label>
            <label class="space-y-1">
              <span class="text-2xs text-ink-3">采录地点</span>
              <input
                v-model="form.recordedPlace"
                type="text"
                class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
              />
            </label>
            <label class="space-y-1">
              <span class="text-2xs text-ink-3">方言 / 语言</span>
              <input
                v-model="form.dialect"
                type="text"
                class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
              />
            </label>
            <label class="space-y-1 sm:col-span-2">
              <span class="text-2xs text-ink-3">授权类型声明（最终以授权确认为准）</span>
              <select
                v-model="form.licenseType"
                class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
              >
                <option v-for="(label, value) in LICENSE_TYPE_LABEL" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </label>
          </div>
        </PanelSection>

        <PanelSection
          title="2 · 选择录音文件"
          description="点击选择或直接拖拽到下方区域。上传前会先做格式与大小校验，校验不通过不会发起请求。"
        >
          <div
            class="flex flex-col items-center justify-center gap-2 border-2 border-dashed px-6 py-8 text-center transition-colors"
            :class="
              isDragging
                ? 'border-seal-2 bg-seal'
                : validationError
                  ? 'border-vermilion bg-vermilion-wash'
                  : 'border-rule bg-paper'
            "
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <span aria-hidden="true"><AppIcon name="mic" :size="26" /></span>
            <p class="text-xs text-ink-2">把音频文件拖到这里，或</p>
            <BaseButton variant="secondary" size="sm" @click="fileInputEl?.click()">
              选择文件
            </BaseButton>
            <input
              ref="fileInputEl"
              type="file"
              class="hidden"
              :accept="UPLOAD_CONSTRAINTS.allowedFormats.map((item) => `.${item}`).join(',')"
              @change="handleInputChange"
            />
            <p class="text-2xs text-ink-4">
              允许 {{ allowedFormatsText }}；单文件不超过 {{ maxSizeText }}；时长
              {{ formatDurationText(UPLOAD_CONSTRAINTS.minDurationMs) }} 以上。
            </p>
          </div>

          <!-- 选中文件摘要 -->
          <div
            v-if="selectedFile"
            class="mt-3 flex flex-wrap items-center gap-2 border border-rule bg-paper px-3 py-2"
          >
            <span class="text-sm" aria-hidden="true"><AppIcon name="waveform" :size="14" /></span>
            <span class="min-w-0 flex-1 truncate text-xs text-ink">{{ selectedFile.name }}</span>
            <StatusPill tone="neutral" dense>{{ formatBytes(selectedFile.size) }}</StatusPill>
            <StatusPill v-if="probedDurationMs" tone="info" dense>
              {{ formatDurationText(probedDurationMs) }}
            </StatusPill>
            <StatusPill v-else tone="warning" dense>时长未知</StatusPill>
            <BaseButton variant="ghost" size="sm" @click="clearFile">移除</BaseButton>
          </div>

          <!-- 校验失败（前置校验，不发请求） -->
          <p
            v-if="validationError"
            class="mt-2 flex items-start gap-1.5 bg-vermilion-wash px-2.5 py-1.5 text-2xs text-vermilion"
          >
            <span aria-hidden="true"><AppIcon name="alert" :size="14" /></span
            ><span>{{ validationError }}</span>
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <BaseButton
              variant="primary"
              :loading="initBusy || session.phase === 'uploading' || session.phase === 'merging'"
              :disabled="!selectedFile || !!validationError"
              @click="beginUpload"
            >
              开始上传
            </BaseButton>
            <BaseButton v-if="session.phase === 'failed'" variant="secondary" @click="resumeUpload">
              断点重传
            </BaseButton>
            <span class="text-2xs text-ink-4">
              调用 <code class="font-mono">uploadApi.init</code> →
              <code class="font-mono">uploadChunk</code> × N →
              <code class="font-mono">getStatus</code> →
              <code class="font-mono">complete</code>
            </span>
          </div>
        </PanelSection>
      </div>

      <!-- ==================== 右：进度与授权 ==================== -->
      <div class="space-y-4">
        <PanelSection title="3 · 上传进度与授权状态" description="上传完成前不允许进入转写流程。">
          <AsyncStateBoundary
            :phase="phase"
            :error="phaseError"
            :can-retry="phaseCanRetry"
            :retry-progress="initState.retryProgress"
            :unavailable-reason="
              initState.unavailableReason ??
              (session.phase === 'failed' ? session.error?.message : undefined)
            "
            loading-text="正在准备上传会话…"
            empty-title="已取消本次上传"
            empty-reason="你在重复文件提示中选择了取消，未创建新的采访记录。"
            empty-suggestion="如需继续，请重新选择文件并点击「开始上传」。"
            :skeleton-rows="3"
            min-height-class="min-h-[200px]"
            @retry="handleRetry"
          >
            <div class="space-y-3">
              <!-- 上传进度 -->
              <div v-if="session.phase !== 'idle'" class="space-y-2">
                <ProgressBar
                  :progress="session.progress"
                  :remaining-ms="session.remainingMs"
                  :label="progressLabel"
                  :tone="progressTone"
                  :indeterminate="session.phase === 'merging'"
                />
                <p class="text-2xs text-ink-4">
                  已上传 {{ formatBytes(session.uploadedBytes) }} /
                  {{ formatBytes(selectedFile?.size ?? 0) }}
                  <span
                    v-if="session.doneChunks < session.totalChunks && session.phase === 'failed'"
                  >
                    · 失败分片可从第 {{ session.doneChunks + 1 }} 片续传
                  </span>
                </p>
              </div>

              <!-- 上传成功摘要 -->
              <div
                v-if="session.result"
                class="space-y-1.5 border border-verified bg-verified-wash px-3 py-2 text-2xs text-verified"
              >
                <p class="font-medium"><AppIcon name="check" :size="14" /> 分片合并完成</p>
                <p class="text-verified">采访记录：{{ session.result.interviewId }}</p>
                <p class="text-verified">
                  服务端解析时长：{{ formatDurationText(session.result.durationMs) }}
                </p>
                <p v-if="overwriteIntent" class="text-attention">
                  已按「覆盖已有记录」处理（覆盖语义待后端确认 TODO-UP-3）。
                </p>
              </div>

              <!-- 授权状态卡片 -->
              <div class="space-y-2 border border-rule bg-paper px-3 py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-2xs font-medium text-ink-2">授权状态</span>
                  <StatusPill
                    :tone="LICENSE_META[session.result?.licenseStatus ?? 'pending'].tone"
                    dense
                  >
                    {{ LICENSE_META[session.result?.licenseStatus ?? 'pending'].label }}
                  </StatusPill>
                </div>
                <p class="text-2xs leading-4 text-ink-4">
                  当前声明：{{ LICENSE_TYPE_LABEL[form.licenseType] }}
                </p>
                <template v-if="licenseState.phase === 'success' && licenseState.data">
                  <p class="text-2xs text-verified">
                    已由 {{ licenseState.data.confirmedBy }} 于
                    {{
                      licenseState.data.confirmedAt
                        ? formatDateTime(licenseState.data.confirmedAt)
                        : '—'
                    }}
                    确认
                  </p>
                  <p v-if="licenseState.data.certificateNo" class="font-mono text-2xs text-ink-4">
                    凭证：{{ licenseState.data.certificateNo }}
                  </p>
                  <BaseButton variant="ghost" size="sm" @click="licenseModalOpen = true">
                    重新确认授权
                  </BaseButton>
                </template>
                <template v-else>
                  <BaseButton
                    variant="secondary"
                    size="sm"
                    :disabled="session.phase !== 'done'"
                    @click="licenseModalOpen = true"
                  >
                    打开授权确认
                  </BaseButton>
                  <p v-if="session.phase !== 'done'" class="text-2xs text-ink-4">需先完成上传。</p>
                </template>
              </div>

              <p class="text-2xs leading-4 text-ink-4">
                每个数据交互节点的字段说明与 mock 位置见报头「开发者」开关内的接口面板。
              </p>
            </div>
          </AsyncStateBoundary>
        </PanelSection>
      </div>
    </div>

    <!-- ==================== 采访记录列表（空状态独立呈现） ==================== -->
    <PanelSection
      title="采访记录"
      description="调用 GET /interviews。用于核验上传结果，也用于「重复文件」判定的对照。"
    >
      <template #actions>
        <BaseButton variant="ghost" size="sm" :loading="listBusy" @click="refreshList"
          >刷新</BaseButton
        >
      </template>

      <AsyncStateBoundary
        :phase="listState.phase"
        :error="listState.error"
        :can-retry="listCanRetry"
        :empty-reason="listState.emptyHint?.reason"
        :empty-suggestion="listState.emptyHint?.suggestion"
        empty-title="还没有采访记录"
        :skeleton-rows="3"
        min-height-class="min-h-[140px]"
        @retry="retryList"
      >
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-2xs">
            <thead class="text-ink-4">
              <tr>
                <th class="px-2 py-1.5 font-medium">标题</th>
                <th class="px-2 py-1.5 font-medium">讲述人</th>
                <th class="px-2 py-1.5 font-medium">采录</th>
                <th class="px-2 py-1.5 font-medium">时长</th>
                <th class="px-2 py-1.5 font-medium">文件</th>
                <th class="px-2 py-1.5 font-medium">授权</th>
                <th class="px-2 py-1.5 font-medium">流程</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-rule">
              <tr v-for="item in interviews" :key="item.interviewId" class="hover:bg-paper-3">
                <td class="px-2 py-1.5 text-ink">{{ item.title }}</td>
                <td class="px-2 py-1.5 text-ink-3">{{ item.narrator }}</td>
                <td class="px-2 py-1.5 text-ink-3">
                  {{ item.recordedAt }}<br /><span class="text-ink-4">{{
                    item.recordedPlace
                  }}</span>
                </td>
                <td class="px-2 py-1.5 text-ink-3">{{ formatDurationText(item.durationMs) }}</td>
                <td class="px-2 py-1.5">
                  <span class="font-mono text-ink-3">{{ item.fileName }}</span>
                  <span class="ml-1 text-ink-4">{{ formatBytes(item.sizeBytes) }}</span>
                </td>
                <td class="px-2 py-1.5">
                  <StatusPill :tone="LICENSE_META[item.licenseStatus].tone" dense>
                    {{ LICENSE_META[item.licenseStatus].label }}
                  </StatusPill>
                </td>
                <td class="px-2 py-1.5">
                  <StatusPill tone="violet" dense>第 {{ item.stage }} 步 / 7</StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AsyncStateBoundary>
    </PanelSection>

    <!-- ==================== 重复文件处理弹窗 ==================== -->
    <ModalDialog
      :open="duplicateModalOpen || initNeedsConfirm"
      title="检测到同名 / 重复录音"
      :dismissible="false"
      confirm-text="仍然新建"
      cancel-text="取消上传"
      @confirm="handleDuplicateCreateNew"
      @cancel="handleDuplicateCancel"
    >
      <div class="space-y-3">
        <p class="text-xs leading-5 text-ink-2">{{ initState.confirmPrompt?.message }}</p>
        <ul v-if="initState.confirmPrompt?.details" class="space-y-1">
          <li
            v-for="detail in initState.confirmPrompt.details"
            :key="detail"
            class="bg-paper-3 px-2.5 py-1.5 text-2xs text-ink-2"
          >
            {{ detail }}
          </li>
        </ul>
        <p class="text-2xs leading-4 text-attention">
          处理建议：若为同一段录音的重复导出，选择「跳过」；若本次录音质量更高，选择「覆盖已有记录」；
          若确为另一场采访，选择「仍然新建」。
        </p>
        <div class="flex flex-wrap gap-2">
          <BaseButton variant="ghost" size="sm" @click="handleDuplicateSkip"
            >跳过本次上传</BaseButton
          >
          <BaseButton variant="secondary" size="sm" @click="handleDuplicateOverwrite">
            覆盖已有记录
          </BaseButton>
        </div>
      </div>
    </ModalDialog>

    <!-- ==================== 授权确认弹窗 ==================== -->
    <ModalDialog
      :open="licenseModalOpen"
      title="授权状态确认"
      :confirm-text="'确认授权'"
      cancel-text="稍后处理"
      :loading="licenseBusy"
      :confirm-disabled="licenseSigner.trim().length === 0"
      @confirm="submitLicense('confirmed')"
      @cancel="licenseModalOpen = false"
    >
      <div class="space-y-3">
        <div class="border border-attention bg-attention-wash px-3 py-2.5">
          <p class="text-2xs font-medium text-attention">授权范围直接决定后续能否公开发布</p>
          <p class="mt-1 text-2xs leading-4 text-attention">
            「仅研究使用」与「仅项目内部使用」的材料，在流程 7 的审核发布中会被AI 风险检查拦截。
            请务必与讲述人逐条确认。
          </p>
        </div>

        <label class="block space-y-1">
          <span class="text-2xs text-ink-3">授权类型</span>
          <select
            v-model="form.licenseType"
            class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
          >
            <option v-for="(label, value) in LICENSE_TYPE_LABEL" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </label>

        <label class="block space-y-1">
          <span class="text-2xs text-ink-3"
            >授权人（讲述人或其代理人）<span class="text-vermilion">*</span></span
          >
          <input
            v-model="licenseSigner"
            type="text"
            class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-2xs text-ink-3">备注</span>
          <textarea
            v-model="licenseNote"
            rows="2"
            class="w-full resize-y border border-rule bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-seal-2"
            placeholder="例如：口头授权，授权书扫描件待补。"
          />
        </label>

        <p v-if="licenseIsError" class="bg-vermilion-wash px-2.5 py-1.5 text-2xs text-vermilion">
          {{ licenseState.error?.displayMessage }}
        </p>

        <div class="flex flex-wrap gap-2 border-t border-rule pt-2.5">
          <BaseButton
            variant="danger"
            size="sm"
            :loading="licenseBusy"
            @click="submitLicense('rejected')"
          >
            标记为不予授权
          </BaseButton>
          <span class="text-2xs leading-7 text-ink-4">
            标记后该录音仅作内部留档，不进入公开发布流程。
          </span>
        </div>
      </div>
    </ModalDialog>
  </div>
</template>
