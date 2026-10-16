/**
 * 流程 6：生成故事卡或研学讲稿 —— 接口契约。
 */
import type { AiMeta, OperatorInfo, VersionRef } from './common'

/** 输出类型。 */
export type OutputType = 'story_card' | 'study_script'

/** 语气。 */
export type Tone = 'plain' | 'narrative' | 'academic' | 'child' | 'official'

/** 篇幅。 */
export type LengthPreset = 'short' | 'medium' | 'long'

/** 引用来源。 */
export interface Citation {
  /** 正文中的角标序号，从 1 开始。 */
  index: number
  sourceId: string
  sourceTitle: string
  publisher: string
  /** 定位描述，例如「第 12 页」「00:08.8」。 */
  locatorText: string
  quote: string
  credibility: 'high' | 'medium' | 'low' | 'unverified'
}

/** 生成正文的一个区块（标题 + 段落）。 */
export interface DraftBlock {
  id: string
  heading: string
  body: string
  /** 该区块引用的角标序号。 */
  citationIndexes: number[]
  /** 是否为人工编辑过的区块。 */
  edited: boolean
}

/** 风险提示。 */
export interface RiskNote {
  level: 'info' | 'warning' | 'critical'
  category: 'legend_as_fact' | 'unsourced' | 'low_credibility' | 'sensitive' | 'copyright' | 'other'
  message: string
  suggestion: string
  relatedBlockId?: string
}

/* ---------------- POST /generations:create ---------------- */

export interface CreateGenerationRequest {
  outputType: OutputType
  tone: Tone
  length: LengthPreset
  title: string
  /** 目标读者，例如「小学四年级研学团」。 */
  audience?: string
  /** 纳入的论断 id（来自流程 5 中标注为「一致」的条目）。 */
  claimIds: string[]
  /** 允许引用的资料 id；为空时后端按论断自动关联。 */
  sourceIds: string[]
  /** 是否强制为每句结论附来源标注。 */
  requireCitation: boolean
  /** 是否允许收录「待核实」内容（默认 false，仅作为开放式提问呈现）。 */
  allowUnverified: boolean
  /** 创作自由度 0~1，0 = 严格复述资料。 */
  creativity: number
  /** 附加要求（自由文本）。 */
  extraInstruction?: string
  operator: OperatorInfo
}

export interface CreateGenerationResponse {
  draftId: string
  outputType: OutputType
  title: string
  blocks: DraftBlock[]
  citations: Citation[]
  /** 实际用到的资料 id。 */
  usedSourceIds: string[]
  /** 因风险被排除的资料 id。 */
  omittedSourceIds: string[]
  riskNotes: RiskNote[]
  version: VersionRef
  aiMeta: AiMeta
}

/* ---------------- POST /generations/{draftId}:regenerate ---------------- */

export interface RegenerateRequest {
  draftId: string
  /** 仅覆盖变化的部分参数，其余沿用上次。 */
  tone?: Tone
  length?: LengthPreset
  creativity?: number
  extraInstruction?: string
  /** 保留人工已编辑的区块。 */
  keepEditedBlocks: boolean
  operator: OperatorInfo
}

export interface RegenerateResponse {
  draftId: string
  blocks: DraftBlock[]
  citations: Citation[]
  riskNotes: RiskNote[]
  version: VersionRef
  aiMeta: AiMeta
  /** 因保留人工编辑而未重新生成的区块 id。 */
  preservedBlockIds: string[]
}

/* ---------------- PUT /generations/{draftId} ---------------- */

export interface SaveDraftRequest {
  draftId: string
  title: string
  blocks: DraftBlock[]
  /** true 时生成一个正式版本，false 仅保存草稿。 */
  createVersion: boolean
  note?: string
  operator: OperatorInfo
}

export interface SaveDraftResponse {
  draftId: string
  savedAt: string
  version: VersionRef
  /** 保存后的风险重算结果（编辑可能引入新风险）。 */
  riskNotes: RiskNote[]
}

/* ---------------- GET /generations/{draftId} ---------------- */

export interface GetDraftResponse {
  draftId: string
  outputType: OutputType
  title: string
  blocks: DraftBlock[]
  citations: Citation[]
  riskNotes: RiskNote[]
  version: VersionRef
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'archived'
  updatedAt: string
  updatedBy: OperatorInfo
}
