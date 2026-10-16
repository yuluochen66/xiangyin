<script setup lang="ts">
/**
 * 单条比对项的标注卡片。
 *
 * 唯一职责：把一条比对项编排成完整的工作单元——状态头、左右对照、原文回跳 /
 * 字符级差异的展开开关、AI 判定区与人工判定区，并把用户操作原样上抛给父级。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import AiVerdictPanel from '@/components/flow5/AiVerdictPanel.vue'
import ClaimSegmentBlock from '@/components/flow5/ClaimSegmentBlock.vue'
import ClaimSourceCompare from '@/components/flow5/ClaimSourceCompare.vue'
import HumanVerdictPanel from '@/components/flow5/HumanVerdictPanel.vue'
import ReviewDiffViewer from '@/components/review/ReviewDiffViewer.vue'
import { VERDICT_META } from '@/composables/useComparisonMeta'
import type {
  CompareVerdict,
  ComparisonItem,
  ConflictReasonTag,
  RejudgeItemResponse,
  TranscriptSegmentDTO,
} from '@/types/api'

interface Props {
  /** 单条比对项。 */
  item: ComparisonItem
  /** 该条当前的草稿结论；未标注时为 null。 */
  verdict: CompareVerdict | null
  /** 该条当前的草稿原因。 */
  reason: string
  /** 该条当前选中的差异原因分类。 */
  tags: ConflictReasonTag[]
  /** 该条最终生效的判定（人工优先于 AI）。 */
  effectiveVerdict: CompareVerdict
  /** 该条人工结论是否与 AI 初判不一致。 */
  disagree: boolean
  /** 该条是否有未保存改动。 */
  dirty: boolean
  /** 服务端返回的就地校验提示。 */
  invalidMessage: string | undefined
  /** 必填校验提示；无错误时为 null。 */
  reasonError: string | null
  /** 该条关联的采访转写片段。 */
  segment: TranscriptSegmentDTO | undefined
  /** 该条的原文片段是否展开。 */
  segmentOpen: boolean
  /** 该条的字符级差异是否展开。 */
  diffOpen: boolean
  /** 该条的重判面板是否展开。 */
  rejudgeOpen: boolean
  /** 该条是否正在重判。 */
  rejudgeBusy: boolean
  /** 重判失败的就地提示。 */
  rejudgeErrorMessage: string | undefined
  /** 最近一次重判结果（全局唯一）。 */
  rejudgeResult: RejudgeItemResponse | null
}

defineProps<Props>()

/** 人工补充的重判上下文，透传给 AI 判定区。 */
const rejudgeHints = defineModel<string>('rejudgeHints', { required: true })

const emit = defineEmits<{
  setVerdict: [verdict: CompareVerdict]
  setReason: [event: Event]
  toggleTag: [tag: ConflictReasonTag]
  adopt: []
  clearDraft: []
  toggleSegment: []
  toggleDiff: []
  toggleRejudge: []
  requestRejudge: []
}>()
</script>

<template>
  <article
    class="space-y-2.5 border p-3 transition-colors"
    :class="
      invalidMessage
        ? 'border-vermilion bg-vermilion-wash'
        : disagree
          ? 'border-seal-2 bg-seal'
          : 'border-rule bg-paper'
    "
  >
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="font-mono text-2xs text-ink-4">{{ item.itemId }}</span>
      <StatusPill :tone="VERDICT_META[item.aiVerdict].tone" dense>
        AI 初判 {{ VERDICT_META[item.aiVerdict].label }}
      </StatusPill>
      <StatusPill :tone="VERDICT_META[effectiveVerdict].tone" dense>
        当前结论 {{ VERDICT_META[effectiveVerdict].label }}
      </StatusPill>
      <StatusPill v-if="verdict === null" tone="warning" dense>未标注</StatusPill>
      <StatusPill v-else tone="success" dense>已标注</StatusPill>
      <StatusPill v-if="disagree" tone="danger" dense>与 AI 不一致</StatusPill>
      <StatusPill v-if="dirty" tone="violet" dense>有未保存改动</StatusPill>
      <span v-if="item.claimBlockId" class="ml-auto font-mono text-2xs text-ink-4">
        {{ item.claimBlockId }}
      </span>
    </div>

    <ClaimSourceCompare :item="item" />

    <div class="flex flex-wrap items-center gap-1.5">
      <BaseButton variant="ghost" size="sm" @click="emit('toggleSegment')">
        {{
          segmentOpen
            ? '收起原文片段'
            : `查看原文片段${item.claimSegmentId ? `（${item.claimSegmentId}）` : ''}`
        }}
      </BaseButton>
      <BaseButton v-if="item.source" variant="ghost" size="sm" @click="emit('toggleDiff')">
        {{ diffOpen ? '收起字符级差异' : '展开字符级差异（论断 vs 资料摘录）' }}
      </BaseButton>
    </div>

    <ClaimSegmentBlock v-if="segmentOpen" :segment="segment" />

    <ReviewDiffViewer
      v-if="item.source && diffOpen"
      :original="item.claimText"
      :revised="item.source.excerpt"
      :show-stats="true"
    />

    <AiVerdictPanel
      v-model:rejudge-hints="rejudgeHints"
      :item="item"
      :rejudge-open="rejudgeOpen"
      :rejudge-busy="rejudgeBusy"
      :rejudge-error-message="rejudgeErrorMessage"
      :rejudge-result="rejudgeResult"
      @adopt="emit('adopt')"
      @toggle-rejudge="emit('toggleRejudge')"
      @request-rejudge="emit('requestRejudge')"
    />

    <HumanVerdictPanel
      :verdict="verdict"
      :reason="reason"
      :tags="tags"
      :dirty="dirty"
      :invalid-message="invalidMessage"
      :reason-error="reasonError"
      @set-verdict="emit('setVerdict', $event)"
      @set-reason="emit('setReason', $event)"
      @toggle-tag="emit('toggleTag', $event)"
      @clear-draft="emit('clearDraft')"
    />
  </article>
</template>
