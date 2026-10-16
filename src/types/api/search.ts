/**
 * 流程 4：检索地方资料 —— 接口契约。
 */
import type { PageQuery } from '@/services/api/types'

import type { AiMeta } from './common'

/** 资料来源类型。 */
export type SourceType =
  | 'gazetteer' // 地方志
  | 'chronicle' // 年鉴 / 大事记
  | 'genealogy' // 族谱
  | 'newspaper' // 旧报刊
  | 'academic' // 学术论文 / 专著
  | 'archive' // 官方档案
  | 'oral' // 口述记录
  | 'inscription' // 碑刻 / 匾额
  | 'heritage_list' // 非遗名录

/** 可信度分级。 */
export type CredibilityLevel = 'high' | 'medium' | 'low' | 'unverified'

/** 检索结果的排序方式。 */
export type SearchSort = 'relevance' | 'publishedAt' | 'credibility'

/** 时间区间。 */
export interface TimeRange {
  /** ISO 8601 或历史纪年文本（如「清光绪年间」）。 */
  from?: string
  to?: string
}

/* ---------------- POST /sources/search ---------------- */

export interface SearchSourcesRequest extends PageQuery {
  /** 关键词列表（AND 语义，TODO-SEARCH-1 待确认）。 */
  keywords: string[]
  /** 按结构化实体过滤。 */
  entityIds?: string[]
  /** 地点 / 人物 / 事件的自由输入（与 entityIds 取并集）。 */
  places?: string[]
  persons?: string[]
  events?: string[]
  timeRange?: TimeRange
  /** 来源类型过滤。 */
  sourceTypes?: SourceType[]
  /** 可信度过滤。 */
  credibility?: CredibilityLevel[]
  /** 是否启用 AI 智能扩展检索词。 */
  enableQueryExpansion: boolean
  /** 是否启用 AI 相关度重排。 */
  enableReRank: boolean
}

/** AI 扩展出的检索词。 */
export interface ExpandedKeyword {
  term: string
  /** 扩展权重 0~1。 */
  weight: number
  /** 扩展理由，例如「『三坊巷』为『三坊七巷』的民国旧称」。 */
  reason: string
  /** 该词命中的结果数（后端预统计）。 */
  hitCount: number
}

/** 一条检索命中。 */
export interface SearchHit {
  sourceId: string
  title: string
  /** 出版方 / 收藏机构。 */
  publisher: string
  sourceType: SourceType
  credibility: CredibilityLevel
  /** 可信度分值 0~1，用于排序与展示。 */
  credibilityScore: number
  /** ISO 8601 或历史纪年文本。 */
  publishedAt: string
  /** 原文摘录。 */
  excerpt: string
  /** 命中的高亮片段。 */
  highlights: string[]
  /** 相关度得分 0~1。 */
  score: number
  /** 定位信息。 */
  locator: { page?: number; line?: number; url?: string; callNumber?: string }
  /** 关联到本次采访的实体 id。 */
  relatedEntityIds: string[]
  /** 关联线索（可继续跳转）。 */
  relatedLeadIds: string[]
  /** 是否已被引用到草稿。 */
  cited: boolean
}

/** 关联线索：引导用户继续深挖。 */
export interface RelatedLead {
  id: string
  title: string
  kind: 'entity' | 'source' | 'interview' | 'event'
  hint: string
  confidence: number
}

/** 分面统计，用于筛选栏展示数量。 */
export interface SearchFacet {
  field: 'sourceType' | 'credibility' | 'decade'
  buckets: Array<{ value: string; label: string; count: number }>
}

export interface SearchSourcesResponse {
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  hits: SearchHit[]
  /** AI 扩展出的检索词（enableQueryExpansion=true 时）。 */
  expandedKeywords: ExpandedKeyword[]
  facets: SearchFacet[]
  leads: RelatedLead[]
  /** 耗时（毫秒）。 */
  tookMs: number
  aiMeta?: AiMeta
}

/* ---------------- GET /sources/{sourceId} ---------------- */

export interface GetSourceDetailResponse {
  source: SearchHit
  /** 完整摘录（可能远长于 excerpt）。 */
  fullExcerpt: string
  /** 引用信息（GB/T 7714 风格）。 */
  citation: string
  relatedSources: SearchHit[]
  leads: RelatedLead[]
}
