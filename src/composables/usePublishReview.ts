/**
 * 流程 7「审核发布」的审核意见提交。
 *
 * 唯一职责：持有审核意见文本，把风险项确认结果一并组装成请求体并提交
 * POST /contents/{contentId}/review-comments，成功后同步状态机并刷新版本记录。
 * 不负责风险检查本身、状态流转、发布与版本记录。
 */
import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { publishApi } from '@/api'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { REVIEWER_OPERATOR } from '@/mock/dataset'
import type {
  PublishStatus,
  ReviewCommentRequest,
  ReviewCommentResponse,
  ReviewRisk,
} from '@/types/api'

/** 审核意见能力的对外接口。 */
export interface UsePublishReviewApi {
  /** 审核意见文本，驳回时必填。 */
  reviewCommentText: Ref<string>
  /** 审核意见任务的 7 态状态快照。 */
  commentState: Readonly<Ref<AsyncTaskState<ReviewCommentResponse>>>
  /** 审核意见是否提交中。 */
  commentBusy: ComputedRef<boolean>
  /** 提交审核结论。 */
  submitReviewDecision: (decision: 'approved' | 'rejected') => Promise<void>
}

/**
 * 组装审核意见能力。
 * @param options contentId 为被审核内容 id；risks 提供逐条风险确认结果；
 *   applyStatus 在提交成功后同步状态机；refreshVersions 在提交成功后刷新版本记录
 * @returns 审核意见文本、提交任务状态与提交动作
 */
export function usePublishReview(options: {
  contentId: string
  risks: Ref<ReviewRisk[]>
  applyStatus: (status: PublishStatus) => void
  refreshVersions: () => void
}): UsePublishReviewApi {
  const { notify } = useAppShell()

  const reviewCommentText = ref('')

  function buildReviewCommentBody(decision: 'approved' | 'rejected'): ReviewCommentRequest {
    return {
      contentId: options.contentId,
      decision,
      comment: reviewCommentText.value.trim(),
      riskDecisions: options.risks.value.map((risk) => ({
        riskId: risk.id,
        acknowledged: risk.acknowledged,
      })),
      reviewer: { ...REVIEWER_OPERATOR },
    }
  }

  const {
    state: commentState,
    isBusy: commentBusy,
    run: runReviewComment,
  } = useAsyncTask<ReviewCommentResponse, ['approved' | 'rejected']>(
    (decision: 'approved' | 'rejected') =>
      publishApi.reviewComment(buildReviewCommentBody(decision)),
  )

  async function submitReviewDecision(decision: 'approved' | 'rejected'): Promise<void> {
    if (decision === 'rejected' && reviewCommentText.value.trim().length === 0) {
      notify('warning', '驳回必须填写审核意见', '请写明驳回原因，便于作者修订后重新提交。')
      return
    }
    const response = await runReviewComment(decision)
    if (response) {
      options.applyStatus(response.data.status)
      notify(
        decision === 'approved' ? 'success' : 'warning',
        decision === 'approved' ? '审核通过' : '已驳回',
        response.data.comment || '（未填写意见）',
      )
      options.refreshVersions()
    } else if (commentState.value.error) {
      notify('error', '提交审核意见失败', commentState.value.error.displayMessage)
    }
  }

  return {
    reviewCommentText,
    commentState,
    commentBusy,
    submitReviewDecision,
  }
}
