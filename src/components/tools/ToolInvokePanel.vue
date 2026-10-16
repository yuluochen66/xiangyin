<script setup lang="ts">
/**
 * AI 工具调用面板（工具契约层）。
 *
 * 与 src/api/* 的分工：
 * - \`src/api/*\` 是「REST 端点」视图，字段面向后端接口，是流程页的主数据通路；
 * - 本面板走 \`src/services/toolClient.ts\`，是「AI 工具调用」视图，
 *   契约类型在 \`src/types/tools.ts\`（retrieve_local_sources / compare_claims /
 *   build_story_card / submit_review）。
 *
 * 两条路都能到达同一个 AI 能力，后端定稿后二选一即可（TODO-ARCH-1）。
 * 本面板的意义是：让四个工具的调用**在流程里真的被触发并可观测**，
 * 而不是只躺在契约文件里。
 *
 * 状态：复用统一的 7 态状态机（useAsyncTask + AsyncStateBoundary），
 * 把 ToolResult 的错误码映射成 ApiError，界面表现与 REST 通路完全一致。
 */
import { computed, ref, watch } from 'vue'

import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import JsonPreview from '@/components/common/JsonPreview.vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { toolClient } from '@/services'
import { ApiError } from '@/services/api/errors'
import type { ApiResponse } from '@/services/api/httpClient'
import type { ApiErrorCode } from '@/services/api/types'
import type {
  BuildStoryCardInput,
  BuildStoryCardOutput,
  CompareClaimsInput,
  RetrieveLocalSourcesInput,
  SubmitReviewInput,
  ToolErrorCode,
  ToolName,
  ToolResult,
} from '@/types'

interface Props {
  /** 工具名，决定调用哪个契约。 */
  tool: ToolName
  /** 面板标题（写清它在流程里干什么）。 */
  title: string
  /** 一句话说明这个工具在本流程中承担什么。 */
  description: string
  /** 默认入参，可在界面上直接改（JSON）。 */
  input: Record<string, unknown>
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), { defaultOpen: true })

const { notify } = useAppShell()

/** 工具错误码 → 统一接口错误码。 */
const TOOL_ERROR_TO_API: Record<ToolErrorCode, ApiErrorCode> = {
  network: 'network',
  timeout: 'timeout',
  invalid_input: 'validation',
  not_found: 'notFound',
  server: 'server',
  cancelled: 'cancelled',
  unknown: 'unknown',
}

const open = ref(props.defaultOpen)
const inputEditorOpen = ref(false)
const draftJson = ref(JSON.stringify(props.input, null, 2))
const parseError = ref<string | null>(null)
/** 写操作（提交审校）前的二次确认。 */
const preConfirmOpen = ref(false)

/** 入参变化时同步编辑器内容。 */
watch(
  () => props.input,
  (value) => {
    draftJson.value = JSON.stringify(value, null, 2)
    parseError.value = null
  },
  { deep: true },
)

const isWriteTool = computed(() => props.tool === 'submit_review')

const TOOL_LABEL: Record<ToolName, string> = {
  retrieve_local_sources: '地方资料检索',
  compare_claims: '论断一致性核查',
  build_story_card: '故事卡构建',
  submit_review: '审校提交',
}

/**
 * 按工具名分派到类型化的 client 方法。
 * @param input 工具入参
 * @returns 类型化的工具调用结果
 */
function invokeTyped(input: unknown): Promise<ToolResult<unknown>> {
  switch (props.tool) {
    case 'retrieve_local_sources':
      return toolClient.retrieveLocalSources(input as RetrieveLocalSourcesInput)
    case 'compare_claims':
      return toolClient.compareClaims(input as CompareClaimsInput)
    case 'build_story_card':
      return toolClient.buildStoryCard(input as BuildStoryCardInput)
    case 'submit_review':
      return toolClient.submitReview(input as SubmitReviewInput)
  }
}

/**
 * 把 ToolResult 适配成 ApiResponse，从而复用同一套状态机与错误 UI。
 * @returns 转换为 API 响应信封后的调用结果
 */
