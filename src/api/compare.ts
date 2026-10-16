/**
 * 流程 5：标注一致或有差异之处 —— 接口调用层。
 */
import { request } from '@/services/api'
import type { ApiResponse } from '@/services/api/httpClient'
import { isEmptyScenario, nowIso } from '@/mock/helpers'
import { mockStore } from '@/mock/store'
import type {
  AnnotationStats,
  ComparisonItem,
  GetComparisonResponse,
  RejudgeItemRequest,
  RejudgeItemResponse,
  StartComparisonRequest,
  StartComparisonResponse,
  SubmitAnnotationsRequest,
  SubmitAnnotationsResponse,
} from '@/types/api'

const COMPARISON_ID = 'CMP-2024-0007'

/**
 * 计算标注进度统计。
 * @param items 逐条比对的结果项
 * @returns 一致 / 差异 / 待核实三类的条数统计
 */
function computeStats(items: ComparisonItem[]): AnnotationStats {
  const annotated = items.filter((item) => item.annotationState === 'annotated')
  const finalVerdict = (item: ComparisonItem): string => item.humanVerdict ?? item.aiVerdict

  return {
    total: items.length,
    annotated: annotated.length,
    progress: items.length > 0 ? Number((annotated.length / items.length).toFixed(4)) : 0,
    consistent: items.filter((item) => finalVerdict(item) === 'consistent').length,
    conflict: items.filter((item) => finalVerdict(item) === 'conflict').length,
    needsVerification: items.filter((item) => finalVerdict(item) === 'needs_verification').length,
    insufficient: items.filter((item) => finalVerdict(item) === 'insufficient').length,
    disagreedWithAi: annotated.filter((item) => item.humanVerdict !== item.aiVerdict).length,
  }
}

