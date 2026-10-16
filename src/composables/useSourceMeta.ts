/**
 * 流程 4 的资料来源元数据与风险判定（唯一来源）。
 *
 * 唯一职责：集中提供「不依赖响应式状态」的常量与纯函数——来源类型 / 可信度 /
 * 实体类别 / 确认状态 / 分面 / 关联线索的中文名与色调、可选筛选项清单，
 * 以及低可信来源的风险判定与人工确认文案。
 * 主视图与 flow4 子组件都从这里取，避免同一套标签在多处各写一遍。
 */
import { CREDIBILITY_LABEL, SOURCE_TYPE_LABEL } from '@/api'
import type { ConfirmPrompt } from '@/composables/useAsyncTask'
import type {
  ConfirmStatus,
  CredibilityLevel,
  EntityKind,
  RelatedLead,
  SearchFacet,
  SearchHit,
  SearchSort,
  SearchSourcesResponse,
  SourceType,
} from '@/types/api'

/**
 * 来源类型中文名；后端若返回目录外的类型（如"official"）原样回退展示。
 * @param type 来源类型枚举值
 * @returns 来源类型的中文名
 */
export function sourceTypeLabel(type: SourceType): string {
  return SOURCE_TYPE_LABEL[type] ?? type
}

/** 可信度分级 → 中文 + 颜色：high 绿 / medium 蓝 / low 琥珀 / unverified 灰。 */
export const CREDIBILITY_META: Record<
  CredibilityLevel,
  { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' }
> = {
  high: { label: CREDIBILITY_LABEL.high, tone: 'success' },
  medium: { label: CREDIBILITY_LABEL.medium, tone: 'info' },
  low: { label: CREDIBILITY_LABEL.low, tone: 'warning' },
  unverified: { label: CREDIBILITY_LABEL.unverified, tone: 'neutral' },
}

/** 实体类别中文名。 */
export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  place: '地点',
  person: '人物',
  event: '事件',
  organization: '机构',
  artifact: '器物',
  time: '时间',
}

/** 人工确认状态 → 中文 + 色调。 */
export const CONFIRM_STATUS_META: Record<
  ConfirmStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  not_required: { label: '无需确认', tone: 'neutral' },
  pending: { label: '待人工确认', tone: 'warning' },
  confirmed: { label: '已确认', tone: 'success' },
  rejected: { label: '已驳回', tone: 'danger' },
}

/** 分面字段中文名。 */
export const FACET_LABEL: Record<SearchFacet['field'], string> = {
  sourceType: '来源类型',
  credibility: '可信度',
  decade: '年代',
}

/** 关联线索类别中文名。 */
export const LEAD_KIND_LABEL: Record<RelatedLead['kind'], string> = {
  entity: '实体',
  source: '资料',
  interview: '采访',
  event: '事件',
}

/** 排序方式选项。 */
export const SORT_OPTIONS: Array<{ value: SearchSort; label: string }> = [
  { value: 'relevance', label: '相关度优先' },
  { value: 'publishedAt', label: '出版时间优先' },
  { value: 'credibility', label: '可信度优先' },
]

/** 每页条数选项。 */
export const PAGE_SIZE_OPTIONS = [5, 10, 20]

/** idle 引导用的推荐检索词（对应演示剧情）。 */
export const RECOMMENDED_KEYWORDS = ['脱胎漆器', '塔巷', '茉莉花茶', '闽剧']

/** 可选来源类型。 */
export const SOURCE_TYPE_OPTIONS = Object.keys(SOURCE_TYPE_LABEL) as SourceType[]

/** 可选可信度分级。 */
export const CREDIBILITY_OPTIONS: CredibilityLevel[] = ['high', 'medium', 'low', 'unverified']

/**
 * 判定命中里是否存在「口述记录 / 可信度待核」这类不能直接引用的材料。
 * @param hit 单条检索结果
 * @returns 是否命中风险来源
 */
export function isRiskyHit(hit: SearchHit): boolean {
  return hit.credibility === 'unverified' || hit.sourceType === 'oral'
}

/**
 * 判定某个分面桶当前是否处于选中状态。
 * @param facet 分面定义
 * @param value 分面桶的取值
 * @param selectedSourceTypes 已选来源类型
 * @param selectedCredibility 已选可信度分级
 * @returns 该分面桶是否已选中
 */
export function isFacetActive(
  facet: SearchFacet,
  value: string,
  selectedSourceTypes: SourceType[],
  selectedCredibility: CredibilityLevel[],
): boolean {
  if (facet.field === 'sourceType') return selectedSourceTypes.includes(value as SourceType)
  if (facet.field === 'credibility') return selectedCredibility.includes(value as CredibilityLevel)
  return false
}

/**
 * 为「命中包含低可信来源」构造人工确认提示。
 * @param data 检索响应
 * @returns 确认提示；没有风险来源时返回 null
 */
export function buildRiskPrompt(data: SearchSourcesResponse): ConfirmPrompt | null {
  const risky = data.hits.filter((hit) => isRiskyHit(hit))
  if (risky.length === 0) return null

  return {
    title: '命中包含低可信来源，需人工确认后再引用',
    message: `本次 ${data.hits.length} 条命中中有 ${risky.length} 条来自口述记录或可信度「待核」的来源。这类材料保留了传说与个人记忆，直接引用可能把传闻写成史实。`,
    details: risky
      .slice(0, 6)
      .map(
        (hit) =>
          `${sourceTypeLabel(hit.sourceType)} · ${hit.title}（可信度 ${CREDIBILITY_META[hit.credibility].label}，分值 ${hit.credibilityScore.toFixed(2)}）`,
      ),
    confirmText: '已知悉，继续查看结果',
    cancelText: '放弃本次结果',
  }
}
