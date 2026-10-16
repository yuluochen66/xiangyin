<script setup lang="ts">
/**
 * 流程 6：生成故事卡 / 研学讲稿。
 *
 * 设计要点：
 * - 参数选择（输出类型 / 语气 / 篇幅 / 创作自由度 / 三个开关）完整对应
 *   CreateGenerationRequest，请求体在界面上可见，便于前后端对齐；
 * - 角标 [n] 渲染为可点击上标，点击后高亮右侧对应 citation；
 * - 「用到的资料 / 因风险被排除的资料」并列展示，并解释为什么少用；
 * - 生成结果可逐块人工编辑（标记 edited=true），可存草稿或存为版本；
 * - 重新生成带 keepEditedBlocks 开关，覆盖前用 ModalDialog 二次确认；
 * - 7 态全部落到 AsyncStateBoundary，不可用时仍可切「人工撰写」继续。
 *
 * 拆分后的职责：本文件保留接口调用入口（useAsyncTask + generateApi）与异步动作编排，
 * 以及顶层布局；参数、请求体、草稿、结果区与右栏分别落在 composable 与 flow6 组件中。
 */
import { computed, provide } from 'vue'

import { generateApi } from '@/api'
import BaseButton from '@/components/common/BaseButton.vue'
import FlowHeader from '@/components/common/FlowHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import CitationPanel from '@/components/flow6/CitationPanel.vue'
import DraftInfoPanel from '@/components/flow6/DraftInfoPanel.vue'
import GenerationParamPanel from '@/components/flow6/GenerationParamPanel.vue'
import GenerationResultArea from '@/components/flow6/GenerationResultArea.vue'
import RegenerateConfirmDialog from '@/components/flow6/RegenerateConfirmDialog.vue'
import RiskPanel from '@/components/flow6/RiskPanel.vue'
import ToolInvokePanel from '@/components/tools/ToolInvokePanel.vue'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { GENERATION_FORM_KEY, useGenerationForm } from '@/composables/useGenerationForm'
import { DRAFT_STATUS_LABEL, buildRiskConfirmPrompt } from '@/composables/useGenerationMeta'
import { GENERATION_DRAFT_KEY, useGenerationDraft } from '@/composables/useGenerationDraft'
import { useGenerationPayloads } from '@/composables/useGenerationPayloads'
import { useRouter } from '@/router'
import type {
  CreateGenerationResponse,
  DraftBlock,
  GetDraftResponse,
  RegenerateResponse,
  SaveDraftResponse,
} from '@/types/api'

/* ------------------------------------------------------------------ */
/* 常量                                                                */
/* ------------------------------------------------------------------ */

const ENDPOINTS = [
  'POST /generations:create',
  'POST /generations/{draftId}:regenerate',
  'PUT /generations/{draftId}',
  'GET /generations/{draftId}',
]

/**
 * AI 工具契约层的默认入参。
 * 定义成模块级常量以保证引用稳定——若在模板里内联对象字面量，
 * 每次渲染都会生成新对象并覆盖用户在面板中编辑的 JSON。
 */
const TOOL_STORY_INPUT: Record<string, unknown> = {
  title: '一双手推亮的漆器：塔巷里的脱胎往事',
  claimIds: ['C-01', 'C-02', 'C-03', 'C-04', 'C-05'],
  sourceIds: ['SRC-01', 'SRC-02', 'SRC-03', 'SRC-04', 'SRC-05', 'SRC-06'],
  tone: 'neutral',
}

/* ------------------------------------------------------------------ */
/* 参数 / 草稿 / 请求体                                                */
/* ------------------------------------------------------------------ */

const { notify } = useAppShell()
const { goToStep } = useRouter()

const form = useGenerationForm()
const draft = useGenerationDraft(form.allowUnverified)
const payloads = useGenerationPayloads(form, draft)
const { canGenerate } = form
const { regenConfirmOpen } = draft

