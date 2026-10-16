<script setup lang="ts">
/**
 * 流程 3：提取地点 / 人物 / 事件。
 *
 * 设计要点：
 * 1) 7 种界面状态由 useAsyncTask + AsyncStateBoundary 统一渲染；
 * 2) 实体按 EntityKind 分组展示，低置信度（confirmStatus = pending）用 amber 视觉突出；
 * 3) AI 只是「介入点」：每条待确认卡片提供「采纳 AI 建议」「修改后采纳」「驳回」，确认 / 驳回都可批量；
 * 4) 同义项合并由人工选择保留主实体，合并后展示 mergedAliases 与 removedIds；
 * 5) 每条 evidence 都能跳回原文：从 mockStore.segments 取片段，用字符串切分渲染 <mark>，不使用 v-html；
 *    片段不存在时给出降级提示（不确定性处理）；
 * 6) NER 不可用时提供**可用**的手工新增实体入口（表单弹窗不依赖主任务状态机）。
 *
 * 本视图只保留编排（接口入口、7 态状态机、顶层布局与事件串联），展示与动作见 flow3 组件与 composables。
 *
 * 待确认（TODO）：
 * - 同义项分组当前由前端 mock 按名称相似度计算（见 src/api/extract.ts 的 recomputeDuplicateGroups），
 *   后端就绪后应改为后端下发（目录中的 todos 已标注）；
 * - 人工新增实体暂不补挂 evidence，接口已支持 evidence 字段，待确认前端补挂交互；
 * - 删除是硬删除还是软删除待确认（TODO-API-3 类），当前按硬删除实现且不可撤销。
 */
import { computed, ref } from 'vue'

import { extractApi } from '@/api'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import FlowHeader from '@/components/common/FlowHeader.vue'
import DeleteEntityDialog from '@/components/flow3/DeleteEntityDialog.vue'
import EntityFormDialog from '@/components/flow3/EntityFormDialog.vue'
import ExtractionConfirmPanel from '@/components/flow3/ExtractionConfirmPanel.vue'
import ExtractionIdlePanel from '@/components/flow3/ExtractionIdlePanel.vue'
import ExtractionResultPanel from '@/components/flow3/ExtractionResultPanel.vue'
import ExtractionUnavailablePanel from '@/components/flow3/ExtractionUnavailablePanel.vue'
import WriteErrorBanner from '@/components/flow3/WriteErrorBanner.vue'
import MergePrimaryDialog from '@/components/flow3/MergePrimaryDialog.vue'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { useEntityBatchConfirm } from '@/composables/useEntityBatchConfirm'
import type { BatchPayload } from '@/composables/useEntityBatchConfirm'
import { useEntityDelete } from '@/composables/useEntityDelete'
import type { DeleteEntityResult } from '@/composables/useEntityDelete'
import { ENTITY_KINDS, useEntityFilters } from '@/composables/useEntityFilters'
import { useEntityForm } from '@/composables/useEntityForm'
import { useEntityMerge } from '@/composables/useEntityMerge'
import type { MergeResultSummary } from '@/composables/useEntityMerge'
import { useEntitySave } from '@/composables/useEntitySave'
import { useEvidenceTrace } from '@/composables/useEvidenceTrace'
import { taskErrorText, useExtractionTaskOptions } from '@/composables/useExtractionTaskRules'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import { mockStore } from '@/mock/store'
import { useRouter } from '@/router'
import type {
  BatchConfirmResponse,
  DuplicateGroup,
  ExtractedEntity,
  GetExtractionResponse,
  MergeEntitiesResponse,
  StartExtractionResponse,
  UpsertEntityResponse,
} from '@/types/api'

const EXTRACTION_ID = 'EXT-2024-0312'
const INTERVIEW_ID = 'INT-2024-0312'
const TRANSCRIPT_ID = 'T-2024-0312'

