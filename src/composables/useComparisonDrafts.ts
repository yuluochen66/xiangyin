/**
 * 流程 5 的逐条标注草稿管理。
 *
 * 唯一职责：维护「界面草稿」与「已保存基线」两份输入，暴露逐条读数与标注动作
 * （选结论 / 写原因 / 选分类 / 采纳 AI 初判 / 放弃本条改动），并在提交成功后
 * 只把实际写入的条目推进为新的基线；判定规则本身由 useComparisonMeta 提供。
 */
import { ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import {
  disagreesWithAiOf,
  effectiveVerdictOf,
  isDirtyOf,
  needsReason,
  reasonErrorOf,
  snapshotOf,
  toInputOf,
} from '@/composables/useComparisonDraftRules'
import type { ComparisonNotify, DraftAnnotation } from '@/composables/useComparisonDraftRules'
import { VERDICT_META } from '@/composables/useComparisonMeta'
import type {
  AnnotationInput,
  AnnotationStats,
  CompareVerdict,
  ComparisonItem,
  ConflictReasonTag,
  SubmitAnnotationsResponse,
} from '@/types/api'

/** useComparisonDrafts 的入参。 */
export interface UseComparisonDraftsOptions {
  /** 当前展示的比对项（人工模式下来自本地缓存）。 */
  items: ComputedRef<ComparisonItem[]>
  /** 全局提示。 */
  notify: ComparisonNotify
}

/**
 * 逐条标注草稿的组合式函数。
 * @param options 入参：当前比对项列表与全局提示函数
 * @returns 草稿 / 基线 / 就地错误 / 服务端统计，逐条读数函数，标注动作与提交结果落库函数
 */
export function useComparisonDrafts(options: UseComparisonDraftsOptions) {
  const { items, notify } = options

  /** 最近一次读取 / 保存后的基线值。 */
  const baseline = ref<Record<string, DraftAnnotation>>({})
  /** 界面上的草稿输入。 */
  const drafts = ref<Record<string, DraftAnnotation>>({})
  /** 服务端校验失败的就地提示。 */
  const invalidMessages = ref<Record<string, string>>({})
  /** 服务端返回的统计（提交后以响应为准）。 */
  const statsOverride = ref<AnnotationStats | null>(null)

  watch(
    items,
    (list) => {
      const nextBaseline: Record<string, DraftAnnotation> = {}
      const nextDrafts: Record<string, DraftAnnotation> = {}
      for (const item of list) {
        nextBaseline[item.itemId] = snapshotOf(item)
        nextDrafts[item.itemId] = snapshotOf(item)
      }
      baseline.value = nextBaseline
      drafts.value = nextDrafts
      statsOverride.value = null
      invalidMessages.value = {}
    },
    { immediate: true },
  )

  // 更新某条草稿，并清掉这条上一次的服务端校验提示。
  function updateDraft(itemId: string, updater: (draft: DraftAnnotation) => DraftAnnotation): void {
    const current = drafts.value[itemId]
    if (!current) return
    drafts.value[itemId] = updater(current)
    if (invalidMessages.value[itemId] !== undefined) {
      const next = { ...invalidMessages.value }
      delete next[itemId]
      invalidMessages.value = next
    }
  }

  // 某条的草稿结论；未标注时为 null。
  function draftVerdict(item: ComparisonItem): CompareVerdict | null {
    return drafts.value[item.itemId]?.verdict ?? null
  }

  // 某条的草稿原因文本。
  function draftReason(item: ComparisonItem): string {
    return drafts.value[item.itemId]?.reason ?? ''
  }

  // 某条已选中的差异原因分类。
  function draftTags(item: ComparisonItem): ConflictReasonTag[] {
    return drafts.value[item.itemId]?.reasonTags ?? []
  }

  // 某条最终生效的判定（人工优先于 AI）。
  function effectiveVerdict(item: ComparisonItem): CompareVerdict {
    return effectiveVerdictOf(item, drafts.value[item.itemId])
  }

  // 某条的人工结论是否与 AI 初判不一致。
  function disagreesWithAi(item: ComparisonItem): boolean {
    return disagreesWithAiOf(item, drafts.value[item.itemId])
  }

  // 某条的必填校验结果；无错误时为空。
  function reasonError(itemId: string): string | null {
    return reasonErrorOf(drafts.value[itemId])
  }

  // 某条是否有未保存改动。
  function isDirty(item: ComparisonItem): boolean {
    return isDirtyOf(drafts.value[item.itemId], baseline.value[item.itemId])
  }

  // 把某条草稿转成接口提交体。
  function toInput(item: ComparisonItem): AnnotationInput {
    return toInputOf(item, drafts.value[item.itemId])
  }

  // 设置某条的结论。
  function setVerdict(itemId: string, verdict: CompareVerdict): void {
    updateDraft(itemId, (draft) => ({ ...draft, verdict }))
  }

  // 写入某条的差异原因。
  function setReason(itemId: string, event: Event): void {
    const target = event.target as HTMLTextAreaElement
    updateDraft(itemId, (draft) => ({ ...draft, reason: target.value }))
  }

  // 切换某条的差异原因分类。
  function toggleReasonTag(itemId: string, tag: ConflictReasonTag): void {
    updateDraft(itemId, (draft) => ({
      ...draft,
      reasonTags: draft.reasonTags.includes(tag)
        ? draft.reasonTags.filter((item) => item !== tag)
        : [...draft.reasonTags, tag],
    }))
  }

  // 采纳 AI 初判：结论取 aiVerdict，必填原因预填 aiReason，分类沿用 aiReasonTags。
  function adoptAi(item: ComparisonItem): void {
    updateDraft(item.itemId, (draft) => ({
      ...draft,
      verdict: item.aiVerdict,
      reason: needsReason(item.aiVerdict) ? item.aiReason : draft.reason,
      reasonTags: item.aiReasonTags.length > 0 ? [...item.aiReasonTags] : draft.reasonTags,
    }))
    notify(
      'info',
      `已采纳 AI 初判（${VERDICT_META[item.aiVerdict].label}）`,
      needsReason(item.aiVerdict)
        ? '差异原因已预填 AI 理由，可直接修改后保存。'
        : '保存前仍可人工调整。',
    )
  }

  // 丢弃本条未保存的输入，回到已保存基线。
  function clearDraft(itemId: string): void {
    const saved = baseline.value[itemId]
    const item = items.value.find((entry) => entry.itemId === itemId)
    if (!saved || !item) return
    drafts.value[itemId] = {
      verdict: saved.verdict,
      reason: saved.reason,
      reasonTags: [...saved.reasonTags],
    }
    notify('info', `已放弃 ${itemId} 未保存的输入。`)
  }

  // 提交成功后：就地记录服务端校验失败原因，把实际写入的条目推进为新的基线。
  function applySubmitResult(
    attempted: AnnotationInput[],
    result: SubmitAnnotationsResponse,
  ): void {
    const invalidIds = new Set(result.invalid.map((issue) => issue.itemId))
    const nextInvalid: Record<string, string> = {}
    for (const issue of result.invalid) nextInvalid[issue.itemId] = issue.message
    invalidMessages.value = nextInvalid

    const nextBaseline = { ...baseline.value }
    for (const input of attempted) {
      if (invalidIds.has(input.itemId)) continue
      nextBaseline[input.itemId] = {
        verdict: input.verdict,
        reason: input.reason,
        reasonTags: [...input.reasonTags],
      }
    }
    baseline.value = nextBaseline
    statsOverride.value = result.stats
  }

  return {
    drafts,
    baseline,
    invalidMessages,
    statsOverride,
    draftVerdict,
    draftReason,
    draftTags,
    effectiveVerdict,
    disagreesWithAi,
    reasonError,
    isDirty,
    toInput,
    setVerdict,
    setReason,
    toggleReasonTag,
    adoptAi,
    clearDraft,
    applySubmitResult,
  }
}

/** 逐条标注草稿的操作面。 */
export type ComparisonDraftsApi = ReturnType<typeof useComparisonDrafts>