export const compareApi = {
  /**
   * 发起比对任务（AI 自动初判）。
   * POST /comparisons:start
   * @param body 比对请求体：内容 id 与要比对的资料范围
   * @returns 比对任务：任务 id 与初始状态
   */
  start(body: StartComparisonRequest): Promise<ApiResponse<StartComparisonResponse>> {
    return request<StartComparisonRequest, StartComparisonResponse>({
      label: '发起差异比对',
      method: 'POST',
      url: '/comparisons:start',
      body,
      mock: (ctx) => {
        const items = isEmptyScenario(ctx) ? [] : mockStore.comparisonItems
        const filtered =
          body.claimIds && body.claimIds.length > 0
            ? items.filter((item) => body.claimIds?.includes(item.claimBlockId ?? ''))
            : items

        return {
          comparisonId: COMPARISON_ID,
          draftId: body.draftId,
          items: filtered.map((item) =>
            body.enableAutoJudge
              ? item
              : {
                  ...item,
                  aiVerdict: 'insufficient' as const,
                  aiConfidence: 0,
                  aiReason: '未启用 AI 自动初判，请人工标注。',
                },
          ),
          stats: computeStats(filtered),
          aiMeta: {
            model: 'fuzhou-claim-checker',
            modelVersion: '1.9.2',
            confidence: 0.81,
            needsHumanConfirm: true,
            promptVersion: 'cmp-p-2024-05',
            generatedAt: nowIso(),
            tookMs: 3_400,
          },
        }
      },
      isEmpty: (data) => data.items.length === 0,
    })
  },

  /**
   * 拉取比对结果。
   * GET /comparisons/{comparisonId}
   * @param comparisonId 比对任务 id
   * @returns 比对结果：逐条论断与配对资料
   */
  getComparison(comparisonId: string): Promise<ApiResponse<GetComparisonResponse>> {
    return request<unknown, GetComparisonResponse>({
      label: '拉取比对结果',
      method: 'GET',
      url: '/comparisons/{comparisonId}',
      path: { comparisonId },
      mock: (ctx) => {
        const items = isEmptyScenario(ctx) ? [] : mockStore.comparisonItems
        return {
          comparisonId,
          draftId: mockStore.generation.draftId,
          items,
          stats: computeStats(items),
          status: 'succeeded' as const,
          aiMeta: {
            model: 'fuzhou-claim-checker',
            modelVersion: '1.9.2',
            confidence: 0.81,
            needsHumanConfirm: items.some((item) => item.annotationState === 'unannotated'),
            generatedAt: nowIso(),
            tookMs: 1_200,
          },
        }
      },
      isEmpty: (data) => data.items.length === 0,
    })
  },

  /**
   * 提交人工标注。
   * POST /comparisons/{comparisonId}/annotations
   * @param body 标注提交体：逐条论断的判定与理由
   * @returns 保存后的标注结果与统计
   */
  submitAnnotations(
    body: SubmitAnnotationsRequest,
  ): Promise<ApiResponse<SubmitAnnotationsResponse>> {
    return request<SubmitAnnotationsRequest, SubmitAnnotationsResponse>({
      label: '提交标注',
      method: 'POST',
      url: '/comparisons/{comparisonId}/annotations',
      path: { comparisonId: body.comparisonId },
      body,
      mock: () => {
        const invalid: Array<{ itemId: string; message: string }> = []
        let savedCount = 0

        for (const annotation of body.annotations) {
          const item = mockStore.comparisonItems.find((entry) => entry.itemId === annotation.itemId)
          if (!item) {
            invalid.push({ itemId: annotation.itemId, message: '比对项不存在。' })
            continue
          }

          // 业务校验：判定为「差异 / 待核实」时必须填写原因
          if (
            (annotation.verdict === 'conflict' || annotation.verdict === 'needs_verification') &&
            annotation.reason.trim().length === 0
          ) {
            invalid.push({
              itemId: annotation.itemId,
              message: '判定为「差异」或「待核实」时必须填写差异原因。',
            })
            continue
          }

          item.humanVerdict = annotation.verdict
          item.humanReason = annotation.reason
          item.humanReasonTags = [...annotation.reasonTags]
          item.annotator = body.annotator
          item.annotatedAt = nowIso()
          item.annotationState = 'annotated'
          savedCount += 1
        }

        return {
          comparisonId: body.comparisonId,
          savedAt: nowIso(),
          savedCount,
          stats: computeStats(mockStore.comparisonItems),
          invalid,
        }
      },
    })
  },

  /**
   * 对单条比对结果请求 AI 重判。
   * POST /comparisons/{comparisonId}/items/{itemId}:rejudge
   * @param body 单条重判请求体：比对项 id 与新判定
   * @returns 重判后的单条比对结果
   */
  rejudgeItem(body: RejudgeItemRequest): Promise<ApiResponse<RejudgeItemResponse>> {
    return request<RejudgeItemRequest, RejudgeItemResponse>({
      label: '请求 AI 重判',
      method: 'POST',
      url: '/comparisons/{comparisonId}/items/{itemId}:rejudge',
      path: { comparisonId: body.comparisonId, itemId: body.itemId },
      body,
      mock: () => {
        const item = mockStore.comparisonItems.find((entry) => entry.itemId === body.itemId)
        if (!item) throw new Error('比对项不存在。')

        // 重判：把置信度向 0.5 收敛（人工补充上下文后模型更谨慎）
        const adjusted = Math.max(0.5, Math.min(0.95, (item.aiConfidence + 0.6) / 2))
        item.aiConfidence = Number(adjusted.toFixed(2))
        item.aiReason = body.hints
          ? `已结合人工补充的上下文重新比对。${item.aiReason}`
          : item.aiReason

        return {
          item,
          aiMeta: {
            model: 'fuzhou-claim-checker',
            modelVersion: '1.9.2',
            confidence: item.aiConfidence,
            needsHumanConfirm: true,
            generatedAt: nowIso(),
            tookMs: 2_100,
          },
        }
      },
    })
  },
}
