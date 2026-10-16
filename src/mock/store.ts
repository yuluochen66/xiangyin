/**
 * Mock 可变状态仓库。
 *
 * 数据集本身是只读常量；本模块把它深拷贝一份放进 `reactive`，
 * 让原型在会话内具备「编辑后数据真的变了」的真实感
 * （人工校正、实体合并、标注提交、版本回滚都会写到这里）。
 *
 * 接入真实后端后本文件可以整体删除，业务代码不直接依赖它。
 */
import { reactive } from 'vue'

import type {
  ComparisonItem,
  ContentVersionRecord,
  CreateGenerationResponse,
  DuplicateGroup,
  ExtractedEntity,
  InterviewSummary,
  PublishStatus,
  SearchHit,
  TranscriptParagraphDTO,
  TranscriptSegmentDTO,
  TranscriptVersionRecord,
} from '@/types/api'

import {
  DEMO_COMPARISON_ITEMS,
  DEMO_CONTENT_VERSIONS,
  DEMO_CURRENT_CONTENT_VERSION,
  DEMO_DUPLICATE_GROUPS,
  DEMO_ENTITIES,
  DEMO_GENERATION,
  DEMO_INTERVIEWS,
  DEMO_PARAGRAPHS,
  DEMO_SEGMENTS,
  DEMO_SOURCES,
  LOW_CONFIDENCE_THRESHOLD,
} from './dataset'

/**
 * 深拷贝，切断与只读常量的引用关系。
 * @param value 要深拷贝的值
 * @returns 与只读常量完全脱离引用的副本
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export interface StoredUpload {
  uploadId: string
  interviewId: string
  fileName: string
  totalBytes: number
  totalChunks: number
  uploadedChunks: number
  status: 'uploading' | 'merging' | 'succeeded' | 'failed'
  failedChunks: number[]
  /** 前端声明的表单信息。 */
  meta: Record<string, unknown>
}

export interface MockState {
  interviews: InterviewSummary[]
  segments: TranscriptSegmentDTO[]
  paragraphs: TranscriptParagraphDTO[]
  entities: ExtractedEntity[]
  duplicateGroups: DuplicateGroup[]
  sources: SearchHit[]
  comparisonItems: ComparisonItem[]
  generation: CreateGenerationResponse
  contentVersions: ContentVersionRecord[]
  currentContentVersionId: string
  publishStatus: PublishStatus
  transcriptVersions: TranscriptVersionRecord[]
  currentTranscriptVersionId: string
  lowConfidenceThreshold: number
  uploads: Record<string, StoredUpload>
}

function createInitialState(): MockState {
  const segments = clone(DEMO_SEGMENTS)
  const lowCount = segments.filter((s) => s.lowConfidence).length

  const transcriptVersions: TranscriptVersionRecord[] = [
    {
      versionId: 'TVER-0001',
      versionNo: 1,
      createdBy: { id: 'AI', name: 'AI 转写', role: 'system' },
      createdAt: '2024-03-12T16:02:00+08:00',
      note: 'AI 初稿，低置信度片段 ' + String(lowCount) + ' 段',
      source: 'ai',
      changedCount: segments.length,
    },
    {
      versionId: 'TVER-0002',
      versionNo: 2,
      createdBy: { id: 'OP-1001', name: '陈明', role: '编审' },
      createdAt: '2024-03-13T10:40:00+08:00',
      note: '校正福州方言用字与专有名词',
      source: 'human',
      changedCount: 2,
    },
  ]

  return {
    interviews: clone(DEMO_INTERVIEWS),
    segments,
    paragraphs: clone(DEMO_PARAGRAPHS),
    entities: clone(DEMO_ENTITIES),
    duplicateGroups: clone(DEMO_DUPLICATE_GROUPS),
    sources: clone(DEMO_SOURCES),
    comparisonItems: clone(DEMO_COMPARISON_ITEMS),
    generation: clone(DEMO_GENERATION),
    contentVersions: clone(DEMO_CONTENT_VERSIONS),
    currentContentVersionId: DEMO_CURRENT_CONTENT_VERSION,
    publishStatus: 'draft',
    transcriptVersions,
    currentTranscriptVersionId: 'TVER-0002',
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    uploads: {},
  }
}

/** 全局 mock 状态。 */
export const mockStore = reactive<MockState>(createInitialState())

/** 重置到初始状态（调试用）。 */
export function resetMockStore(): void {
  Object.assign(mockStore, createInitialState())
}