async function callTool(): Promise<ApiResponse<unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(draftJson.value)
  } catch (error) {
    throw new ApiError({
      code: 'validation',
      message: `入参不是合法 JSON：${(error as Error).message}`,
      label: props.title,
    })
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError({
      code: 'validation',
      message: '入参必须是一个 JSON 对象。',
      label: props.title,
    })
  }

  const result = await invokeTyped(parsed)

  if (!result.ok) {
    throw new ApiError({
      code: TOOL_ERROR_TO_API[result.error.code],
      message: result.error.message,
      label: props.title,
    })
  }

  return {
    data: result.data,
    status: 200,
    fromMock: true,
    tookMs: result.tookMs,
    empty: false,
  }
}

const { state, isBusy, canRetry, run, retry, respondConfirm, reset } = useAsyncTask<unknown, []>(
  () => callTool(),
  {
    // 故事卡构建会丢弃证据不足的论断，丢弃行为必须由人确认
    needsConfirm: (data) => {
      if (props.tool !== 'build_story_card') return null
      const output = data as BuildStoryCardOutput
      if (!output.omittedClaimIds || output.omittedClaimIds.length === 0) return null
      return {
        title: '部分论断被排除，需人工确认',
        message: `工具在构建故事卡时排除了 ${output.omittedClaimIds.length} 条证据不足或与来源冲突的论断。`,
        details: [
          `被排除的论断：${output.omittedClaimIds.join('、')}`,
          '排除原因：判定为 contradicted 或 unverified 的论断不会进入可发布内容。',
          '如果你认为某条论断应当保留，请先在流程 5 完成一致性标注并补充来源。',
        ],
        confirmText: '已知晓，接受该结果',
        cancelText: '放弃本次结果',
      }
    },
  },
)

const toolDisplay = computed(() => TOOL_LABEL[props.tool])

function handleInvokeClick(): void {
  parseError.value = null
  try {
    JSON.parse(draftJson.value)
  } catch (error) {
    parseError.value = `入参不是合法 JSON：${(error as Error).message}`
    notify('error', '入参格式错误', parseError.value)
    return
  }

  if (isWriteTool.value) {
    preConfirmOpen.value = true
    return
  }
  void run()
}

function confirmPreConfirm(): void {
  preConfirmOpen.value = false
  void run()
}

function resetInput(): void {
  draftJson.value = JSON.stringify(props.input, null, 2)
  parseError.value = null
  reset()
  notify('info', '已重置入参与调用结果。')
}

function collapseInput(): void {
  inputEditorOpen.value = false
  try {
    JSON.parse(draftJson.value)
    parseError.value = null
  } catch (error) {
    parseError.value = `入参不是合法 JSON：${(error as Error).message}`
  }
}
</script>

