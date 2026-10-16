/**
 * 流程 5：标注一致或有差异之处 —— 接口契约。
 *
 * 数据形态：AI 创作内容（论断）与检索资料逐条配对，形成「比对项」，
 * 每项先由 AI 初判，再由人工标注最终结论。
 */
import type { AiMeta, OperatorInfo } from './common'

/**
 * 比对结论。
 * - consistent 一致
 * - conflict 差异
 * - needs_verification 待核实
 * - insufficient 资料不足（无法判断）
 */
export type CompareVerdict = 'consistent' | 'conflict' | 'needs_verification' | 'insufficient'

/** 人工标注状态。 */
export type AnnotationState = 'unannotated' | 'annotated'

/** 差异原因分类，用于统计与后续复盘。 */
export type ConflictReasonTag =
  | 'time_error' // 时间不符
  | 'place_error' // 地点不符
  | 'person_mixup' // 人物混淆
  | 'legend_as_fact' // 传说当作史实
  | 'memory_bias' // 个人记忆偏差
  | 'source_low_credibility' // 来源可信度不足
  | 'transcription_error' // 转写错误
  | 'other'

/* ---------------- POST /comparisons:start ---------------- */

export interface StartComparisonRequest {
  /** 待比对的创作草稿 id（流程 6 产出，或外部导入）。 */
  draftId: string
  /** 限定比对的论断；不传表示全部。 */
  claimIds?: string[]
  /** 是否启用 AI 自动初判。 */
  enableAutoJudge: boolean
  /** 每条论断最多配对的资料数。 */
  maxSourcesPerClaim?: number
  operator: OperatorInfo
}

/** 单个比对项。 */
export interface ComparisonItem {
  itemId: string
  /** 创作内容中的论断原文。 */
  claimText: string
  /** 论断在草稿中的位置，用于左侧跳转。 */
  claimBlockId?: string
  /** 论断对应的采访片段（若有）。 */
  claimSegmentId?: string
  /** 配对到的资料；资料不足时为 null。 */
  source: {
    sourceId: string
    title: string
    publisher: string
    credibility: 'high' | 'medium' | 'low' | 'unverified'
    publishedAt: string
    excerpt: string
    locator: { page?: number; line?: number; url?: string; callNumber?: string }
  } | null
  /** AI 初判结论。source 为 null 时恒为 insufficient。 */
  aiVerdict: CompareVerdict
  /** AI 初判置信度 0~1。 */
  aiConfidence: number
  /** AI 给出的理由说明（必须展示给用户，避免黑箱）。 */
  aiReason: string
  /** AI 理由对应的分类标签。 */
  aiReasonTags: ConflictReasonTag[]
  /** 人工最终结论；未标注时为 null。 */
  humanVerdict: CompareVerdict | null
  humanReason: string | null
  humanReasonTags: ConflictReasonTag[]
  annotator: OperatorInfo | null
  /** ISO 8601。 */
  annotatedAt: string | null
  /** 标注状态。 */
  annotationState: AnnotationState
}

/** 标注进度统计。 */
export interface AnnotationStats {
  total: number
  annotated: number
  /** 0~1。 */
  progress: number
  consistent: number
  conflict: number
  needsVerification: number
  insufficient: number
  /** 与 AI 初判不一致的人工标注数（用于评估 AI 效果）。 */
  disagreedWithAi: number
}

export interface StartComparisonResponse {
  comparisonId: string
  draftId: string
  items: ComparisonItem[]
  stats: AnnotationStats
  aiMeta: AiMeta
}

/* ---------------- GET /comparisons/{comparisonId} ---------------- */

export interface GetComparisonResponse {
  comparisonId: string
  draftId: string
  items: ComparisonItem[]
  stats: AnnotationStats
  aiMeta: AiMeta
  status: 'succeeded' | 'running' | 'failed'
  failureReason?: string
}

/* ---------------- POST /comparisons/{id}/annotations ---------------- */

export interface AnnotationInput {
  itemId: string
  verdict: CompareVerdict
  /** verdict 为 conflict / needs_verification 时必填。 */
  reason: string
  reasonTags: ConflictReasonTag[]
}

export interface SubmitAnnotationsRequest {
  comparisonId: string
  annotations: AnnotationInput[]
  annotator: OperatorInfo
  /** true 表示提交整批（用于最终提交）；false 为增量保存。 */
  submitAll: boolean
}

export interface SubmitAnnotationsResponse {
  comparisonId: string
  savedAt: string
  /** 本次实际写入的条数。 */
  savedCount: number
  stats: AnnotationStats
  /** 校验失败的条目。 */
  invalid: Array<{ itemId: string; message: string }>
}

/** AI 重判单条（人工对初判有异议时可请求重新判断）。 */
export interface RejudgeItemRequest {
  comparisonId: string
  itemId: string
  /** 人工补充的上下文，用于提升重判质量。 */
  hints?: string
}

export interface RejudgeItemResponse {
  item: ComparisonItem
  aiMeta: AiMeta
}