/** 本页涉及的后端接口，显示在页头，便于对照「数据交互节点」。 */
const ENDPOINTS = [
  'POST /extractions:start',
  'GET /extractions/{extractionId}',
  'POST /extractions/{extractionId}/entities',
  'DELETE /extractions/{extractionId}/entities/{entityId}',
  'POST /extractions/{extractionId}/entities:merge',
  'POST /extractions/{extractionId}/entities:batchConfirm',
]

const { notify } = useAppShell()
const router = useRouter()

/* 本地界面状态 */
const { form, formOpen, openCreateForm, openEditForm, closeForm, parseAliases } = useEntityForm()

const deleteTarget = ref<ExtractedEntity | null>(null)

const mergeGroup = ref<DuplicateGroup | null>(null)
const mergePrimaryId = ref('')
const mergeResult = ref<MergeResultSummary | null>(null)

const { activeEvidence, evidenceSegment, evidenceParts, openEvidence, clearEvidence } =
  useEvidenceTrace()

/* 主任务：拉取抽取结果（GET /extractions/{extractionId}） */
const extractionOptions = useExtractionTaskOptions(notify)

const { state, canRetry, isBusy, run, retry, respondConfirm, setData, reset } = useAsyncTask<
  GetExtractionResponse,
  []
>(() => extractApi.getExtraction(EXTRACTION_ID), extractionOptions)

/* 派生数据 */
const entities = computed(() => state.value.data?.entities ?? [])
const aiMeta = computed(() => state.value.data?.aiMeta ?? null)
const duplicateGroups = computed(() => state.value.data?.duplicateGroups ?? [])
const pendingEntities = computed(() =>
  entities.value.filter((item) => item.confirmStatus === 'pending'),
)

/* 筛选与分组（只影响展示，不触发写操作） */
const { kindFilter, confirmFilter, keyword, kindSummary, groupedEntities } =
  useEntityFilters(entities)

/* 其他任务：发起抽取 / 增改 / 删除 / 合并 / 批量确认 */
const {
  state: startState,
  isBusy: startBusy,
  run: startRun,
} = useAsyncTask<StartExtractionResponse, []>(() =>
  extractApi.start({
    interviewId: INTERVIEW_ID,
    transcriptId: TRANSCRIPT_ID,
    kinds: ENTITY_KINDS,
    minConfidence: mockStore.lowConfidenceThreshold,
    operator: CURRENT_OPERATOR,
  }),
)

const {
  state: upsertState,
  isBusy: upsertBusy,
  run: upsertRun,
} = useAsyncTask<UpsertEntityResponse, []>(() =>
  extractApi.upsertEntity({
    extractionId: EXTRACTION_ID,
    entityId: form.entityId || undefined,
    kind: form.kind,
    name: form.name.trim(),
    normalizedName: form.normalizedName.trim() || form.name.trim(),
    aliases: parseAliases(form.aliases),
    confirmStatus: 'confirmed',
    uncertaintyNote: form.uncertaintyNote.trim() || undefined,
    operator: CURRENT_OPERATOR,
  }),
)

const {
  state: deleteState,
  isBusy: deleteBusy,
  run: deleteRun,
} = useAsyncTask<DeleteEntityResult, []>(() =>
  extractApi.deleteEntity({
    extractionId: EXTRACTION_ID,
    entityId: deleteTarget.value?.id ?? '',
    operator: CURRENT_OPERATOR,
    reason: '人工删除（原型演示）',
  }),
)

const {
  state: mergeState,
  isBusy: mergeBusy,
  run: mergeRun,
} = useAsyncTask<MergeEntitiesResponse, []>(() =>
  extractApi.mergeEntities({
    extractionId: EXTRACTION_ID,
    primaryId: mergePrimaryId.value,
    mergedIds: mergeGroup.value
      ? mergeGroup.value.memberIds.filter((id) => id !== mergePrimaryId.value)
      : [],
    operator: CURRENT_OPERATOR,
    note: '同义项合并（原型演示）',
  }),
)

