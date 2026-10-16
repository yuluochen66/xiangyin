/**
 * 领域模型定义。
 *
 * 约定：所有时间统一使用毫秒（number，整数），所有日期使用 ISO 8601 字符串。
 * 前端不假设后端字段命名，本文件的类型即为前后端契约的**单一事实来源**。
 */

/** 来源类型。用于来源标签配色、筛选与图标。 */
export type SourceKind = 'interview' | 'document' | 'dataset' | 'media' | 'official'

/** 来源在原始载体中的定位信息。字段可选，取决于来源类型。 */
export interface SourceLocator {
  /** 文档页码。 */
  page?: number
  /** 原始链接。 */
  url?: string
  /** 音视频时间点（毫秒）。 */
  timecodeMs?: number
  /** 文档行号或表格行号。 */
  line?: number
}

/** 来源标签。审校过程中所有结论都可回溯到若干 SourceTag。 */
export interface SourceTag {
  id: string
  /** 展示名，短。 */
  label: string
  kind: SourceKind
  /** 发布方 / 提供方。 */
  publisher: string
  /** ISO 8601 日期。 */
  publishedAt: string
  /** 可信度 0~1，由检索或人工标注给出。 */
  confidence: number
  /** 是否已人工核实。 */
  verified: boolean
  /** 摘要原文片段，用于悬浮提示与检索结果展示。 */
  excerpt: string
  locator: SourceLocator
}

/** 论断核查结论。 */
export type ClaimVerdict = 'supported' | 'partial' | 'contradicted' | 'unverified'

/** 待核查的论断。 */
export interface Claim {
  id: string
  text: string
  /** 论断提出者，例如受访人。 */
  speaker?: string
  /** 已关联的来源 id。 */
  sourceIds: string[]
}

/** 单条论断的核查评估结果（compare_claims 的产出单元）。 */
export interface ClaimAssessment {
  claimId: string
  verdict: ClaimVerdict
  /** 0~1。 */
  confidence: number
  rationale: string
  supportingSourceIds: string[]
  contradictingSourceIds: string[]
}

/** 转写文本片段。音频文本联动的最小单元。 */
export interface TranscriptSegment {
  id: string
  /** 相对音频起点的起始时间（毫秒）。 */
  startMs: number
  /** 结束时间（毫秒），恒大于 startMs。 */
  endMs: number
  speaker: string
  text: string
  /** 该片段涉及的论断 id。 */
  claimIds: string[]
  /** 该片段引用的来源 id。 */
  sourceIds: string[]
}

/** 一份完整转写稿。 */
export interface Transcript {
  id: string
  title: string
  /** 音频地址；支持静态资源路径或 blob: URL。 */
  audioUrl: string
  /** BCP 47，例如 zh-CN。 */
  language: string
  segments: TranscriptSegment[]
}

/** 审校单元状态。 */
export type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'flagged'

/** 批注严重级别。 */
export type AnnotationSeverity = 'info' | 'warning' | 'critical'

/** 审校批注。 */
export interface Annotation {
  id: string
  author: string
  /** ISO 8601 时间戳。 */
  createdAt: string
  severity: AnnotationSeverity
  body: string
  status: ReviewStatus
}

/** 审校单元：原文与修订稿成对出现，是审校对照视图的数据单元。 */
export interface ReviewUnit {
  id: string
  /** 对应的转写片段 id，用于反向定位音频。 */
  segmentId: string
  original: string
  revised: string
  status: ReviewStatus
  annotations: Annotation[]
  claimIds: string[]
}

/** 故事卡时间线条目。 */
export interface StoryTimelineEntry {
  id: string
  /** ISO 8601 时间戳。 */
  at: string
  title: string
  detail: string
}

/** 故事卡：由若干已核查论断聚合而成的可发布结构。 */
export interface StoryCard {
  id: string
  headline: string
  summary: string
  timeline: StoryTimelineEntry[]
  keyClaimIds: string[]
  sourceIds: string[]
  /** 发布风险等级。 */
  riskLevel: 'low' | 'medium' | 'high'
  /** ISO 8601 时间戳。 */
  generatedAt: string
}