<template>
  <section class="border border-rule bg-sheet">
    <header class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <button
        type="button"
        class="flex min-w-0 items-center gap-2 text-left"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="text-xs text-ink-4 transition-transform" :class="open ? 'rotate-90' : ''"
          >▶</span
        >
        <span class="text-xs font-semibold text-ink">AI 工具调用 · {{ title }}</span>
        <code class="bg-seal px-1.5 py-0.5 font-mono text-2xs text-seal-ink">
          {{ tool }}
        </code>
        <StatusPill tone="neutral" dense>{{ toolDisplay }}</StatusPill>
        <StatusPill v-if="isWriteTool" tone="warning" dense>写操作</StatusPill>
      </button>

      <div class="flex shrink-0 items-center gap-2">
        <BaseButton variant="ghost" size="sm" @click="resetInput">重置入参</BaseButton>
        <BaseButton variant="primary" size="sm" :loading="isBusy" @click="handleInvokeClick">
          调用工具
        </BaseButton>
      </div>
    </header>

    <div v-if="open" class="space-y-3 border-t border-rule px-4 py-3.5">
      <p class="text-2xs leading-5 text-ink-4">{{ description }}</p>

      <!-- 入参 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-2xs text-ink-3">
            入参（可编辑，契约类型见 <code class="font-mono">src/types/tools.ts</code>）
          </span>
          <BaseButton
            variant="ghost"
            size="sm"
            @click="inputEditorOpen ? collapseInput() : (inputEditorOpen = true)"
          >
            {{ inputEditorOpen ? '收起编辑器' : '编辑入参' }}
          </BaseButton>
        </div>

        <textarea
          v-if="inputEditorOpen"
          v-model="draftJson"
          rows="8"
          spellcheck="false"
          class="scroll-area w-full resize-y border border-rule bg-paper px-2.5 py-2 font-mono text-2xs leading-4 text-ink outline-none focus:border-seal-2"
        />
        <JsonPreview
          v-else
          :value="input"
          label="当前入参"
          :collapsed-lines="10"
          max-height-class="max-h-56"
        />

        <p v-if="parseError" class="bg-vermilion-wash px-2.5 py-1.5 text-2xs text-vermilion">
          {{ parseError }}
        </p>
      </div>

      <!-- 结果（7 态） -->
      <AsyncStateBoundary
        :phase="state.phase"
        :error="state.error"
        :can-retry="canRetry"
        :retry-progress="state.retryProgress"
        :unavailable-reason="state.unavailableReason"
        loading-text="工具调用中…"
        empty-title="工具返回空结果"
        empty-reason="当前入参在本地资料库中没有命中。"
        empty-suggestion="试着放宽关键词或去掉 kinds / minConfidence 限制后重新调用。"
        :skeleton-rows="3"
        min-height-class="min-h-[90px]"
        @retry="retry()"
      >
        <!-- 需人工确认 -->
        <div
          v-if="state.phase === 'confirm' && state.confirmPrompt"
          class="space-y-2.5 border border-seal-2 bg-seal px-3 py-2.5"
        >
          <p class="text-xs font-medium text-seal-ink">{{ state.confirmPrompt.title }}</p>
          <p class="text-2xs leading-4 text-seal-ink">{{ state.confirmPrompt.message }}</p>
          <ul v-if="state.confirmPrompt.details" class="space-y-1">
            <li
              v-for="detail in state.confirmPrompt.details"
              :key="detail"
              class="bg-sheet px-2 py-1 text-2xs leading-4 text-ink-2"
            >
              {{ detail }}
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <BaseButton variant="primary" size="sm" @click="respondConfirm('confirmed')">
              {{ state.confirmPrompt.confirmText ?? '确认' }}
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="respondConfirm('rejected')">
              {{ state.confirmPrompt.cancelText ?? '取消' }}
            </BaseButton>
          </div>
        </div>

        <!-- 成功 -->
        <div v-else class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <StatusPill tone="success" dense>调用成功</StatusPill>
            <StatusPill tone="neutral" dense>耗时 {{ state.tookMs ?? 0 }} ms</StatusPill>
            <StatusPill v-if="state.fromMock" tone="warning" dense>mock transport</StatusPill>
            <StatusPill v-if="state.attempts > 0" tone="neutral" dense
              >尝试 {{ state.attempts }} 次</StatusPill
            >
          </div>
          <JsonPreview
            :value="state.data"
            label="工具返回结果（ToolContract 出参）"
            :collapsed-lines="16"
          />
        </div>
      </AsyncStateBoundary>

      <p class="border-t border-rule pt-2.5 text-2xs leading-4 text-ink-4">
        本面板与流程页的主体数据通路（<code class="font-mono">@/api</code>）是两条并行路径：
        主体通路面向 REST 端点，本面板面向 AI 工具契约。后端定稿后二者取其一（TODO-ARCH-1）。
      </p>
    </div>

    <!-- 写操作二次确认 -->
    <ModalDialog
      :open="preConfirmOpen"
      :title="`确认调用 ${tool}`"
      confirm-text="确认提交"
      cancel-text="取消"
      :loading="isBusy"
      @confirm="confirmPreConfirm"
      @cancel="preConfirmOpen = false"
    >
      <p class="text-xs leading-5 text-ink-2">
        这是一个<b class="text-attention">写操作</b
        >：调用会提交审校决议并在服务端产生回执，无法通过重新调用撤销。
      </p>
      <p class="mt-2 text-2xs leading-4 text-ink-4">
        请求体即上方入参。确认前请核对 <code class="font-mono">reviewer</code>、
        <code class="font-mono">decisions</code> 与
        <code class="font-mono">reviewId</code> 是否正确。
      </p>
    </ModalDialog>
  </section>
</template>
