/**
 * 流程 5 的展示映射与统计口径。
 *
 * 唯一职责：把「比对结论 / 差异原因分类 / 资料可信度 / 标注筛选」这些枚举值翻译成
 * 界面文案、配色与条数口径，供主视图与各子组件共用同一处定义。
 */
import type { IconName } from '@/components/common/AppIcon.vue'
import type { AnnotationStats, CompareVerdict, ConflictReasonTag } from '@/types/api'

/** 4 种比对结论的中文名与配色。 */
export const VERDICT_META: Record<
  CompareVerdict,
  { label: string; icon: IconName; tone: 'success' | 'danger' | 'warning' | 'neutral' }
> = {
  consistent: { label: '一致', icon: 'check', tone: 'success' },
  conflict: { label: '差异', icon: 'alert', tone: 'danger' },
  needs_verification: { label: '待核实', icon: 'question', tone: 'warning' },
  insufficient: { label: '资料不足', icon: 'search', tone: 'neutral' },
}

/** 人工判定可选的 4 种结论。 */
export const VERDICT_OPTIONS: CompareVerdict[] = [
  'consistent',
  'conflict',
  'needs_verification',
  'insufficient',
]

/** 结论按钮选中态的配色。 */
export const VERDICT_ACTIVE_CLASS: Record<CompareVerdict, string> = {
  consistent: 'bg-verified text-verified ring-verified',
  conflict: 'bg-vermilion text-vermilion ring-vermilion',
  needs_verification: 'bg-attention text-attention ring-attention',
  insufficient: 'bg-paper-3 text-ink ring-rule',
}

/** 差异原因分类的中文标签。 */
export const CONFLICT_REASON_LABEL: Record<ConflictReasonTag, string> = {
  time_error: '时间不符',
  place_error: '地点不符',
  person_mixup: '人物混淆',
  legend_as_fact: '传说当作史实',
  memory_bias: '个人记忆偏差',
  source_low_credibility: '来源可信度不足',
  transcription_error: '转写错误',
  other: '其他',
}

/** 差异原因分类的可选列表（顺序与标签表一致）。 */
export const CONFLICT_REASON_OPTIONS = Object.keys(CONFLICT_REASON_LABEL) as ConflictReasonTag[]

/** 资料可信度到 StatusPill 色调的映射。 */
export const CREDIBILITY_TONE: Record<
  'high' | 'medium' | 'low' | 'unverified',
  'success' | 'info' | 'warning' | 'neutral'
> = {
  high: 'success',
  medium: 'info',
  low: 'warning',
  unverified: 'neutral',
}

/** 资料可信度到中文简称的映射。 */
export const CREDIBILITY_TEXT: Record<'high' | 'medium' | 'low' | 'unverified', string> = {
  high: '高',
  medium: '中',
  low: '低',
  unverified: '待核',
}

/** 逐条标注的筛选模式。 */
export type AnnotationFilterMode = 'all' | 'unannotated' | 'annotated' | 'disagreed'

/** 筛选按钮的可选项。 */
export const FILTER_OPTIONS: Array<{ value: AnnotationFilterMode; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'unannotated', label: '未标注' },
  { value: 'annotated', label: '已标注' },
  { value: 'disagreed', label: '与 AI 不一致' },
]

/**
 * 筛选模式对应的按钮文案。
 * @param mode 当前筛选模式
 * @returns 该模式的中文名；未定义时回落为「全部」
 */
export function annotationFilterLabel(mode: AnnotationFilterMode): string {
  return FILTER_OPTIONS.find((option) => option.value === mode)?.label ?? '全部'
}

/**
 * 筛选模式下的条数。
 * @param mode 当前筛选模式
 * @param stats 界面上的实时标注统计
 * @returns 该模式应展示的条数
 */
export function annotationFilterCount(mode: AnnotationFilterMode, stats: AnnotationStats): number {
  if (mode === 'unannotated') return stats.total - stats.annotated
  if (mode === 'annotated') return stats.annotated
  if (mode === 'disagreed') return stats.disagreedWithAi
  return stats.total
}

/** 进度面板上的一张统计卡。 */
export interface StatCard {
  label: string
  value: number
  className: string
}

/**
 * 由实时统计推导进度面板上的 7 张统计卡。
 * @param stats 界面上的实时标注统计
 * @returns 统计卡列表：总条数 / 未标注 / 一致 / 差异 / 待核实 / 资料不足 / 与 AI 不一致
 */
export function statCardsOf(stats: AnnotationStats): StatCard[] {
  return [
    { label: '总条数', value: stats.total, className: 'text-ink' },
    { label: '未标注', value: stats.total - stats.annotated, className: 'text-attention' },
    { label: '一致', value: stats.consistent, className: 'text-verified' },
    { label: '差异', value: stats.conflict, className: 'text-vermilion' },
    { label: '待核实', value: stats.needsVerification, className: 'text-attention' },
    { label: '资料不足', value: stats.insufficient, className: 'text-ink-2' },
    { label: '与 AI 不一致', value: stats.disagreedWithAi, className: 'text-seal-ink' },
  ]
}
