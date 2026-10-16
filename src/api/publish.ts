/**
 * 流程 7：审核发布 —— 接口调用层。
 *
 * 状态机集中在本文件，避免流转规则散落到各个组件中。
 */
import { request } from '@/services/api'
import type { ApiResponse } from '@/services/api/httpClient'
import { mockId, nowIso } from '@/mock/helpers'
import { mockStore } from '@/mock/store'
import type {
  FinalConfirmRequest,
  PublishResponse,
  PublishStatus,
  ReviewAction,
  ReviewCommentRequest,
  ReviewCommentResponse,
  ReviewRisk,
  RiskCheckResponse,
  RollbackContentRequest,
  RollbackContentResponse,
  TransitionRequest,
  TransitionResponse,
  VersionListResponse,
} from '@/types/api'

/** 状态机：当前状态 → 允许的动作 → 动作后的状态。 */
const TRANSITIONS: Record<PublishStatus, Partial<Record<ReviewAction, PublishStatus>>> = {
  draft: { submit: 'pending_review' },
  pending_review: { approve: 'approved', reject: 'rejected', withdraw: 'draft' },
  approved: { publish: 'published', reject: 'rejected' },
  rejected: { submit: 'pending_review', withdraw: 'draft' },
  published: { archive: 'archived' },
  archived: { publish: 'published' },
}

/**
 * 计算某状态下的可执行动作。
 * @param status 内容当前状态
 * @returns 该状态下允许执行的流转动作
 */
function allowedActions(status: PublishStatus): ReviewAction[] {
  return Object.keys(TRANSITIONS[status]) as ReviewAction[]
}

