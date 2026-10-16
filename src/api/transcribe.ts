/**
 * 流程 2：转写并支持人工校正 —— 接口调用层。
 */
import { request } from '@/services/api'
import type { ApiResponse } from '@/services/api/httpClient'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import { isConfirmScenario, isEmptyScenario, mockId, nowIso } from '@/mock/helpers'
import { mockStore } from '@/mock/store'
import type {
  CorrectionSuggestion,
  GetTranscriptResponse,
  RollbackTranscriptRequest,
  RollbackTranscriptResponse,
  StartTranscribeRequest,
  StartTranscribeResponse,
  SubmitCorrectionRequest,
  SubmitCorrectionResponse,
  SuggestCorrectionsResponse,
  TranscriptVersionListResponse,
} from '@/types/api'

/** 方言 / 专有名词词表（mock 用；真实环境由后端下发 glossaryVersion）。 */
const GLOSSARY: Array<{
  match: RegExp
  suggest: string
  category: CorrectionSuggestion['category']
  reason: string
  glossaryHit: string
  confidence: number
}> = [
  {
    match: /半迷暗/g,
    suggest: '半暝暗',
    category: 'dialect',
    reason: '福州话「半暝暗」指半夜，此处疑为记音用字不一致。',
    glossaryHit: '福州方言常用字表 v3 · 半暝暗',
    confidence: 0.86,
  },
  {
    match: /阮依爹/g,
    suggest: '阮依爹（我父亲）',
    category: 'dialect',
    reason: '「依爹」为福州话父亲称谓，建议首次出现时补注释，便于外地读者理解。',
    glossaryHit: '福州方言亲属称谓表 v2 · 依爹',
    confidence: 0.79,
  },
  {
    match: /伊名号叫/g,
    suggest: '伊名号叫',
    category: 'proper_noun',
    reason: '「名号」在福州话中可指姓名，此处语义明确，仅建议核对标点。',
    glossaryHit: '福州方言常用字表 v3 · 名号',
    confidence: 0.55,
  },
  {
    match: /角梳/g,
    suggest: '牛角梳',
    category: 'proper_noun',
    reason: '前后文已出现「牛角梳」，「角梳」疑为重复或漏字。',
    glossaryHit: '福州手工艺名词表 v1 · 牛角梳',
    confidence: 0.82,
  },
  {
    match: /爱做四十外道工序/g,
    suggest: '要做四十多道工序',
    category: 'dialect',
    reason: '福州话「爱」表「要」，「四十外」表「四十余」，建议转为普通话书面表达。',
    glossaryHit: '福州方言常用字表 v3 · 爱／外',
    confidence: 0.88,
  },
  {
    match: /会行半日/g,
    suggest: '能逛半天',
    category: 'dialect',
    reason: '「会行」表「能走／能逛」，建议规范化以提升可读性。',
    glossaryHit: '福州方言常用字表 v3 · 会行',
    confidence: 0.74,
  },
]

