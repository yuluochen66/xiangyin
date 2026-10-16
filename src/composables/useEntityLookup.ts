/**
 * 实体 id 查表。
 *
 * 唯一职责：把「实体 id → 展示文本」的查找收在一处——同义项分组与合并弹窗
 * 都要显示成员名称、置信度与原文依据条数，避免各写一份查找。
 */
import type { ComputedRef } from 'vue'

import type { ExtractedEntity } from '@/types/api'
import { formatPercent } from '@/utils/format'

export interface UseEntityLookupApi {
  /** 按 id 取实体显示名，找不到时回退为 id。 */
  entityName: (id: string) => string
  /** 按 id 取置信度文本，找不到时回退为 `-`。 */
  entityConfidenceText: (id: string) => string
  /** 按 id 取原文依据条数。 */
  entityEvidenceCount: (id: string) => number
}

/**
 * 基于实体列表创建 id 查找器。
 * @param entities 用于查找的实体集合
 * @returns 按 id 取显示名、置信度文本与原文依据条数的三个函数
 */
export function useEntityLookup(entities: ComputedRef<ExtractedEntity[]>): UseEntityLookupApi {
  function entityById(id: string): ExtractedEntity | undefined {
    return entities.value.find((item) => item.id === id)
  }

  function entityName(id: string): string {
    return entityById(id)?.name ?? id
  }

  function entityConfidenceText(id: string): string {
    const entity = entityById(id)
    return entity ? formatPercent(entity.confidence) : '-'
  }

  function entityEvidenceCount(id: string): number {
    return entityById(id)?.evidence.length ?? 0
  }

  return { entityName, entityConfidenceText, entityEvidenceCount }
}
