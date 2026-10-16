/**
 * 流程 5 的原文回跳与字符级差异展开。
 *
 * 唯一职责：建立采访转写片段的 id 索引，并维护「哪些条目展开了原文片段 /
 * 字符级差异」这两套开关，供逐条标注卡片就地展开或收起。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { mockStore } from '@/mock/store'
import type { ComparisonItem, TranscriptSegmentDTO } from '@/types/api'

/** 原文片段索引与展开开关的操作面。 */
export interface ClaimSegmentsApi {
  /** 片段 id 到转写片段的索引。 */
  segmentById: ComputedRef<Record<string, TranscriptSegmentDTO>>
  /** 已展开原文片段的比对项 id。 */
  segmentOpenIds: Ref<string[]>
  /** 已展开字符级差异的比对项 id。 */
  diffOpenIds: Ref<string[]>
  claimSegment(item: ComparisonItem): TranscriptSegmentDTO | undefined
  isOpen(list: string[], id: string): boolean
  toggleSegment(itemId: string): void
  toggleDiff(itemId: string): void
}

/**
 * 原文片段索引与展开开关的组合式函数。
 * @returns 片段索引、两组展开列表，以及读取片段与切换展开状态的函数
 */
export function useClaimSegments(): ClaimSegmentsApi {
  const segmentById = computed<Record<string, TranscriptSegmentDTO>>(() => {
    const map: Record<string, TranscriptSegmentDTO> = {}
    for (const segment of mockStore.segments) map[segment.id] = segment
    return map
  })

  const segmentOpenIds = ref<string[]>([])
  const diffOpenIds = ref<string[]>([])

  // 取某条论断关联的转写片段。
  function claimSegment(item: ComparisonItem): TranscriptSegmentDTO | undefined {
    return item.claimSegmentId !== undefined ? segmentById.value[item.claimSegmentId] : undefined
  }

  // 判断某个 id 是否在展开列表里。
  function isOpen(list: string[], id: string): boolean {
    return list.includes(id)
  }

  // 切换某条原文片段的展开状态。
  function toggleSegment(itemId: string): void {
    segmentOpenIds.value = segmentOpenIds.value.includes(itemId)
      ? segmentOpenIds.value.filter((id) => id !== itemId)
      : [...segmentOpenIds.value, itemId]
  }

  // 切换某条字符级差异的展开状态。
  function toggleDiff(itemId: string): void {
    diffOpenIds.value = diffOpenIds.value.includes(itemId)
      ? diffOpenIds.value.filter((id) => id !== itemId)
      : [...diffOpenIds.value, itemId]
  }

  return {
    segmentById,
    segmentOpenIds,
    diffOpenIds,
    claimSegment,
    isOpen,
    toggleSegment,
    toggleDiff,
  }
}