const {
  state: batchState,
  isBusy: batchBusy,
  run: batchRun,
} = useAsyncTask<BatchConfirmResponse, [BatchPayload]>((payload) =>
  extractApi.batchConfirm({
    extractionId: EXTRACTION_ID,
    entityIds: payload.entityIds,
    confirmStatus: payload.confirmStatus,
    operator: CURRENT_OPERATOR,
  }),
)

/** 写操作失败的统一提示（成功路径各自 notify）。 */
const writeError = computed(() => {
  const candidates = [
    upsertState.value.error,
    deleteState.value.error,
    mergeState.value.error,
    batchState.value.error,
    startState.value.error,
  ]
  const first = candidates.find((item) => item !== null)
  return first ? first.displayMessage : null
})

/* 写操作动作（增 / 删 / 改 / 合并 / 确认） */
const { saveEntity } = useEntitySave({
  form,
  formOpen,
  state,
  setData,
  notify,
  ids: { extractionId: EXTRACTION_ID, interviewId: INTERVIEW_ID, transcriptId: TRANSCRIPT_ID },
  runUpsert: upsertRun,
})

const { confirmDelete } = useEntityDelete({
  deleteTarget,
  activeEvidence,
  state,
  setData,
  notify,
  runDelete: deleteRun,
})

const { openMerge, openMergeForEntity, cancelMerge, confirmMerge } = useEntityMerge({
  mergeGroup,
  mergePrimaryId,
  mergeResult,
  duplicateGroups,
  state,
  setData,
  notify,
  runMerge: mergeRun,
})

const { confirmAll, rejectAll, acceptOne, rejectOne } = useEntityBatchConfirm({
  pendingEntities,
  state,
  setData,
  notify,
  runBatch: batchRun,
})

/* 7 态：发起 / 拉取 / 重置 */
function loadExtraction(): void {
  void run()
}

async function startExtraction(): Promise<void> {
  const response = await startRun()
  if (!response) return
  notify(
    'success',
    '抽取任务已发起（' +
      response.data.taskId +
      '），预估 ' +
      String(Math.max(1, Math.round(response.data.estimatedMs / 1000))) +
      ' 秒。',
  )
  await run()
}

function confirmResult(): void {
  void respondConfirm('confirmed')
}

function rejectResult(): void {
  void respondConfirm('rejected')
}

function resetFlow(): void {
  reset()
  clearEvidence()
  mergeGroup.value = null
  mergeResult.value = null
  deleteTarget.value = null
  closeForm()
  notify('info', '已重置流程 3 的界面状态。')
}

function goToSearch(): void {
  router.goToStep(4)
}
</script>