provide(GENERATION_FORM_KEY, form)
provide(GENERATION_DRAFT_KEY, draft)

/* ------------------------------------------------------------------ */
/* 接口调用入口                                                        */
/* ------------------------------------------------------------------ */

const {
  state: genState,
  canRetry: genCanRetry,
  isBusy: genBusy,
  run: runGenerate,
  retry: retryGenerate,
  respondConfirm: respondGenerateConfirm,
  setData: setGenerateData,
} = useAsyncTask<CreateGenerationResponse, []>(
  () => generateApi.create(payloads.buildCreateBody()),
  {
    isEmpty: (data) => data.blocks.length === 0,
    emptyHint: {
      reason: '本次生成没有产出任何区块：限定条件可能过窄，或所选论断与资料无法对应。',
      suggestion: '把篇幅调成「短稿」、减少论断数量或清空附加要求后重试；也可以切换人工撰写。',
    },
    needsConfirm: (data) =>
      buildRiskConfirmPrompt(data.riskNotes, form.allowUnverified.value, {
        title: '生成内容含需人工确认的风险点',
        message:
          '你开启了「允许收录待核实内容」，这些内容需要人工确认后才能进入流程 7 · 审核发布。',
        criticalMessage: 'AI 判定草稿中存在「严重」风险点，需逐条确认后才能进入流程 7 · 审核发布。',
        confirmText: '我已逐条确认，继续',
        cancelText: '放弃本次结果',
      }),
    onConfirm: (_data, decision) => {
      if (decision === 'confirmed') {
        draft.reviewReady.value = true
        notify('success', '已确认风险点', '现在可以进入流程 7 · 审核发布，或在右侧继续修订。')
      } else {
        draft.reviewReady.value = false
        notify('info', '已放弃本次生成结果', '可调整参数后重新生成，或切换到人工撰写。')
      }
    },
  },
)

const {
  state: regenState,
  canRetry: regenCanRetry,
  isBusy: regenBusy,
  run: runRegenerate,
  retry: retryRegenerate,
} = useAsyncTask<RegenerateResponse, []>(
  () => generateApi.regenerate(payloads.buildRegenerateBody()),
  {
    needsConfirm: (data) =>
      buildRiskConfirmPrompt(data.riskNotes, form.allowUnverified.value, {
        title: '重新生成的结果仍含需人工确认的风险点',
        message: '请逐条确认风险提示，确认后才能进入流程 7 · 审核发布。',
        confirmText: '我已逐条确认，继续',
        cancelText: '先不确认',
      }),
    onConfirm: (_data, decision) => {
      draft.reviewReady.value = decision === 'confirmed'
    },
  },
)

const {
  state: saveState,
  isBusy: saveBusy,
  run: runSave,
} = useAsyncTask<SaveDraftResponse, [boolean]>((createVersion: boolean) =>
  generateApi.saveDraft(payloads.buildSaveBody(createVersion)),
)

const {
  state: fetchState,
  isBusy: fetchBusy,
  run: runFetchDraft,
} = useAsyncTask<GetDraftResponse, []>(() => generateApi.getDraft(draft.draftId.value), {
  isEmpty: (data) => data.blocks.length === 0,
  emptyHint: {
    reason: '草稿库里这份草稿还没有任何区块。',
    suggestion: '点击「生成初稿」，或切换到人工撰写模式自行起草。',
  },
})

/* ------------------------------------------------------------------ */
/* 动作编排                                                            */
/* ------------------------------------------------------------------ */

const flowPhase = computed(() => {
  if (genBusy.value) return genState.value.phase
  if (regenBusy.value) return regenState.value.phase
  if (saveBusy.value) return saveState.value.phase
  if (fetchBusy.value) return fetchState.value.phase
  return genState.value.phase
})

/**
 * 发起生成初稿，并把响应落进草稿状态与提示条。
 * @param useRetry 是否走 useAsyncTask 的重试入口
 */
