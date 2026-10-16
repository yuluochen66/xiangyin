/**
 * 流程 4 的检索条件：状态、请求体拼装与全部条件类交互。
 *
 * 唯一职责：维护「左侧检索条件」这一份数据——关键词、来源类型、可信度、实体、
 * 排序、每页条数与两个 AI 开关，并把它拼装成 POST /sources/search 的请求体；
 * 所有会改动条件的交互（提交 / 移除关键词、勾选筛选、切换 AI 开关、全选实体等）
 * 都在这里实现。清空 / 放宽 / 兜底 / 分面这类「换一种方式再试」的动作见
 * useSearchFallbacks。
 *
 * 与状态机的边界：本模块不直接发起请求，只通过 options.search 与
 * options.hasAttempts 回调把「何时检索」交回主视图，接口调用入口因此留在视图层。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { NoticeLevel } from '@/composables/useAppShell'
import { mockStore } from '@/mock/store'
import type {
  CredibilityLevel,
  ExtractedEntity,
  SearchSort,
  SearchSourcesRequest,
  SourceType,
} from '@/types/api'

export interface UseSearchConditionsOptions {
  /** 立即以第 1 页重新检索。 */
  search: () => void
  /** 是否已经发起过至少一次检索：决定条件变化后要不要自动重查。 */
  hasAttempts: () => boolean
  /** 界面提示。 */
  notify: (level: NoticeLevel, text: string, detail?: string) => void
}

export interface UseSearchConditionsApi {
  /** 关键词输入框内容（尚未提交）。 */
  keywordInput: Ref<string>
  /** 已生效的关键词（会随请求提交）。 */
  keywords: Ref<string[]>
  selectedSourceTypes: Ref<SourceType[]>
  selectedCredibility: Ref<CredibilityLevel[]>
  selectedEntityIds: Ref<string[]>
  sort: Ref<SearchSort>
  /** 每页条数；默认 5 条，用于演示追加式分页。 */
  pageSize: Ref<number>
  enableQueryExpansion: Ref<boolean>
  enableReRank: Ref<boolean>
  /** 低可信来源的人工确认结果（确认后才在界面上标记为「已核对」）。 */
  riskAcknowledged: Ref<boolean>
  /** 流程 3 抽取出的实体，作为结构化过滤条件。 */
  entities: ComputedRef<ExtractedEntity[]>
  /** 追加关键词（去重、去空白），不触发检索。 */
  addKeywords(terms: string[]): void
  /** 按当前条件拼装检索请求体。 */
  buildRequest(page: number): SearchSourcesRequest
  /** 已有检索结果时条件变化立即重查；从未检索过则只更新条件、保持 idle 引导。 */
  applyFilterChange(): void
  submitKeywordInput(): void
  removeKeyword(term: string): void
  useRecommended(term: string): void
  toggleSourceType(type: SourceType): void
  toggleCredibility(level: CredibilityLevel): void
  toggleEntity(entityId: string): void
  selectConfirmedEntities(): void
  clearEntityFilter(): void
  /** 清空关键词与筛选条件（不动扩展词忽略记录与线索采纳记录）。 */
  clearConditions(): void
  /** 把条件恢复到初始值并清掉人工确认标记（不触发检索、不关闭详情）。 */
  resetConditions(): void
}

/**
 * 创建检索条件状态与交互。
 * @param options 检索触发与全局提示的回调
 * @returns 检索条件状态、请求体拼装与全部条件类交互
 */
