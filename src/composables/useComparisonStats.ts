/**
 * 流程 5 的标注统计与筛选视图。
 *
 * 唯一职责：由当前比对项与草稿推导实时统计（7 张卡的数值）、提交前校验计数
 * （未标注 / 缺少原因 / 本次变更 / 全部已标注）和当前筛选下的可见条目，
 * 并把服务端统计合并成展示口径。
 */
import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import { annotationFilterLabel } from '@/composables/useComparisonMeta'
import type { AnnotationFilterMode } from '@/composables/useComparisonMeta'
import type { ComparisonDraftsApi } from '@/composables/useComparisonDrafts'
import type { AnnotationInput, AnnotationStats, CompareVerdict, ComparisonItem } from '@/types/api'

/** useComparisonStats 的入参。 */
export interface UseComparisonStatsOptions {
  /** 当前展示的比对项（人工模式下来自本地缓存）。 */
  items: ComputedRef<ComparisonItem[]>
  /** 逐条标注草稿的操作面。 */
  drafts: ComparisonDraftsApi
  /** 服务端最近一次返回的统计。 */
  serverStatsSource: ComputedRef<AnnotationStats | null>
}

/**
 * 标注统计与筛选的组合式函数。
 * @param options 入参：当前比对项、草稿操作面与服务端统计来源
 * @returns 实时 / 服务端统计、提交前计数、筛选状态与可见条目
 */
export function useComparisonStats(options: UseComparisonStatsOptions) {
  const { items, drafts, serverStatsSource } = options

  const dirtyCount = computed(() => items.value.filter((item) => drafts.isDirty(item)).length)

  const changedInputs = computed<AnnotationInput[]>(() =>
    items.value
      .filter((item) => drafts.isDirty(item) && drafts.draftVerdict(item) !== null)
      .map((item) => drafts.toInput(item)),
  )

  const allInputs = computed<AnnotationInput[]>(() =>
    items.value
      .filter((item) => drafts.draftVerdict(item) !== null)
      .map((item) => drafts.toInput(item)),
  )

  const missingCount = computed(
    () => items.value.filter((item) => drafts.draftVerdict(item) === null).length,
  )

  const reasonIssueCount = computed(
    () => items.value.filter((item) => drafts.reasonError(item.itemId) !== null).length,
  )

  const liveStats = computed<AnnotationStats>(() => {
    const list = items.value
    const annotatedItems = list.filter((item) => drafts.draftVerdict(item) !== null)
    const countOf = (verdict: CompareVerdict): number =>
      annotatedItems.filter((item) => drafts.draftVerdict(item) === verdict).length

    return {
      total: list.length,
      annotated: annotatedItems.length,
      progress: list.length > 0 ? Number((annotatedItems.length / list.length).toFixed(4)) : 0,
      consistent: countOf('consistent'),
      conflict: countOf('conflict'),
      needsVerification: countOf('needs_verification'),
      insufficient: countOf('insufficient'),
      disagreedWithAi: annotatedItems.filter((item) => drafts.draftVerdict(item) !== item.aiVerdict)
        .length,
    }
  })

  /** 服务端统计（最近一次读取 / 提交后的结果）。 */
  const serverStats = computed<AnnotationStats | null>(
    () => drafts.statsOverride.value ?? serverStatsSource.value,
  )

  /** 当前筛选模式。 */
  const filterMode = ref<AnnotationFilterMode>('all')

  const currentFilterLabel = computed(() => annotationFilterLabel(filterMode.value))

  const visibleItems = computed<ComparisonItem[]>(() => {
    const list = items.value
    switch (filterMode.value) {
      case 'unannotated':
        return list.filter((item) => drafts.draftVerdict(item) === null)
      case 'annotated':
        return list.filter((item) => drafts.draftVerdict(item) !== null)
      case 'disagreed':
        return list.filter((item) => drafts.disagreesWithAi(item))
      default:
        return list
    }
  })

  return {
    dirtyCount,
    changedInputs,
    allInputs,
    missingCount,
    reasonIssueCount,
    liveStats,
    serverStats,
    filterMode,
    currentFilterLabel,
    visibleItems,
  }
}
/** 标注统计与筛选视图的操作面。 */
export type ComparisonStatsApi = ReturnType<typeof useComparisonStats>
