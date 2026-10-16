/**
 * 流程 1：上传已授权采访录音 —— 接口契约。
 */
import type { AiMeta, ConfirmStatus, OperatorInfo, RemoteTaskStatus } from './common'

/** 允许的音频格式（与后端白名单保持一致，TODO-UP-1 待确认最终清单）。 */
export type AudioFormat = 'mp3' | 'wav' | 'm4a' | 'aac' | 'flac' | 'ogg'

/** 授权类型。口述史项目必须逐条确认授权范围。 */
export type LicenseType =
  | 'public' // 公开授权，可对外发布
  | 'research_only' // 仅研究使用，不得公开发布
  | 'internal' // 仅项目内部使用
  | 'limited_time' // 限时授权，到期需重新确认

/** 授权确认状态。 */
export type LicenseStatus = ConfirmStatus

/** 上传约束。前端用它做格式与大小前置校验，避免无效上传。 */
export interface UploadConstraints {
  allowedFormats: AudioFormat[]
  /** 单文件大小上限（字节）。 */
  maxSizeBytes: number
  /** 单条录音时长上限（毫秒）。 */
  maxDurationMs: number
  /** 最短时长，过短视为无效录音。 */
  minDurationMs: number
  /** 分片大小（字节）。 */
  chunkSizeBytes: number
}

/** 同名 / 重复文件命中结果。 */
export interface DuplicateHit {
  interviewId: string
  title: string
  fileName: string
  /** ISO 8601。 */
  uploadedAt: string
  uploadedBy: OperatorInfo
  /** 内容指纹相似度 0~1。 */
  similarity: number
  /** 后端建议：跳过 / 覆盖 / 仍然新建。 */
  suggestion: 'skip' | 'overwrite' | 'create_new'
}

/* ---------------- POST /interviews/uploads:init ---------------- */

export interface UploadInitRequest {
  title: string
  /** 讲述人姓名。 */
  narrator: string
  interviewer: string
  fileName: string
  sizeBytes: number
  mimeType: string
  /** 前端预读的时长（毫秒），浏览器不支持时传 undefined。 */
  durationMs?: number
  /** 内容指纹（如 sha256 前 16 位），用于重复检测。 */
  checksum?: string
  /** ISO 8601 采录日期。 */
  recordedAt: string
  /** 采录地点，例如「三坊七巷·水榭戏台」。 */
  recordedPlace: string
  /** 采录语言/方言，例如 '闽东语·福州话'。 */
  dialect?: string
  /** 项目归属。 */
  projectId?: string
  /** 授权类型（此时仅为声明，最终以授权确认为准）。 */
  licenseType: LicenseType
}

export interface UploadInitResponse {
  uploadId: string
  interviewId: string
  /** 后端下发的分片大小（字节），可能覆盖前端默认值。 */
  chunkSizeBytes: number
  totalChunks: number
  /** 预签名直传地址（若后端采用直传方案，TODO-UP-2 待确认）。 */
  chunkUrls?: string[]
  /** ISO 8601 上传会话过期时间。 */
  expiresAt: string
  /** 命中重复文件时返回，前端需弹窗让用户选择。 */
  duplicate?: DuplicateHit | null
  constraints: UploadConstraints
}

/* ---------------- POST /interviews/uploads/{uploadId}/chunks ---------------- */

export interface ChunkUploadRequest {
  uploadId: string
  chunkIndex: number
  totalChunks: number
  /** 分片校验和，用于服务端校验完整性。 */
  checksum?: string
  /** 分片二进制。真实实现为 multipart/form-data 或直传。 */
  blob?: Blob
}

export interface ChunkUploadResponse {
  uploadId: string
  chunkIndex: number
  /** 累计已接收分片数。 */
  received: number
  total: number
  /** 0~1。 */
  progress: number
  uploadedBytes: number
  /** 预估剩余时间（毫秒），无法估算时为 null。 */
  remainingMs: number | null
}

/* ---------------- GET /interviews/uploads/{uploadId} ---------------- */

export interface UploadStatusResponse {
  uploadId: string
  status: RemoteTaskStatus | 'merging'
  uploadedBytes: number
  totalBytes: number
  /** 0~1。 */
  progress: number
  remainingMs: number | null
  /** 失败的分片下标，前端据此做断点重传。 */
  failedChunks: number[]
  message?: string
}

/* ---------------- POST /interviews/uploads/{uploadId}:complete ---------------- */

export interface UploadCompleteResponse {
  interviewId: string
  audioUrl: string
  durationMs: number
  status: RemoteTaskStatus
  licenseStatus: LicenseStatus
}

/* ---------------- POST /interviews/{interviewId}/license ---------------- */

export interface LicenseConfirmRequest {
  interviewId: string
  decision: 'confirmed' | 'rejected'
  licenseType: LicenseType
  /** 授权人（讲述人或其代理人）。 */
  signer: string
  /** ISO 8601 签署时间。 */
  signedAt: string
  note?: string
  /** 授权书扫描件地址。 */
  attachments?: string[]
  operator: OperatorInfo
}

export interface LicenseConfirmResponse {
  interviewId: string
  licenseStatus: LicenseStatus
  licenseType: LicenseType
  confirmedBy?: string
  confirmedAt?: string
  /** 授权凭证编号。 */
  certificateNo?: string
  aiMeta?: AiMeta
}

/* ---------------- GET /interviews ---------------- */

export interface InterviewSummary {
  interviewId: string
  title: string
  narrator: string
  interviewer: string
  recordedAt: string
  recordedPlace: string
  durationMs: number
  fileName: string
  format: AudioFormat
  sizeBytes: number
  licenseStatus: LicenseStatus
  licenseType: LicenseType
  /** 已推进到的流程编号 1~7。 */
  stage: number
  createdAt: string
}

export interface InterviewListResponse {
  list: InterviewSummary[]
  total: number
}