export const publishApi = {
  /**
   * 状态流转。
   * POST /contents/{contentId}/transitions
   * @param body 流转请求体：目标状态与流转理由
   * @returns 流转后的内容状态与关键时间点
   */
  transition(body: TransitionRequest): Promise<ApiResponse<TransitionResponse>> {
    return request<TransitionRequest, TransitionResponse>({
      label: '提交状态流转',
      method: 'POST',
      url: '/contents/{contentId}/transitions',
      path: { contentId: body.contentId },
      body,
      mock: () => {
        const current = mockStore.publishStatus

        // 乐观锁：状态已被他人改变时拒绝
        if (body.expectedFrom !== current) {
          const error = new Error(
            `内容状态已变更（期望 ${body.expectedFrom}，当前 ${current}），请刷新后重试。`,
          )
          error.name = 'ConflictError'
          throw error
        }

        const next = TRANSITIONS[current][body.action]
        if (!next) {
          throw new Error(`当前状态「${current}」不允许执行「${body.action}」。`)
        }

        mockStore.publishStatus = next
        const versionNo = mockStore.contentVersions.length + 1

        mockStore.contentVersions.push({
          versionId: mockId('VER'),
          versionNo,
          createdBy: body.operator,
          createdAt: nowIso(),
          note: body.comment ?? `${body.action} → ${next}`,
          status: next,
          riskLevel: next === 'approved' || next === 'published' ? 'low' : 'medium',
        })

        return {
          contentId: body.contentId,
          status: next,
          versionNo,
          updatedAt: nowIso(),
          allowedActions: allowedActions(next),
          reviewId: next === 'pending_review' ? mockId('REV') : undefined,
          publishedUrl: next === 'published' ? '/published/fz-oral-0007' : undefined,
        }
      },
    })
  },

  /**
   * AI 审核风险提醒。
   * POST /contents/{contentId}/risk-check
   * @param contentId 内容 id
   * @returns AI 风险检查结果：风险级别与提醒项
   */
  riskCheck(contentId: string): Promise<ApiResponse<RiskCheckResponse>> {
    return request<unknown, RiskCheckResponse>({
      label: '审核风险检查',
      method: 'POST',
      url: '/contents/{contentId}/risk-check',
      path: { contentId },
      mock: () => {
        const risks: ReviewRisk[] = []
        let seq = 0
        const nextId = (): string => {
          seq += 1
          return `RISK-${String(seq).padStart(3, '0')}`
        }

        // 1. 来自比对流程的未标注项
        const unannotated = mockStore.comparisonItems.filter(
          (item) => item.annotationState === 'unannotated',
        )
        if (unannotated.length > 0) {
          risks.push({
            id: nextId(),
            level: 'critical',
            category: 'unsourced_claim',
            message: `仍有 ${unannotated.length} 条论断未完成一致性标注。`,
            suggestion: '请先在「差异标注」流程完成全部标注后再提交审核。',
            acknowledged: false,
          })
        }

        // 2. 标注为「差异」的条目
        const conflicts = mockStore.comparisonItems.filter(
          (item) => item.humanVerdict === 'conflict',
        )
        for (const item of conflicts) {
          risks.push({
            id: nextId(),
            level: 'critical',
            category: 'legend_as_fact',
            message: `论断「${item.claimText.slice(0, 24)}…」被标注为与资料存在差异。`,
            suggestion: item.humanReason || '请按标注意见修订后再提交。',
            relatedBlockId: item.claimBlockId,
            acknowledged: false,
          })
        }

        // 3. 来自生成流程的风险提示
        for (const note of mockStore.generation.riskNotes) {
          risks.push({
            id: nextId(),
            level: note.level,
            category:
              note.category === 'legend_as_fact'
                ? 'legend_as_fact'
                : note.category === 'low_credibility'
                  ? 'low_credibility_source'
                  : note.category === 'copyright'
                    ? 'license_scope'
                    : 'unsourced_claim',
            message: note.message,
            suggestion: note.suggestion,
            relatedBlockId: note.relatedBlockId,
            acknowledged: false,
          })
        }

        // 4. 授权范围检查
        const interview = mockStore.interviews[0]
        if (interview && interview.licenseType === 'research_only') {
          risks.push({
            id: nextId(),
            level: 'critical',
            category: 'license_scope',
            message: '本稿引用的采访录音授权类型为「仅研究使用」，不得公开发布。',
            suggestion: '请更换为已获公开授权的材料，或限制发布范围为内部可见。',
            acknowledged: false,
          })
        }

        const hasCritical = risks.some((risk) => risk.level === 'critical')
        const hasWarning = risks.some((risk) => risk.level === 'warning')
        const blockers = risks
          .filter((risk) => risk.level === 'critical')
          .map((risk) => risk.message)

        return {
          contentId,
          risks,
          overallLevel: hasCritical ? 'high' : hasWarning ? 'medium' : 'low',
          publishable: !hasCritical,
          blockers,
          aiMeta: {
            model: 'fuzhou-risk-auditor',
            modelVersion: '1.1.0',
            confidence: 0.87,
            needsHumanConfirm: risks.length > 0,
            generatedAt: nowIso(),
            tookMs: 2_600,
          },
        }
      },
      isEmpty: (data) => data.risks.length === 0,
    })
  },

  /**
   * 提交审核意见。
   * POST /contents/{contentId}/review-comments
   * @param body 审核意见请求体：内容 id、结论与意见正文
   * @returns 新增的审核意见
   */
  reviewComment(body: ReviewCommentRequest): Promise<ApiResponse<ReviewCommentResponse>> {
    return request<ReviewCommentRequest, ReviewCommentResponse>({
      label: '提交审核意见',
      method: 'POST',
      url: '/contents/{contentId}/review-comments',
      path: { contentId: body.contentId },
      body,
      mock: () => {
        const next: PublishStatus = body.decision === 'approved' ? 'approved' : 'rejected'
        mockStore.publishStatus = next

        const versionNo = mockStore.contentVersions.length + 1
        mockStore.contentVersions.push({
          versionId: mockId('VER'),
          versionNo,
          createdBy: body.reviewer,
          createdAt: nowIso(),
          note: body.comment || (body.decision === 'approved' ? '审核通过' : '审核驳回'),
          status: next,
          riskLevel: body.decision === 'approved' ? 'low' : 'medium',
        })

        return {
          contentId: body.contentId,
          status: next,
          reviewedAt: nowIso(),
          reviewer: body.reviewer,
          comment: body.comment,
          versionNo,
        }
      },
    })
  },

  /**
   * 发布前最终确认并发布。
   * POST /contents/{contentId}/publish
   * @param body 发布请求体：内容 id 与可见范围
   * @returns 发布后的内容信息（含发布地址与时间）
   */
  publish(body: FinalConfirmRequest): Promise<ApiResponse<PublishResponse>> {
    return request<FinalConfirmRequest, PublishResponse>({
      label: '确认发布',
      method: 'POST',
      url: '/contents/{contentId}/publish',
      path: { contentId: body.contentId },
      body,
      mock: () => {
        if (!body.confirmLicense || !body.confirmCitation || !body.confirmReviewed) {
          throw new Error('发布前需完成授权、引用、审核三项确认。')
        }

        const interview = mockStore.interviews[0]
        const visibility = interview?.licenseType === 'public' ? 'public' : 'internal'

        mockStore.publishStatus = 'published'
        const versionNo = mockStore.contentVersions.length + 1
        mockStore.contentVersions.push({
          versionId: mockId('VER'),
          versionNo,
          createdBy: body.operator,
          createdAt: nowIso(),
          note: body.note ?? '发布',
          status: 'published',
          riskLevel: 'low',
        })

        return {
          contentId: body.contentId,
          status: 'published' as const,
          publishedUrl: `/published/${body.contentId}`,
          publishedAt: nowIso(),
          versionNo,
          visibility,
          certificateNo: mockId('PUB'),
        }
      },
    })
  },

  /**
   * 版本记录列表。
   * GET /contents/{contentId}/versions
   * @param contentId 内容 id
   * @returns 内容的历史版本列表，按时间倒序
   */
  listVersions(contentId: string): Promise<ApiResponse<VersionListResponse>> {
    return request<unknown, VersionListResponse>({
      label: '获取版本记录',
      method: 'GET',
      url: '/contents/{contentId}/versions',
      path: { contentId },
      mock: () => ({
        contentId,
        versions: [...mockStore.contentVersions].reverse(),
        currentVersionId: mockStore.currentContentVersionId,
      }),
      isEmpty: (data) => data.versions.length === 0,
    })
  },

  /**
   * 回滚到历史版本。
   * POST /contents/{contentId}/rollback
   * @param body 回滚请求体：目标版本 id 与回滚理由
   * @returns 回滚后的版本信息
   */
  rollback(body: RollbackContentRequest): Promise<ApiResponse<RollbackContentResponse>> {
    return request<RollbackContentRequest, RollbackContentResponse>({
      label: '回滚版本',
      method: 'POST',
      url: '/contents/{contentId}/rollback',
      path: { contentId: body.contentId },
      body,
      mock: () => {
        const target = mockStore.contentVersions.find(
          (item) => item.versionId === body.targetVersionId,
        )
        if (!target) throw new Error('目标版本不存在。')

        const versionNo = mockStore.contentVersions.length + 1
        const versionId = mockId('VER')
        mockStore.contentVersions.push({
          versionId,
          versionNo,
          createdBy: body.operator,
          createdAt: nowIso(),
          note: body.note ?? `回滚至版本 ${target.versionNo}`,
          status: target.status,
          riskLevel: target.riskLevel,
        })
        mockStore.currentContentVersionId = versionId
        mockStore.publishStatus = target.status

        return {
          contentId: body.contentId,
          status: target.status,
          versionNo,
          rolledBackTo: target.versionId,
          updatedAt: nowIso(),
        }
      },
    })
  },

  /**
   * 供界面渲染的当前状态。
   * @returns 当前内容状态、可用动作与最近一次变更
   */
  currentStatus(): PublishStatus {
    return mockStore.publishStatus
  },

  /**
   * 供界面渲染的可执行动作。
   * @param status 内容当前状态
   * @returns 前端按钮的可用性映射（动作 → 是否可点）
   */
  actionsFor(status: PublishStatus): ReviewAction[] {
    return allowedActions(status)
  },
}

/** 状态中文名与配色，供多个流程复用。 */
export const PUBLISH_STATUS_META: Record<
  PublishStatus,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet' }
> = {
  draft: { label: '草稿', tone: 'neutral' },
  pending_review: { label: '待审', tone: 'warning' },
  approved: { label: '已通过', tone: 'info' },
  rejected: { label: '已驳回', tone: 'danger' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'violet' },
}

/** 审核动作中文名。 */
export const REVIEW_ACTION_LABEL: Record<ReviewAction, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '驳回',
  publish: '发布',
  archive: '归档',
  withdraw: '撤回',
}
