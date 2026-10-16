/**
 * 流程 3：提取地点 / 人物 / 事件 —— 接口契约。
 */
import type { AiMeta, ConfirmStatus, OperatorInfo } from './common'

/** 实体类别。 */
export type EntityKind = 'place' | 'person' | 'event' | 'organization' | 'artifact' | 'time'

/** 一条抽取结果与原始文本的对应关系（用于「跳转到原文」）。 */
export interface EvidenceRef {
  segmentId: string
  /** 原文中的字符区间，用于精确高亮。 */
  charStart: number
  charEnd: number
  /** 命中的原文片段。 */
  quote: string
  /** 片段起始时间（毫秒），用于回跳音频。 */
  startMs: number
}

/** 抽取出的实体。 */
export interface ExtractedEntity {
  id: string
  kind: EntityKind
  /** 原文中出现的形式，例如「三坊巷」。 */
  name: string
  /** 规范化后的标准名，例如「三坊七巷」。 */
  normalizedName: string
  /** 别名 / 异体写法。 */
  aliases: string[]
  /** 0~1。 */
  confidence: number
  /** 确认状态：pending 即界面上的「需人工确认」。 */
  confirmStatus: ConfirmStatus
  /** 不确定性说明，例如「原文发音含混，可能是『塔巷』」。 */
  uncertaintyNote?: string
  evidence: EvidenceRef[]
  /** 是否为人工新增。 */
  createdByHuman: boolean
  updatedBy?: OperatorInfo
  updatedAt?: string
}

/* ---------------- POST /extractions:start ---------------- */

export interface StartExtractionRequest {
  interviewId: string
  transcriptId: string
  kinds: EntityKind[]
  /** 低于该置信度的结果标为「待确认」。 */
  minConfidence: number
  operator: OperatorInfo
}

export interface StartExtractionResponse {
  taskId: string
  extractionId: string
  status: 'queued' | 'running'
  estimatedMs: number
  aiMeta: AiMeta
}

/* ---------------- GET /extractions/{extractionId} ---------------- */

export interface GetExtractionResponse {
  extractionId: string
  interviewId: string
  transcriptId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'
  entities: ExtractedEntity[]
  /** 待人工确认的实体数。 */
  pendingConfirmCount: number
  /** 疑似同义项分组，供「同义项合并」使用。 */
  duplicateGroups: DuplicateGroup[]
  aiMeta: AiMeta
  failureReason?: string
}

/** 同义项分组，例如「三坊七巷 / 三坊巷 / 三坊七巷街区」。 */
export interface DuplicateGroup {
  groupId: string
  /** 建议保留的实体 id。 */
  suggestedPrimaryId: string
  memberIds: string[]
  /** 依据说明。 */
  reason: string
  similarity: number
}

/* ---------------- POST /extractions/{id}/entities ---------------- */

export interface UpsertEntityRequest {
  extractionId: string
  /** 不传表示新增，传表示更新。 */
  entityId?: string
  kind: EntityKind
  name: string
  normalizedName: string
  aliases: string[]
  /** 人工确认 / 撤销确认。 */
  confirmStatus?: ConfirmStatus
  uncertaintyNote?: string
  /** 人工新增时补挂的原文依据。 */
  evidence?: EvidenceRef[]
  operator: OperatorInfo
}

export interface UpsertEntityResponse {
  entity: ExtractedEntity
  pendingConfirmCount: number
  versionNo: number
  updatedAt: string
}

export interface DeleteEntityRequest {
  extractionId: string
  entityId: string
  operator: OperatorInfo
  reason?: string
}

/** 同义项合并请求。 */
export interface MergeEntitiesRequest {
  extractionId: string
  /** 合并后保留的实体 id。 */
  primaryId: string
  /** 被合并（消失）的实体 id。 */
  mergedIds: string[]
  operator: OperatorInfo
  note?: string
}

export interface MergeEntitiesResponse {
  entity: ExtractedEntity
  /** 受影响而被删除的实体 id。 */
  removedIds: string[]
  /** 合并后的别名列表。 */
  mergedAliases: string[]
  pendingConfirmCount: number
  versionNo: number
}

/** 批量确认（一键采纳 AI 建议）。 */
export interface BatchConfirmRequest {
  extractionId: string
  entityIds: string[]
  confirmStatus: 'confirmed' | 'rejected'
  operator: OperatorInfo
}

export interface BatchConfirmResponse {
  entities: ExtractedEntity[]
  pendingConfirmCount: number
  confirmedCount: number
}