export function useSearchConditions(options: UseSearchConditionsOptions): UseSearchConditionsApi {
  const keywordInput = ref('')
  const keywords = ref<string[]>([])
  const selectedSourceTypes = ref<SourceType[]>([])
  const selectedCredibility = ref<CredibilityLevel[]>([])
  const selectedEntityIds = ref<string[]>([])
  const sort = ref<SearchSort>('relevance')
  /** 默认每页 5 条：演示「加载更多」这类追加式分页（资料库共 10 条示例数据）。 */
  const pageSize = ref(5)
  const enableQueryExpansion = ref(true)
  const enableReRank = ref(true)
  /** 低可信来源的人工确认结果（确认后才在界面上标记为「已核对」）。 */
  const riskAcknowledged = ref(false)

  const entities = computed(() => mockStore.entities)

  /**
   * 按当前条件拼装检索请求体。
   * @param page 请求页码
   * @returns 检索请求体，空数组条件不写入
   */
  function buildRequest(page: number): SearchSourcesRequest {
    const request: SearchSourcesRequest = {
      keywords: [...keywords.value],
      sort: sort.value,
      page,
      pageSize: pageSize.value,
      enableQueryExpansion: enableQueryExpansion.value,
      enableReRank: enableReRank.value,
    }
    if (selectedEntityIds.value.length > 0) request.entityIds = [...selectedEntityIds.value]
    if (selectedSourceTypes.value.length > 0) request.sourceTypes = [...selectedSourceTypes.value]
    if (selectedCredibility.value.length > 0) request.credibility = [...selectedCredibility.value]
    return request
  }

  /**
   * 把输入框文本切成检索词：空格 / 逗号 / 顿号 / 分号分隔。
   * @param raw 输入框原文
   * @returns 去空白后的检索词数组
   */
  function parseKeywords(raw: string): string[] {
    return raw
      .split(/[\s,，、;；]+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 0)
  }

  /**
   * 追加关键词（去重、去空白），不触发检索。
   * @param terms 待追加的检索词
   * @returns 无返回值
   */
  function addKeywords(terms: string[]): void {
    const next = [...keywords.value]
    for (const term of terms) {
      const value = term.trim()
      if (value.length > 0 && !next.includes(value)) next.push(value)
    }
    keywords.value = next
  }

  /** 已有检索结果时，条件变化立即重查；从未检索过则只更新条件、保持 idle 引导。 */
  function applyFilterChange(): void {
    if (options.hasAttempts()) {
      riskAcknowledged.value = false
      options.search()
    }
  }

  /** 清空关键词与筛选条件（不动扩展词忽略记录与线索采纳记录）。 */
  function clearConditions(): void {
    keywords.value = []
    keywordInput.value = ''
    selectedSourceTypes.value = []
    selectedCredibility.value = []
    selectedEntityIds.value = []
  }

  function submitKeywordInput(): void {
    if (keywordInput.value.trim().length === 0) {
      options.notify(
        'warning',
        '请输入检索关键词。',
        '多个关键词用空格分隔，例如「脱胎漆器 工序」。',
      )
      return
    }
    addKeywords(parseKeywords(keywordInput.value))
    keywordInput.value = ''
    riskAcknowledged.value = false
    options.search()
  }

  function removeKeyword(term: string): void {
    keywords.value = keywords.value.filter((item) => item !== term)
    applyFilterChange()
  }

  function useRecommended(term: string): void {
    addKeywords([term])
    riskAcknowledged.value = false
    options.search()
  }

  function toggleSourceType(type: SourceType): void {
    selectedSourceTypes.value = selectedSourceTypes.value.includes(type)
      ? selectedSourceTypes.value.filter((item) => item !== type)
      : [...selectedSourceTypes.value, type]
    applyFilterChange()
  }

  function toggleCredibility(level: CredibilityLevel): void {
    selectedCredibility.value = selectedCredibility.value.includes(level)
      ? selectedCredibility.value.filter((item) => item !== level)
      : [...selectedCredibility.value, level]
    applyFilterChange()
  }

  function toggleEntity(entityId: string): void {
    selectedEntityIds.value = selectedEntityIds.value.includes(entityId)
      ? selectedEntityIds.value.filter((item) => item !== entityId)
      : [...selectedEntityIds.value, entityId]
    applyFilterChange()
  }

  function selectConfirmedEntities(): void {
    selectedEntityIds.value = entities.value
      .filter((entity) => entity.confirmStatus === 'confirmed')
      .map((entity) => entity.id)
    options.notify(
      'info',
      `已勾选 ${selectedEntityIds.value.length} 个「已确认」实体作为过滤条件。`,
    )
    applyFilterChange()
  }

  function clearEntityFilter(): void {
    selectedEntityIds.value = []
    applyFilterChange()
  }

  function resetConditions(): void {
    clearConditions()
    riskAcknowledged.value = false
  }

  return {
    keywordInput,
    keywords,
    selectedSourceTypes,
    selectedCredibility,
    selectedEntityIds,
    sort,
    pageSize,
    enableQueryExpansion,
    enableReRank,
    riskAcknowledged,
    entities,
    addKeywords,
    buildRequest,
    applyFilterChange,
    submitKeywordInput,
    removeKeyword,
    useRecommended,
    toggleSourceType,
    toggleCredibility,
    toggleEntity,
    selectConfirmedEntities,
    clearEntityFilter,
    clearConditions,
    resetConditions,
  }
}