export const transcribeApi = {
  /**
   * 发起转写任务。
   * POST /transcripts:start
   * @param body 转写请求体：音频或采访 id 与语言设置
   * @returns 转写任务：任务 id 与初始状态
   */
  start(body: StartTranscribeRequest): Promise<ApiResponse<StartTranscribeResponse>> {
    return request<StartTranscribeRequest, StartTranscribeResponse>({
      label: '发起转写',
      method: 'POST',
      url: '/transcripts:start',
      body,
      mock: (ctx) => ({
        taskId: mockId('TASK'),
        transcriptId: 'T-2024-0312',
        status: 'running' as const,
        estimatedMs: 754_000 / 6,
        aiMeta: {
          model: 'fuzhou-asr',
          modelVersion: '2.1.0',
          confidence: 0.81,
          // 「需人工确认」场景：强制要求人工复核后才能进入下一步
          needsHumanConfirm: true,
          promptVersion: 'asr-p-2024-04',
          generatedAt: nowIso(),
          tookMs: isConfirmScenario(ctx) ? 12_000 : 4_200,
        },
      }),
    })
  },

  /**
   * 拉取转写结果。
   * GET /transcripts/{transcriptId}
   * @param transcriptId 转写任务 id
   * @returns 转写结果：分段、置信度与说话人
   */
  getTranscript(transcriptId: string): Promise<ApiResponse<GetTranscriptResponse>> {
    return request<unknown, GetTranscriptResponse>({
      label: '拉取转写结果',
      method: 'GET',
      url: '/transcripts/{transcriptId}',
      path: { transcriptId },
      mock: (ctx) => {
        const segments = isEmptyScenario(ctx) ? [] : mockStore.segments
        const paragraphs = isEmptyScenario(ctx) ? [] : mockStore.paragraphs
        const lowCount = segments.filter((segment) => segment.lowConfidence).length

        return {
          transcriptId,
          interviewId: 'INT-2024-0312',
          language: 'zh-CN',
          status: segments.length === 0 ? ('partial' as const) : ('succeeded' as const),
          segments,
          paragraphs,
          version: {
            versionId: mockStore.currentTranscriptVersionId,
            versionNo:
              mockStore.transcriptVersions.find(
                (item) => item.versionId === mockStore.currentTranscriptVersionId,
              )?.versionNo ?? 1,
            createdBy: CURRENT_OPERATOR,
            createdAt: nowIso(),
            note: '当前版本',
          },
          lowConfidenceThreshold: mockStore.lowConfidenceThreshold,
          lowConfidenceCount: isConfirmScenario(ctx) ? segments.length : lowCount,
          editedCount: segments.filter((segment) => segment.edited).length,
          aiMeta: {
            model: 'fuzhou-asr',
            modelVersion: '2.1.0',
            confidence: 0.81,
            needsHumanConfirm: lowCount > 0,
            generatedAt: nowIso(),
            tookMs: 3_800,
          },
        }
      },
      isEmpty: (data) => data.segments.length === 0,
    })
  },

  /**
   * 获取逐段校正建议。
   * POST /transcripts/{transcriptId}/suggestions
   * @param transcriptId 转写任务 id
   * @returns AI 校正建议列表，每条附理由
   */
  suggestCorrections(transcriptId: string): Promise<ApiResponse<SuggestCorrectionsResponse>> {
    return request<unknown, SuggestCorrectionsResponse>({
      label: '获取校正建议',
      method: 'POST',
      url: '/transcripts/{transcriptId}/suggestions',
      path: { transcriptId },
      mock: (ctx) => {
        if (isEmptyScenario(ctx)) {
          return {
            transcriptId,
            suggestions: [],
            glossaryVersion: 'glossary-v3.2',
            aiMeta: {
              model: 'fuzhou-asr-corrector',
              modelVersion: '1.4.0',
              confidence: 0,
              needsHumanConfirm: false,
              generatedAt: nowIso(),
              tookMs: 900,
            },
          }
        }

        const suggestions: CorrectionSuggestion[] = []
        for (const segment of mockStore.segments) {
          for (const rule of GLOSSARY) {
            const matched = rule.match.test(segment.text)
            rule.match.lastIndex = 0
            if (!matched) continue
            suggestions.push({
              segmentId: segment.id,
              originalText: segment.text,
              suggestedText: segment.text.replace(rule.match, rule.suggest),
              confidence: rule.confidence,
              category: rule.category,
              reason: rule.reason,
              glossaryHit: rule.glossaryHit,
            })
            rule.match.lastIndex = 0
          }
        }

        return {
          transcriptId,
          suggestions,
          glossaryVersion: 'glossary-v3.2',
          aiMeta: {
            model: 'fuzhou-asr-corrector',
            modelVersion: '1.4.0',
            confidence: 0.78,
            needsHumanConfirm: true,
            promptVersion: 'corr-p-2024-05',
            generatedAt: nowIso(),
            tookMs: 1_650,
          },
        }
      },
      isEmpty: (data) => data.suggestions.length === 0,
    })
  },

  /**
   * 提交人工校正。
   * POST /transcripts/{transcriptId}/corrections
   * @param body 校正提交体：逐段的修改内容
   * @returns 保存后的校正结果与新版本号
   */
  submitCorrections(body: SubmitCorrectionRequest): Promise<ApiResponse<SubmitCorrectionResponse>> {
    return request<SubmitCorrectionRequest, SubmitCorrectionResponse>({
      label: '保存校正结果',
      method: 'POST',
      url: '/transcripts/{transcriptId}/corrections',
      path: { transcriptId: body.transcriptId },
      body,
      mock: () => {
        const changed = body.corrections.filter((item) => item.text.trim().length > 0)

        for (const correction of changed) {
          const segment = mockStore.segments.find((item) => item.id === correction.segmentId)
          if (!segment) continue
          segment.text = correction.text
          if (correction.speaker) segment.speaker = correction.speaker
          segment.edited = true
          segment.editedBy = body.editor
          segment.editedAt = nowIso()
          // 人工校正后视为已确认，置信度提升
          segment.confidence = Math.max(segment.confidence, 0.9)
          segment.lowConfidence = false
        }

        const lowRemaining = mockStore.segments.filter((item) => item.lowConfidence).length

        if (body.saveAsDraft) {
          return {
            versionId: mockStore.currentTranscriptVersionId,
            versionNo:
              mockStore.transcriptVersions.find(
                (item) => item.versionId === mockStore.currentTranscriptVersionId,
              )?.versionNo ?? 1,
            savedAt: nowIso(),
            changedCount: changed.length,
            lowConfidenceRemaining: lowRemaining,
            conflict: null,
          }
        }

        const versionNo = mockStore.transcriptVersions.length + 1
        const versionId = mockId('TVER')
        mockStore.transcriptVersions.push({
          versionId,
          versionNo,
          createdBy: body.editor,
          createdAt: nowIso(),
          note: body.note ?? '人工校正',
          source: 'human',
          changedCount: changed.length,
        })
        mockStore.currentTranscriptVersionId = versionId

        return {
          versionId,
          versionNo,
          savedAt: nowIso(),
          changedCount: changed.length,
          lowConfidenceRemaining: lowRemaining,
          conflict: null,
        }
      },
    })
  },

  /**
   * 版本列表。
   * GET /transcripts/{transcriptId}/versions
   * @param transcriptId 转写任务 id
   * @returns 该转写的历史版本列表，按时间倒序
   */
  listVersions(transcriptId: string): Promise<ApiResponse<TranscriptVersionListResponse>> {
    return request<unknown, TranscriptVersionListResponse>({
      label: '获取版本列表',
      method: 'GET',
      url: '/transcripts/{transcriptId}/versions',
      path: { transcriptId },
      mock: (ctx) => ({
        transcriptId,
        versions: isEmptyScenario(ctx) ? [] : [...mockStore.transcriptVersions].reverse(),
        currentVersionId: mockStore.currentTranscriptVersionId,
      }),
      isEmpty: (data) => data.versions.length === 0,
    })
  },

  /**
   * 回滚到指定版本。
   * POST /transcripts/{transcriptId}/rollback
   * @param body 回滚请求体：目标版本 id
   * @returns 回滚后的转写版本信息
   */
  rollback(body: RollbackTranscriptRequest): Promise<ApiResponse<RollbackTranscriptResponse>> {
    return request<RollbackTranscriptRequest, RollbackTranscriptResponse>({
      label: '回滚转写版本',
      method: 'POST',
      url: '/transcripts/{transcriptId}/rollback',
      path: { transcriptId: body.transcriptId },
      body,
      mock: () => {
        const target = mockStore.transcriptVersions.find(
          (item) => item.versionId === body.targetVersionId,
        )
        // 回滚 AI 初稿时恢复低置信度标记，人工校正版本则保持已确认
        if (target?.source === 'ai') {
          for (const segment of mockStore.segments) {
            segment.text = segment.originalText
            segment.edited = false
            segment.editedBy = undefined
            segment.editedAt = undefined
          }
        }

        const versionNo = mockStore.transcriptVersions.length + 1
        const versionId = mockId('TVER')
        mockStore.transcriptVersions.push({
          versionId,
          versionNo,
          createdBy: body.operator,
          createdAt: nowIso(),
          note: body.note ?? `回滚至版本 ${target?.versionNo ?? '?'}`,
          source: 'rollback',
          changedCount: mockStore.segments.length,
        })
        mockStore.currentTranscriptVersionId = versionId

        return {
          transcriptId: body.transcriptId,
          currentVersionId: versionId,
          versionNo,
          segments: mockStore.segments,
        }
      },
    })
  },
}
