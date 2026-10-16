/**
 * 流程 2：转写并支持人工校正 —— 接口契约。
 */
import type { AiMeta, OperatorInfo, VersionRef } from './common'

/** 转写视图模式。 */
export type TranscriptViewMode = 'timeline' | 'paragraph'

/** 单个转写片段。 */
export interface TranscriptSegmentDTO {
  id: string
  /** 从 0 开始的顺序号。 */
  index: number
  startMs: number
  endMs: number
  speaker: string
  /** 当前版本的文本（可能已被人工校正）。 */
  text: string
  /** AI 原始文本，用于版本对比时显示「原本写了什么」。 */
  originalText: string
  /** 0~1 置信度。 */
  confidence: number
  /** 是否低于阈值（由后端按 threshold 计算，前端不重复判断）。 */
  lowConfidence: boolean
  /** 人工是否已校正该片段。 */
  edited: boolean
  /** 校正人。 */
  editedBy?: OperatorInfo
  /** ISO 8601 校正时间。 */
  editedAt?: string
  /** 词级时间戳，用于更细粒度的对齐（可选）。 */
  words?: Array<{ text: string; startMs: number; endMs: number }>
}

/** 段落视图：把若干片段合并为一段，供「段落」视图切换。 */
export interface TranscriptParagraphDTO {
  id: string
  speaker: string
  startMs: number
  endMs: number
  segmentIds: string[]
  text: string
  /** 该段落中的低置信度片段数。 */
  lowConfidenceCount: number
}

/* ---------------- POST /transcripts:start ---------------- */

export interface StartTranscribeRequest {
  interviewId: string
  /** BCP 47，例如 'zh-CN'。 */
  language: string
  /** 是否启用说话人分离。 */
  enableDiarization: boolean
  /** 领域词表，提升方言与专有名词识别率。 */
  vocabularyHints?: string[]
  /** 期望模型档位。 */
  modelHint?: 'fast' | 'balanced' | 'accurate'
  operator: OperatorInfo
}

export interface StartTranscribeResponse {
  taskId: string
  transcriptId: string
  status: 'queued' | 'running'
  /** 预估耗时（毫秒）。 */
  estimatedMs: number
  aiMeta: AiMeta
}

/* ---------------- GET /transcripts/{transcriptId} ---------------- */

export interface GetTranscriptResponse {
  transcriptId: string
  interviewId: string
  language: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'
  segments: TranscriptSegmentDTO[]
  paragraphs: TranscriptParagraphDTO[]
  /** 当前版本。 */
  version: VersionRef
  /** 低置信度阈值（0~1），后端下发以便与前端标记一致。 */
  lowConfidenceThreshold: number
  lowConfidenceCount: number
  editedCount: number
  aiMeta: AiMeta
  /** 任务失败时的原因。 */
  failureReason?: string
}

/* ---------------- POST /transcripts/{id}/corrections ---------------- */

export interface SegmentCorrection {
  segmentId: string
  /** 校正后的文本。 */
  text: string
  speaker?: string
  /** 校正原因，便于后续训练与审计。 */
  reason?: string
  /** 该校正是否来自 AI 建议。 */
  fromAiSuggestion?: boolean
}

export interface SubmitCorrectionRequest {
  transcriptId: string
  /** 基于哪个版本修改，用于乐观锁冲突检测。 */
  baseVersionId: string
  editor: OperatorInfo
  corrections: SegmentCorrection[]
  /** true 时仅存草稿，不生成新版本。 */
  saveAsDraft: boolean
  note?: string
}

export interface SubmitCorrectionResponse {
  versionId: string
  versionNo: number
  savedAt: string
  changedCount: number
  lowConfidenceRemaining: number
  /** 基于 baseVersionId 的冲突提示（乐观锁）。 */
  conflict?: { conflictSegmentIds: string[]; message: string } | null
}

/* ---------------- POST /transcripts/{id}/suggestions ---------------- */

export interface CorrectionSuggestion {
  segmentId: string
  originalText: string
  suggestedText: string
  /** AI 对建议本身的置信度 0~1。 */
  confidence: number
  /** 建议类型：错别字 / 方言用字 / 专有名词 / 断句。 */
  category: 'typo' | 'dialect' | 'proper_noun' | 'segmentation' | 'other'
  reason: string
  /** 命中的地方词表条目。 */
  glossaryHit?: string
}

export interface SuggestCorrectionsResponse {
  transcriptId: string
  suggestions: CorrectionSuggestion[]
  /** 建议所依据的模型与词表版本。 */
  aiMeta: AiMeta
  glossaryVersion: string
}

/* ---------------- 版本 ---------------- */

export interface TranscriptVersionRecord extends VersionRef {
  /** 版本来源：AI 初稿 / 人工校正 / 回滚。 */
  source: 'ai' | 'human' | 'rollback'
  changedCount: number
}

export interface TranscriptVersionListResponse {
  transcriptId: string
  versions: TranscriptVersionRecord[]
  currentVersionId: string
}

export interface RollbackTranscriptRequest {
  transcriptId: string
  targetVersionId: string
  operator: OperatorInfo
  note?: string
}

export interface RollbackTranscriptResponse {
  transcriptId: string
  currentVersionId: string
  versionNo: number
  segments: TranscriptSegmentDTO[]
}
