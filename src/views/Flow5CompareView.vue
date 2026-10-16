<script setup lang="ts">
/**
 * 流程 5：标注一致或有差异之处（编排层）。
 *
 * 本文件只保留 imports、接口调用入口、顶层布局与编排：7 态状态机、左右对照 + 逐条标注的
 * 工作台、提交条与二次确认的事件转发；职责实现分别在：
 * - useComparisonMeta（结论 / 分类 / 可信度映射与草稿判定规则）、useComparisonDrafts（草稿 / 基线）
 * - useComparisonStats（统计与筛选）、useAnnotationSubmit（增量保存 / 提交整批）
 * - useItemRejudge（单条 AI 重判）、useClaimSegments（原文回跳与字符级差异）
 * - components/flow5/（进度面板、逐条卡片及其左右对照 / 判定子块）
 *
 * 待确认：
 * - TODO-CMP-1：submitAnnotations 的 submitAll=true 在真实后端是否要求 items 全覆盖未定义，
 *   本页按「提交全部已标注条目」处理，并在二次确认里写明；
 * - TODO-CMP-2：AnnotationStats.disagreedWithAi 只在服务端统计已保存标注，
 *   界面上的实时「与 AI 不一致」数由本地草稿推导，二者可能暂时不一致。
 */
import { computed, ref } from 'vue'

import { compareApi } from '@/api'
import AppIcon from '@/components/common/AppIcon.vue'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import FlowHeader from '@/components/common/FlowHeader.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import AnnotationProgressPanel from '@/components/flow5/AnnotationProgressPanel.vue'
import AnnotationSubmitBar from '@/components/flow5/AnnotationSubmitBar.vue'
import ComparisonConfirmBanner from '@/components/flow5/ComparisonConfirmBanner.vue'
import ComparisonItemCard from '@/components/flow5/ComparisonItemCard.vue'
import ComparisonTaskEntry from '@/components/flow5/ComparisonTaskEntry.vue'
import SubmitAllConfirmDialog from '@/components/flow5/SubmitAllConfirmDialog.vue'
import ToolInvokePanel from '@/components/tools/ToolInvokePanel.vue'
import { useAnnotationSubmit } from '@/composables/useAnnotationSubmit'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { useClaimSegments } from '@/composables/useClaimSegments'
import { useComparisonDrafts } from '@/composables/useComparisonDrafts'
import { useComparisonStats } from '@/composables/useComparisonStats'
import { useItemRejudge } from '@/composables/useItemRejudge'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import { mockStore } from '@/mock/store'
import { useRouter } from '@/router'
import type { ApiResponse } from '@/services/api/httpClient'
import type { ComparisonItem, GetComparisonResponse } from '@/types/api'

const { notify } = useAppShell()

/**
 * AI 工具契约层的默认入参。
 * 定义成模块级常量以保证引用稳定——若在模板里内联对象字面量，
 * 每次渲染都会生成新对象并覆盖用户在面板中编辑的 JSON。
 */
const TOOL_COMPARE_INPUT: Record<string, unknown> = {
  claimIds: ['C-01', 'C-02', 'C-03', 'C-04', 'C-05'],
  strictMode: false,
}
const router = useRouter()

/** 演示用比对任务 id（真实环境由流程 6 生成草稿后返回）。 */
const COMPARISON_ID = 'CMP-2024-0007'
/** 待比对草稿，来自流程 6 的生成结果。 */
const draftId = mockStore.generation.draftId

/* ---- 比对任务（7 态状态机） ---- */

const enableAutoJudge = ref(true)
/** 本次 run 是「重新发起 AI 初判」还是「拉取已有结果」。 */
let mode: 'load' | 'start' = 'load'
/** 比对能力不可用时的降级：用本地缓存做纯人工标注。 */
const manualMode = ref(false)

/**
 * 按当前模式发起比对：start 走重新发起，load 走读取已有结果。
 * @returns 比对任务响应；start 分支会把缺省的 status 补齐为成功态
 */
async function requestComparison(): Promise<ApiResponse<GetComparisonResponse>> {
  if (mode === 'start') {
    const response = await compareApi.start({
      draftId,
      enableAutoJudge: enableAutoJudge.value,
      maxSourcesPerClaim: 2,
      operator: CURRENT_OPERATOR,
    })
    // StartComparisonResponse 没有 status 字段，补齐为成功态后再进入统一状态机
    return { ...response, data: { ...response.data, status: 'succeeded' as const } }
  }
  return compareApi.getComparison(COMPARISON_ID)
}