<template>
  <div class="space-y-4">
    <FlowHeader
      :step="3"
      title="提取地点 / 人物 / 事件"
      description="基于流程 2 校正后的转写稿抽取结构化实体；每条结果都保留原文依据与时间码，待确认项需人工处理后才可进入检索。"
      :phase="state.phase"
      :attempts="state.attempts"
      :endpoints="ENDPOINTS"
    >
      <template #actions>
        <BaseButton variant="ghost" size="sm" :disabled="isBusy" @click="resetFlow"
          >重置</BaseButton
        >
        <BaseButton
          variant="secondary"
          size="sm"
          :loading="startBusy"
          :disabled="isBusy"
          @click="startExtraction"
        >
          ① 发起抽取
        </BaseButton>
        <BaseButton variant="primary" size="sm" :loading="isBusy" @click="loadExtraction">
          ② 拉取抽取结果
        </BaseButton>
      </template>
    </FlowHeader>

    <!-- 写操作失败统一提示 -->
    <WriteErrorBanner
      :message="writeError"
      :start-error="startState.phase === 'error'"
      :start-busy="startBusy"
      @retry-start="startExtraction"
    />

    <AsyncStateBoundary
      :phase="state.phase"
      :error="state.error"
      :can-retry="canRetry"
      :retry-progress="state.retryProgress"
      empty-title="没有抽取到实体"
      :empty-reason="state.emptyHint?.reason"
      :empty-suggestion="state.emptyHint?.suggestion"
      :unavailable-reason="state.unavailableReason"
      loading-text="正在拉取抽取结果（GET /extractions/{extractionId}）…"
      :skeleton-rows="6"
      min-height-class="min-h-[320px]"
      @retry="retry()"
    >
      <template #idle>
        <ExtractionIdlePanel
          :busy="isBusy"
          :start-busy="startBusy"
          @start="startExtraction"
          @load="loadExtraction"
          @create="openCreateForm"
        />
      </template>

      <template #empty-actions>
        <BaseButton variant="primary" size="sm" :loading="isBusy" @click="loadExtraction"
          >重新拉取</BaseButton
        >
        <BaseButton variant="secondary" size="sm" @click="openCreateForm">手工新增实体</BaseButton>
      </template>

      <template #unavailable>
        <ExtractionUnavailablePanel
          :reason="state.unavailableReason"
          :busy="isBusy"
          @create="openCreateForm"
          @reload="loadExtraction"
          @reset="resetFlow"
        />
      </template>

      <template #error-actions>
        <BaseButton
          v-if="state.error?.code === 'auth'"
          variant="secondary"
          size="sm"
          @click="notify('warning', '请先在顶栏写入演示 Token，或接入真实登录流程。')"
        >
          如何解决？
        </BaseButton>
      </template>

      <template #default>
        <!-- 需人工确认（needsConfirm） -->
        <ExtractionConfirmPanel
          v-if="state.phase === 'confirm' && state.confirmPrompt"
          :prompt="state.confirmPrompt"
          @confirm="confirmResult"
          @cancel="rejectResult"
        />

        <!-- 成功态内容 -->
        <ExtractionResultPanel
          v-else
          v-model:kind-filter="kindFilter"
          v-model:confirm-filter="confirmFilter"
          v-model:keyword="keyword"
          :entities="entities"
          :ai-meta="aiMeta"
          :pending-count="state.data?.pendingConfirmCount ?? pendingEntities.length"
          :pending-entities="pendingEntities"
          :start-data="startState.data"
          :duplicate-groups="duplicateGroups"
          :merge-result="mergeResult"
          :active-evidence="activeEvidence"
          :evidence-segment="evidenceSegment"
          :evidence-parts="evidenceParts"
          :kind-summary="kindSummary"
          :grouped-entities="groupedEntities"
          :batch-busy="batchBusy"
          :merge-busy="mergeBusy"
          :busy="isBusy"
          @accept="acceptOne"
          @edit="openEditForm"
          @reject="rejectOne"
          @find-duplicate="openMergeForEntity"
          @delete="deleteTarget = $event"
          @open-evidence="openEvidence"
          @confirm-all="confirmAll"
          @reject-all="rejectAll"
          @create="openCreateForm"
          @merge="openMerge"
          @reload="loadExtraction"
          @clear-evidence="clearEvidence"
          @go-search="goToSearch"
        />
      </template>
    </AsyncStateBoundary>

    <!-- 手工新增 / 编辑实体（放在边界之外，NER 不可用时同样可用） -->
    <EntityFormDialog
      :open="formOpen"
      :form="form"
      :busy="upsertBusy"
      :error-message="taskErrorText(upsertState)"
      @patch="Object.assign(form, $event)"
      @confirm="saveEntity"
      @cancel="closeForm"
    />

    <!-- 删除二次确认 -->
    <DeleteEntityDialog
      :target="deleteTarget"
      :busy="deleteBusy"
      :error-message="taskErrorText(deleteState)"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />

    <!-- 合并：选择保留哪个主实体 -->
    <MergePrimaryDialog
      v-model:primary-id="mergePrimaryId"
      :group="mergeGroup"
      :entities="entities"
      :busy="mergeBusy"
      :error-message="taskErrorText(mergeState)"
      @confirm="confirmMerge"
      @cancel="cancelMerge"
    />
  </div>
</template>