async function submitGenerate(useRetry: boolean): Promise<void> {
  draft.lastRequestBody.value = payloads.buildCreateBody()
  const response = useRetry ? await retryGenerate() : await runGenerate()
  if (response) {
    draft.applyGeneration(response.data)
    if (response.data.blocks.length > 0) {
      notify(
        'success',
        '初稿生成完成',
        String(response.data.blocks.length) +
          ' 个区块 · 引用资料 ' +
          String(response.data.citations.length) +
          ' 条',
      )
    } else {
      notify('warning', '生成结果为空', genState.value.emptyHint?.reason)
    }
  } else if (genState.value.error) {
    notify('error', '生成失败', genState.value.error.displayMessage)
  }
}

// 有未保存的人工编辑时先弹确认，否则直接重新生成。
function requestRegenerate(): void {
  if (draft.unsavedEdits.value) {
    draft.regenConfirmOpen.value = true
    return
  }
  void doRegenerate(false)
}

/**
 * 执行重新生成，并把响应落进草稿状态与提示条。
 * @param useRetry 是否走 useAsyncTask 的重试入口
 */
async function doRegenerate(useRetry: boolean): Promise<void> {
  draft.regenConfirmOpen.value = false
  draft.lastRequestBody.value = payloads.buildRegenerateBody()
  const response = useRetry ? await retryRegenerate() : await runRegenerate()
  if (response) {
    draft.applyRegeneration(response.data)
    notify(
      'success',
      '已重新生成',
      response.data.preservedBlockIds.length > 0
        ? '保留了 ' + String(response.data.preservedBlockIds.length) + ' 个人工编辑区块'
        : '本次没有保留人工编辑区块',
    )
  } else if (regenState.value.error) {
    notify('error', '重新生成失败', regenState.value.error.displayMessage)
  }
}

/**
 * 把当前草稿保存到服务端。
 * @param createVersion 是否写成正式版本
 */
async function saveDraftToServer(createVersion: boolean): Promise<void> {
  const response = await runSave(createVersion)
  if (response) {
    draft.riskNotes.value = draft.cloneRiskNotes(response.data.riskNotes)
    draft.unsavedEdits.value = false
    draft.savedVersionNo.value = response.data.version.versionNo
    notify(
      'success',
      createVersion ? '已保存为版本' : '草稿已保存',
      '版本 v' + String(response.data.version.versionNo) + ' · ' + response.data.savedAt,
    )
  } else if (saveState.value.error) {
    notify(
      'error',
      createVersion ? '保存为版本失败' : '保存草稿失败',
      saveState.value.error.displayMessage,
    )
  }
}

// 拉取服务端已有的草稿，并区分空草稿与正常草稿给提示。
async function loadDraft(): Promise<void> {
  const response = await runFetchDraft()
  if (response) {
    draft.applyFetchedDraft(response.data)
    if (response.data.blocks.length === 0) {
      notify('warning', '草稿为空', response.data.draftId + ' 还没有任何区块，可先执行生成。')
    } else {
      notify(
        'success',
        '已拉取草稿',
        '版本 v' +
          String(response.data.version.versionNo) +
          ' · 状态：' +
          DRAFT_STATUS_LABEL[response.data.status],
      )
    }
  } else if (fetchState.value.error) {
    notify('error', '拉取草稿失败', fetchState.value.error.displayMessage)
  }
}

// 空结果时的兜底：缩小篇幅、清空附加要求后重新生成。
function relaxAndRegenerate(): void {
  form.lengthPreset.value = 'short'
  form.extraInstruction.value = ''
  void submitGenerate(false)
}