const { state, canRetry, isBusy, run, retry, respondConfirm, reset } = useAsyncTask<
  GetComparisonResponse,
  []
>(requestComparison, {
  isEmpty: (data) => data.items.length === 0,
  emptyHint: {
    reason: '本次比对没有返回任何比对项。',
    suggestion: '请确认草稿 draftId 是否正确，或先到流程 6 生成故事卡 / 讲稿后再发起比对。',
  },
  // 未标注条数 > 0 时先让用户确认再进入标注工作台
  needsConfirm: (data) =>
    data.stats.annotated < data.stats.total
      ? {
          title: '本批次还有未标注的比对项',
          message: `共 ${data.stats.total} 条比对项，其中 ${data.stats.total - data.stats.annotated} 条尚未标注（已标注 ${data.stats.annotated} 条，进度 ${(data.stats.progress * 100).toFixed(0)}%）。`,
          details: [
            `与 AI 初判不一致：${data.stats.disagreedWithAi} 条`,
            `判定为「差异」：${data.stats.conflict} 条 · 「待核实」：${data.stats.needsVerification} 条 · 「资料不足」：${data.stats.insufficient} 条`,
            '确认后可逐条标注；提交时会再次校验未标注条数。',
          ],
          confirmText: '进入标注工作台',
          cancelText: '暂不处理',
        }
      : null,
})

/** 拉取已有的比对结果。 */
function loadComparison(): void {
  mode = 'load'
  void run()
}

/** 重新发起 AI 初判。 */
function startComparison(): void {
  mode = 'start'
  void run()
}

/* ---- 比对项与标注工作台 ---- */

/** 当前展示的比对项：人工模式下来自本地缓存。 */
const items = computed<ComparisonItem[]>(() => {
  if (manualMode.value) return mockStore.comparisonItems
  return state.value.data?.items ?? []
})

const drafts = useComparisonDrafts({ items, notify })
const stats = useComparisonStats({
  items,
  drafts,
  serverStatsSource: computed(() => state.value.data?.stats ?? null),
})
const submit = useAnnotationSubmit({
  comparisonId: COMPARISON_ID,
  annotator: CURRENT_OPERATOR,
  drafts,
  stats,
  notify,
})
const rejudge = useItemRejudge({
  comparisonId: COMPARISON_ID,
  notify,
  disagreesWithAi: drafts.disagreesWithAi,
})
const segments = useClaimSegments()

const { dirtyCount, missingCount, reasonIssueCount, allInputs, liveStats, serverStats } = stats
const { filterMode, currentFilterLabel, visibleItems } = stats
const {
  invalidMessages,
  draftVerdict,
  draftReason,
  draftTags,
  effectiveVerdict,
  disagreesWithAi,
  reasonError,
  isDirty,
  setVerdict,
  setReason,
  toggleReasonTag,
  adoptAi,
  clearDraft,
} = drafts
const { rejudgeItemId, rejudgeHints, rejudgeState, rejudgeBusy, toggleRejudge, requestRejudge } =
  rejudge
const { claimSegment, isOpen, segmentOpenIds, diffOpenIds, toggleSegment, toggleDiff } = segments
const {
  submitAllMode,
  submitAllModalOpen,
  submitState,
  submitBusy,
  saveAnnotations,
  openSubmitAll,
  confirmSubmitAll,
} = submit

/* ---- 7 态聚合与降级 ---- */

/** 切到本地缓存人工标注后，用默认插槽渲染标注工作台，而不是不可用占位。 */
const boundaryPhase = computed(() => (manualMode.value ? 'success' : state.value.phase))

const totalAttempts = computed(
  () => state.value.attempts + submitState.value.attempts + rejudgeState.value.attempts,
)

const aiMeta = computed(() => state.value.data?.aiMeta)

/** 比对能力不可用时，切换到本地缓存做纯人工标注。 */
function enterManualMode(): void {
  manualMode.value = true
  notify(
    'warning',
    '已切换到本地缓存的人工标注模式',
    'AI 初判 / 重判与保存接口可能仍不可用，但界面允许逐条人工标注，输入不会因为保存失败而丢失。',
  )
}

