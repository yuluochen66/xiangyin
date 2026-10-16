/**
 * 四个工具的调用契约。
 *
 * 这些类型是前端与工具实现之间唯一的约定层：
 * - `services/mock` 用它构造假数据；
 * - `services/http` 用它做 DTO 映射（字段名待后端确认，见该文件 TODO）。
 *
 * 组件不得直接引用本文件的 Input/Output 类型以外的工具细节。
 */
import type {
  Annotation,
  Claim,
  ClaimAssessment,
  ClaimVerdict,
  ReviewStatus,
  SourceKind,
  SourceTag,
  StoryCard,
} from './domain'

/** 工具名联合类型。新增工具时必须同时扩展 ToolContract。 */
export type ToolName =
  'retrieve_local_sources' | 'compare_claims' | 'build_story_card' | 'submit_review'

/* ------------------------------------------------------------------ */
/* 1. retrieve_local_sources                                          */
/* ------------------------------------------------------------------ */

export interface RetrieveLocalSourcesInput {
  /** 检索词，支持空格分隔的多关键词。 */
  query: string
  /** 仅检索这些类型；不传表示不过滤。 */
  kinds?: SourceKind[]
  /** 返回条数上限，默认 10。 */
  limit?: number
  /** 可信度下限 0~1，默认 0。 */
  minConfidence?: number
}

/** 单条检索命中。 */
export interface RetrievedSource {
  source: SourceTag
  /** 相关性得分，0~1，降序返回。 */
  score: number
  /** 命中的关键词，用于结果高亮。 */
  matchedTerms: string[]
}

export interface RetrieveLocalSourcesOutput {
  query: string
  /** 命中总数（不受 limit 影响）。 */
  total: number
  items: RetrievedSource[]
  /** 服务端耗时（毫秒）。 */
  tookMs: number
}

/* ------------------------------------------------------------------ */
/* 2. compare_claims                                                  */
/* ------------------------------------------------------------------ */

export interface CompareClaimsInput {
  /** 待核查论断 id。 */
  claimIds: string[]
  /**
   * 论断正文。当论断尚未持久化（例如用户在编辑器中临时新增）时，
   * 与 claimIds 一起提交，由工具决定以哪份为准。
   */
  claims?: Claim[]
  /** 严格模式：证据不足时直接判定为 unverified 而非 partial。 */
  strictMode?: boolean
}

export interface CompareClaimsOutput {
  assessments: ClaimAssessment[]
  summary: Record<ClaimVerdict, number>
  tookMs: number
}

/* ------------------------------------------------------------------ */
/* 3. build_story_card                                                */
/* ------------------------------------------------------------------ */

export interface BuildStoryCardInput {
  /** 拟定标题。 */
  title: string
  /** 纳入故事卡的关键论断 id。 */
  claimIds: string[]
  /** 允许引用的来源 id，用于约束引用范围。 */
  sourceIds: string[]
  tone?: 'neutral' | 'alert'
}

export interface BuildStoryCardOutput {
  card: StoryCard
  /** 因证据不足未被采纳的论断 id，供前端提示。 */
  omittedClaimIds: string[]
}

/* ------------------------------------------------------------------ */
/* 4. submit_review                                                   */
/* ------------------------------------------------------------------ */

/** 单个审校单元的提交决议。 */
export interface ReviewDecisionInput {
  unitId: string
  status: Exclude<ReviewStatus, 'pending'>
  /** 提交时附带的说明。 */
  note?: string
  /** 本次提交新增的批注。 */
  annotations?: Omit<Annotation, 'id' | 'createdAt'>[]
}

export interface SubmitReviewInput {
  reviewId: string
  reviewer: string
  decisions: ReviewDecisionInput[]
  /** 整单评论。 */
  comment?: string
}

export interface SubmitReviewOutput {
  receiptId: string
  reviewId: string
  /** ISO 8601 时间戳。 */
  submittedAt: string
  accepted: number
  rejected: number
  flagged: number
  status: 'queued' | 'committed'
}

/* ------------------------------------------------------------------ */
/* 契约表                                                              */
/* ------------------------------------------------------------------ */

/** 工具名 → 入参/出参 的映射。ToolTransport 与 ToolClient 都基于它做类型推导。 */
export interface ToolContract {
  retrieve_local_sources: {
    input: RetrieveLocalSourcesInput
    output: RetrieveLocalSourcesOutput
  }
  compare_claims: {
    input: CompareClaimsInput
    output: CompareClaimsOutput
  }
  build_story_card: {
    input: BuildStoryCardInput
    output: BuildStoryCardOutput
  }
  submit_review: {
    input: SubmitReviewInput
    output: SubmitReviewOutput
  }
}

/* ------------------------------------------------------------------ */
/* 错误与结果统一包装                                                  */
/* ------------------------------------------------------------------ */

export type ToolErrorCode =
  'network' | 'timeout' | 'invalid_input' | 'not_found' | 'server' | 'cancelled' | 'unknown'

/** 归一化后的工具错误。所有失败路径都必须收敛到这个形状。 */
export interface ToolError {
  tool: ToolName | 'unknown'
  code: ToolErrorCode
  /** 可直接展示给用户的中文描述。 */
  message: string
  /** 是否值得重试（network / timeout / server 为 true）。 */
  retryable: boolean
  /** 原始错误细节，仅用于日志。 */
  details?: Record<string, unknown>
}

/** 工具调用结果。调用方必须先判 ok 再取 data。 */
export type ToolResult<T> =
  { ok: true; data: T; tookMs: number } | { ok: false; error: ToolError; tookMs: number }

/**
 * 便捷判定：非空结果。
 * @param result 待判断的工具调用结果
 * @returns 是否为成功结果；为真时可安全访问 data
 */
export function isToolOk<T>(
  result: ToolResult<T>,
): result is { ok: true; data: T; tookMs: number } {
  return result.ok
}