// 生成能力不可用时的降级路径：切到人工撰写，并造一份本地合成响应写进状态机。
function enableHumanDraft(): void {
  draft.humanDraftMode.value = true
  const starter: DraftBlock = {
    id: draft.createHumanBlockId(),
    heading: '第一段 · 坊巷生活',
    body: '',
    citationIndexes: [],
    edited: true,
  }
  const synthetic = payloads.buildHumanDraftResponse(form.outputType.value, starter)
  draft.applyGeneration(synthetic)
  draft.reviewReady.value = true
  setGenerateData(synthetic, 'success')
  notify(
    'info',
    '已切换到人工撰写模式',
    '写稿模型不可用时，请自行起草区块；保存后仍按正常流程进入审核发布。',
  )
}

/**
 * 回应生成结果的风险点确认。
 * @param decision 确认或放弃本次结果
 */
async function respondGenConfirm(decision: 'confirmed' | 'rejected'): Promise<void> {
  await respondGenerateConfirm(decision)
}

// 进入流程 7 · 审核发布。
function goToPublish(): void {
  goToStep(7)
}
</script>

<template>
  <div class="space-y-4">
    <FlowHeader
      :step="6"
      title="生成故事卡 / 研学讲稿"
      description="把流程 5 中确认过的论断，按选定语气与篇幅编排成稿，并自动为每句结论标注可追溯的引用角标；所有 AI 产出都可人工编辑、存版与回退。"
      :phase="flowPhase"
      :attempts="genState.attempts"
      :endpoints="ENDPOINTS"
    >
      <template #actions>
        <StatusPill :tone="genState.fromMock ? 'neutral' : 'violet'" dense>
          {{ genState.fromMock ? 'Mock 数据' : '真实接口' }}
        </StatusPill>
        <BaseButton size="sm" :loading="fetchBusy" @click="loadDraft">拉取草稿</BaseButton>
        <BaseButton
          size="sm"
          variant="primary"
          :loading="genBusy"
          :disabled="!canGenerate"
          @click="submitGenerate(false)"
        >
          生成初稿
        </BaseButton>
      </template>
    </FlowHeader>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <!-- 左栏：参数 + 结果 -->
      <div class="space-y-4">
        <GenerationParamPanel
          :gen-busy="genBusy"
          @generate="submitGenerate(false)"
          @human-draft="enableHumanDraft"
        />

        <GenerationResultArea
          :gen-state="genState"
          :gen-can-retry="genCanRetry"
          :regen-state="regenState"
          :regen-busy="regenBusy"
          :regen-can-retry="regenCanRetry"
          :save-state="saveState"
          :save-busy="saveBusy"
          :fetch-busy="fetchBusy"
          @generate="submitGenerate(false)"
          @retry="submitGenerate(true)"
          @human-draft="enableHumanDraft"
          @load-draft="loadDraft"
          @relax="relaxAndRegenerate"
          @respond-confirm="respondGenConfirm"
          @regenerate="requestRegenerate"
          @retry-regenerate="doRegenerate(true)"
          @save="saveDraftToServer"
          @publish="goToPublish"
        />
      </div>

      <!-- 右栏：来源标注 + 风险 + 草稿信息 -->
      <aside class="space-y-4">
        <CitationPanel />
        <RiskPanel />
        <DraftInfoPanel :fetch-state="fetchState" :gen-state="genState" />
      </aside>
    </div>

    <RegenerateConfirmDialog
      :regen-busy="regenBusy"
      @confirm="doRegenerate(false)"
      @cancel="regenConfirmOpen = false"
    />

    <ToolInvokePanel
      tool="build_story_card"
      title="故事卡构建（工具契约层）"
      description="走 build_story_card 工具契约：把已核查论断聚合为 StoryCard（时间线、关键论断、来源集合、风险等级），并主动排除判定为 contradicted / unverified 的论断。只要发生排除，面板就会进入「需人工确认」状态——被丢弃的内容必须让人看见，否则无法判断故事卡为什么少了内容。"
      :input="TOOL_STORY_INPUT"
    />
  </div>
</template>
