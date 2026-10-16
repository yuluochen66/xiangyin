/**
 * 流程 4 的兜底动作与分面交互。
 *
 * 唯一职责：实现「结果为空 / 本地资料库不可用 / 分面筛选」这些场景下
 * 「换一种方式再试」的动作——清空全部筛选、放宽筛选后重试、关闭可信度限制、
 * 改用流程 3 的已确认实体继续浏览，以及点击分面桶切换对应筛选条件。
 *
 * 检索条件本身由 useSearchConditions 持有，本模块只通过 conditions 引用读写，
 * 并沿用同一套 search / hasAttempts 回调，保证检索时序与主视图完全一致。
 */
import type { NoticeLevel } from '@/composables/useAppShell'
import type { UseSearchConditionsApi } from '@/composables/useSearchConditions'
import type { CredibilityLevel, SearchFacet, SourceType } from '@/types/api'

export interface UseSearchFallbacksOptions {
  /** 检索条件状态与交互。 */
  conditions: UseSearchConditionsApi
  /** 立即以第 1 页重新检索。 */
  search: () => void
  /** 是否已经发起过至少一次检索。 */
  hasAttempts: () => boolean
  /** 清空扩展词忽略记录与线索采纳记录。 */
  clearExtras: () => void
  /** 界面提示。 */
  notify: (level: NoticeLevel, text: string, detail?: string) => void
}

export interface UseSearchFallbacksApi {
  /** 清空全部关键词与筛选条件（含扩展词忽略记录与线索采纳记录）。 */
  clearAllFilters(): void
  /** 空数据时：去掉全部筛选条件后重试。 */
  relaxFilters(): void
  /** 空数据时：仅关闭可信度限制后重试。 */
  dropCredibilityFilter(): void
  /** 不可用时：改用流程 3 的已确认实体继续。 */
  browseWithEntities(): void
  /** 点击分面桶：切换对应的来源类型 / 可信度筛选。 */
  toggleFacet(facet: SearchFacet, value: string): void
}

/**
 * 创建兜底动作与分面交互。
 * @param options 检索条件、检索触发与全局提示的回调
 * @returns 清空 / 放宽 / 兜底 / 分面四类动作
 */
export function useSearchFallbacks(options: UseSearchFallbacksOptions): UseSearchFallbacksApi {
  /** 清空全部关键词与筛选条件。 */
  function clearAllFilters(): void {
    options.conditions.clearConditions()
    options.clearExtras()
    options.notify('info', '已清空全部关键词与筛选条件。')
    if (options.hasAttempts()) {
      options.conditions.riskAcknowledged.value = false
      options.search()
    }
  }

  function relaxFilters(): void {
    options.conditions.selectedSourceTypes.value = []
    options.conditions.selectedCredibility.value = []
    options.conditions.selectedEntityIds.value = []
    options.notify('info', '已放宽来源类型、可信度与实体过滤，重新检索。')
    options.search()
  }

  function dropCredibilityFilter(): void {
    options.conditions.selectedCredibility.value = []
    options.notify('info', '已关闭可信度限制', '会引入「低 / 待核」来源，引用前请逐条人工核对。')
    options.search()
  }

  /** 本地资料库不可用时，用流程 3 的实体继续人工查证。 */
  function browseWithEntities(): void {
    const conditions = options.conditions
    conditions.selectedEntityIds.value = conditions.entities.value
      .filter((entity) => entity.confirmStatus === 'confirmed')
      .map((entity) => entity.id)
    conditions.selectedSourceTypes.value = []
    conditions.selectedCredibility.value = []
    options.notify(
      'info',
      `本地资料库不可用，已改用流程 3 的 ${conditions.selectedEntityIds.value.length} 个已确认实体作为条件继续浏览。`,
      '检索结果仍会返回，但请以线下核证为准。',
    )
    options.search()
  }

  function toggleFacet(facet: SearchFacet, value: string): void {
    if (facet.field === 'decade') {
      options.notify(
        'info',
        '年代分面暂不支持点击筛选',
        '请求体目前没有年代字段（待确认 TODO-SEARCH-2）。',
      )
      return
    }
    if (facet.field === 'sourceType') options.conditions.toggleSourceType(value as SourceType)
    else options.conditions.toggleCredibility(value as CredibilityLevel)
  }

  return { clearAllFilters, relaxFilters, dropCredibilityFilter, browseWithEntities, toggleFacet }
}
