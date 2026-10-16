/**
 * 审校对照的差异计算包装。
 *
 * 单纯把 `compareText` 接到响应式上：原文或修订稿变化时自动重算，
 * 并额外给出「是否需要对照」的判断，避免无差异时渲染多余 UI。
 */
import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { compareText } from '@/utils/diff'
import type { DiffBlock, DiffStats } from '@/utils/diff'

export interface UseReviewDiffApi {
  blocks: ComputedRef<DiffBlock[]>
  stats: ComputedRef<DiffStats>
  /** 两侧完全一致。 */
  isIdentical: ComputedRef<boolean>
  /** 相似度百分比文本，例如 "82%"。 */
  similarityText: ComputedRef<string>
}

export function useReviewDiff(original: Ref<string>, revised: Ref<string>): UseReviewDiffApi {
  const result = computed(() => compareText(original.value, revised.value))

  const blocks = computed(() => result.value.blocks)
  const stats = computed(() => result.value.stats)
  const isIdentical = computed(() => stats.value.changeBlocks === 0)
  const similarityText = computed(() => `${Math.round(stats.value.similarity * 100)}%`)

  return { blocks, stats, isIdentical, similarityText }
}
