/**
 * 流程 7：审核发布 —— 接口契约。
 */
import type { AiMeta, OperatorInfo, VersionRef } from './common'

/**
 * 发布状态机：
 *   draft ──submit──► pending_review ──approve──► approved ──publish──► published
 *                          │                                  ▲
 *                          └────reject──► rejected ──revise────┘
 *   published ──archive──► archived（可回滚到历史版本）
 */
export type PublishStatus =
  'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'archived'

/** 审核动作。 */
export type ReviewAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'withdraw'

/* ---------------- POST /contents/{contentId}/transitions ---------------- */

export interface TransitionRequest {
  contentId: string
  action: ReviewAction
  /** 期望的起始状态，用于乐观锁：状态不匹配则拒绝。 */
  expectedFrom: PublishStatus
  operator: OperatorInfo
  comment?: string
  /** 发布前检查清单勾选结果。 */
  checklist?: ChecklistItem[]
}

export interface ChecklistItem {
  key: 'license' | 'citation' | 'annotation' | 'proofread' | 'sensitive'
  label: string
  checked: boolean
  /** 后端要求的必填项，未勾选不允许流转。 */
  required: boolean
}

export interface TransitionResponse {
  contentId: string
  /** 流转后的状态。 */
  status: PublishStatus
  /** 本次流转生成的新版本号。 */
  versionNo: number
  updatedAt: string
  /** 当前状态下允许的下一步动作。 */
  allowedActions: ReviewAction[]
  /** 若进入待审，返回审核任务 id。 */
  reviewId?: string
  /** 发布成功后的对外地址。 */
  publishedUrl?: string
}

/* ---------------- POST /contents/{contentId}/risk-check ---------------- */

/** 审核风险项。 */
export interface ReviewRisk {
  id: string
  level: 'info' | 'warning' | 'critical'
  category:
    | 'unsourced_claim' // 无来源结论
    | 'legend_as_fact' // 传说当史实
    | 'low_credibility_source' // 引用低可信来源
    | 'license_scope' // 超出授权范围
    | 'sensitive_content' // 敏感内容
    | 'citation_missing' // 缺少引用标注
    | 'other'
  message: string
  /** 建议处理方式。 */
  suggestion: string
  /** 定位到正文区块。 */
  relatedBlockId?: string
  /** 审核人是否已确认知晓。 */
  acknowledged: boolean
}

export interface RiskCheckResponse {
  contentId: string
  risks: ReviewRisk[]
  /** 综合风险等级。 */
  overallLevel: 'low' | 'medium' | 'high'
  /** 是否允许直接发布。 */
  publishable: boolean
  /** 阻止发布的原因。 */
  blockers: string[]
  aiMeta: AiMeta
}

/* ---------------- POST /contents/{contentId}/review-comments ---------------- */

export interface ReviewCommentRequest {
  contentId: string
  decision: 'approved' | 'rejected'
  /** 审核意见。reject 时必填。 */
  comment: string
  /** 逐条风险项的确认结果。 */
  riskDecisions: Array<{ riskId: string; acknowledged: boolean; note?: string }>
  reviewer: OperatorInfo
}

export interface ReviewCommentResponse {
  contentId: string
  status: PublishStatus
  reviewedAt: string
  reviewer: OperatorInfo
  comment: string
  versionNo: number
}

/* ---------------- POST /contents/{contentId}/publish ---------------- */

export interface FinalConfirmRequest {
  contentId: string
  operator: OperatorInfo
  /** 三项最终确认，缺一不可。 */
  confirmLicense: boolean
  confirmCitation: boolean
  confirmReviewed: boolean
  note?: string
}

export interface PublishResponse {
  contentId: string
  status: PublishStatus
  publishedUrl: string
  publishedAt: string
  versionNo: number
  /** 对外可见范围，由授权类型决定。 */
  visibility: 'public' | 'internal'
  certificateNo?: string
}

/* ---------------- 版本记录 ---------------- */

export interface ContentVersionRecord extends VersionRef {
  status: PublishStatus
  /** 该版本的风险等级快照。 */
  riskLevel: 'low' | 'medium' | 'high'
  publishedUrl?: string
}

export interface VersionListResponse {
  contentId: string
  versions: ContentVersionRecord[]
  currentVersionId: string
}

export interface RollbackContentRequest {
  contentId: string
  targetVersionId: string
  operator: OperatorInfo
  note?: string
}

export interface RollbackContentResponse {
  contentId: string
  status: PublishStatus
  versionNo: number
  rolledBackTo: string
  updatedAt: string
}