/** 退出人工标注模式，回到比对任务入口。 */
function exitManualMode(): void {
  manualMode.value = false
  reset()
  notify('info', '已退出人工标注模式，回到比对任务入口。')
}
</script>

<template>
  <div class="space-y-4">
    <FlowHeader
      :step="5"
      title="标注一致或有差异之处"
      description="把 AI 创作内容与检索资料逐条配对核查：先看 AI 初判与理由，再由人给出最终结论。判为「差异 / 待核实」必须写明原因，这些原因会沉淀为后续创作的约束。"
      :phase="boundaryPhase"
      :attempts="totalAttempts"
      :endpoints="[
        'POST /comparisons:start',
        'GET /comparisons/{comparisonId}',
        'POST /comparisons/{comparisonId}/annotations',
        'POST /comparisons/{comparisonId}/items/{itemId}:rejudge',
      ]"
    >
      <template #actions>
        <StatusPill tone="neutral" dense>比对任务 {{ COMPARISON_ID }}</StatusPill>
        <StatusPill tone="violet" dense
          >标注人 {{ CURRENT_OPERATOR.name }} · {{ CURRENT_OPERATOR.role }}</StatusPill
        >
        <StatusPill v-if="manualMode" tone="warning" dense>纯人工标注模式</StatusPill>
      </template>
    </FlowHeader>

    <AsyncStateBoundary
      :phase="boundaryPhase"
      :error="state.error"
      :can-retry="canRetry"
      :retry-progress="state.retryProgress"
      :empty-reason="state.emptyHint?.reason"
      :empty-suggestion="state.emptyHint?.suggestion"
      :unavailable-reason="state.unavailableReason"
      empty-title="没有可标注的比对项"
      loading-text="正在拉取比对结果（AI 初判中）…"
      :skeleton-rows="6"
      min-height-class="min-h-[260px]"
      @retry="retry()"
    >
      <div class="space-y-4">
        <!-- 7 态之一：未标注条数提示，需人工确认 -->
        <ComparisonConfirmBanner
          v-if="state.phase === 'confirm' && state.confirmPrompt"
          :prompt="state.confirmPrompt"
          @confirm="respondConfirm('confirmed')"
          @reject="respondConfirm('rejected')"
        />

        <!-- 降级：纯人工标注 -->
        <div
          v-if="manualMode"
          class="flex flex-wrap items-center gap-2 border border-attention bg-attention px-3 py-2 text-2xs text-attention"
        >
          <span aria-hidden="true"><AppIcon name="sliders" :size="14" /></span>
          <span>
            当前为「纯人工标注」模式：AI 比对能力不可用，条目来自本地缓存；保存请求也可能失败，
            失败时界面输入不会丢失，可待能力恢复后再提交。
          </span>
          <BaseButton variant="ghost" size="sm" class="ml-auto" @click="exitManualMode">
            退出人工模式
          </BaseButton>
        </div>

        <!-- 标注进度与筛选 -->
        <AnnotationProgressPanel
          v-model:filter-mode="filterMode"
          :comparison-id="COMPARISON_ID"
          :draft-id="draftId"
          :annotator-name="CURRENT_OPERATOR.name"
          :ai-meta="aiMeta"
          :server-stats="serverStats"
          :task-status="state.data?.status"
          :failure-reason="state.data?.failureReason"
          :live-stats="liveStats"
          :dirty-count="dirtyCount"
        />

        <!-- 逐条标注 -->
        <PanelSection
          title="逐条标注"
          :description="`当前筛选：${currentFilterLabel} · 展示 ${visibleItems.length} 条`"
        >
          <EmptyState
            v-if="visibleItems.length === 0"
            icon="folder"
            :title="manualMode ? '本地缓存里没有比对项' : '没有符合筛选条件的比对项'"
            :description="
              manualMode
                ? '比对能力不可用且本地缓存为空，请先回到流程 6 生成草稿，或等能力恢复后重新发起比对。'
                : '切换到「全部」查看所有条目，或调整筛选条件。'
            "
          >
            <BaseButton variant="ghost" size="sm" @click="filterMode = 'all'">查看全部</BaseButton>
          </EmptyState>

          <div v-else class="space-y-3">
            <ComparisonItemCard
              v-for="item in visibleItems"
              :key="item.itemId"
              v-model:rejudge-hints="rejudgeHints"
              :item="item"
              :verdict="draftVerdict(item)"
              :reason="draftReason(item)"
              :tags="draftTags(item)"
              :effective-verdict="effectiveVerdict(item)"
              :disagree="disagreesWithAi(item)"
              :dirty="isDirty(item)"
              :invalid-message="invalidMessages[item.itemId]"
              :reason-error="reasonError(item.itemId)"
              :segment="claimSegment(item)"
              :segment-open="isOpen(segmentOpenIds, item.itemId)"
              :diff-open="isOpen(diffOpenIds, item.itemId)"
              :rejudge-open="rejudgeItemId === item.itemId"
              :rejudge-busy="rejudgeBusy"
              :rejudge-error-message="rejudgeState.error?.displayMessage"
              :rejudge-result="rejudgeState.data"
              @set-verdict="setVerdict(item.itemId, $event)"
              @set-reason="setReason(item.itemId, $event)"
              @toggle-tag="toggleReasonTag(item.itemId, $event)"
              @adopt="adoptAi(item)"
              @clear-draft="clearDraft(item.itemId)"
              @toggle-segment="toggleSegment(item.itemId)"
              @toggle-diff="toggleDiff(item.itemId)"
              @toggle-rejudge="toggleRejudge(item.itemId)"
              @request-rejudge="requestRejudge"
            />
          </div>
        </PanelSection>

        <!-- 提交条 -->
        <AnnotationSubmitBar
          :dirty-count="dirtyCount"
          :missing-count="missingCount"
          :reason-issue-count="reasonIssueCount"
          :submit-attempts="submitState.attempts"
          :submit-error="submitState.error?.displayMessage"
          :submit-busy="submitBusy"
          :submit-all-mode="submitAllMode"
          :annotated-count="liveStats.annotated"
          :task-busy="isBusy"
          :comparison-id="COMPARISON_ID"
          :annotator-name="CURRENT_OPERATOR.name"
          :annotator-role="CURRENT_OPERATOR.role"
          @save="saveAnnotations"
          @submit-all="openSubmitAll"
          @reload="loadComparison"
        />
      </div>

      <!-- idle -->
      <template #idle>
        <ComparisonTaskEntry
          v-model:enable-auto-judge="enableAutoJudge"
          kind="idle"
          :busy="isBusy"
          :comparison-id="COMPARISON_ID"
          :draft-id="draftId"
          @load="loadComparison"
          @start="startComparison"
        />
      </template>

      <!-- empty -->
      <template #empty-actions>
        <ComparisonTaskEntry
          v-model:enable-auto-judge="enableAutoJudge"
          kind="empty"
          :busy="isBusy"
          :comparison-id="COMPARISON_ID"
          :draft-id="draftId"
          @load="loadComparison"
          @start="startComparison"
          @go-step="router.goToStep"
        />
      </template>

      <!-- unavailable -->
      <template #unavailable-actions>
        <ComparisonTaskEntry
          v-model:enable-auto-judge="enableAutoJudge"
          kind="unavailable"
          :busy="isBusy"
          :comparison-id="COMPARISON_ID"
          :draft-id="draftId"
          @manual="enterManualMode"
          @go-step="router.goToStep"
        />
      </template>

      <!-- error -->
      <template #error-actions>
        <ComparisonTaskEntry
          v-model:enable-auto-judge="enableAutoJudge"
          kind="error"
          :busy="isBusy"
          :comparison-id="COMPARISON_ID"
          :draft-id="draftId"
          @start="startComparison"
        />
      </template>
    </AsyncStateBoundary>

    <!-- 提交整批前的二次确认 -->
    <SubmitAllConfirmDialog
      :open="submitAllModalOpen"
      :stats="liveStats"
      :missing-count="missingCount"
      :submit-count="allInputs.length"
      :reason-issue-count="reasonIssueCount"
      :annotator-id="CURRENT_OPERATOR.id"
      :loading="submitBusy"
      @confirm="confirmSubmitAll"
      @cancel="submitAllModalOpen = false"
    />

    <ToolInvokePanel
      tool="compare_claims"
      title="论断一致性核查（工具契约层）"
      description="走 compare_claims 工具契约：一次提交多条论断，返回逐条判定（supported / partial / contradicted / unverified）、置信度、理由说明与正反来源集合。可作为上方逐条标注的旁证——两者结论不一致时，正是最需要人工复核的地方。claimIds 取自四工具数据集 src/data/demoProject.ts。"
      :input="TOOL_COMPARE_INPUT"
    />
  </div>
</template>
