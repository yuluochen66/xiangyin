/**
 * 流程 7「审核发布」的最终发布。
 *
 * 唯一职责：汇总发布前置条件（状态、风险检查结果、严重风险确认、人工核对兜底）算出
 * 阻断原因，维护发布前最终确认弹窗的三项勾选与发布结果，并提交
 * POST /contents/{contentId}/publish。
 * 不负责状态流转、风险检查本身、审核意见与版本回滚。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { PUBLISH_STATUS_META, publishApi } from '@/api'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type {
  FinalConfirmRequest,
  PublishResponse,
  PublishStatus,
  ReviewRisk,
  RiskCheckResponse,
} from '@/types/api'

/** 发布能力的对外接口。 */
export interface UsePublishReleaseApi {
  /** 最终确认弹窗是否打开。 */
  publishConfirmOpen: Ref<boolean>
  /** 授权范围确认。 */
  confirmLicense: Ref<boolean>
  /** 引用标注确认。 */
  confirmCitation: Ref<boolean>
  /** 审核完成确认。 */
  confirmReviewed: Ref<boolean>
  /** 发布成功后的回执。 */
  publishedResult: Ref<PublishResponse | null>
  /** 当前不能发布的原因，空数组表示可发布。 */
  publishBlockReasons: ComputedRef<string[]>
  /** 是否满足全部发布前置条件。 */
  canPublish: ComputedRef<boolean>
  /** 三项确认是否尚未全部勾选。 */
  confirmDisabled: ComputedRef<boolean>
  /** 发布任务的 7 态状态快照。 */
  publishState: Readonly<Ref<AsyncTaskState<PublishResponse>>>
  /** 发布是否进行中。 */
  publishBusy: ComputedRef<boolean>
  /** 打开最终确认弹窗（前置条件不满足时提示并拒绝）。 */
  openPublishConfirm: () => void
  /** 确认后执行发布。 */
  doPublish: () => Promise<void>
}

/**
 * 组装发布能力。
 * @param options contentId 为被发布内容 id；currentStatus 与风险检查相关状态用于前置校验；
 *   actionComment 作为发布备注来源；lastRequestBody 记录最近一次请求体供调试预览；
 *   applyStatus 在发布成功后同步状态机；refreshVersions 在发布成功后刷新版本记录
 * @returns 发布前置校验结果、最终确认状态与发布动作
 */
export function usePublishRelease(options: {
  contentId: string
  currentStatus: Ref<PublishStatus>
  riskState: Readonly<Ref<AsyncTaskState<RiskCheckResponse>>>
  risks: Ref<ReviewRisk[]>
  publishable: Ref<boolean | null>
  blockers: Ref<string[]>
  riskUnavailableManual: Ref<boolean>
  manualCheckAck: Ref<boolean>
  actionComment: Ref<string>
  lastRequestBody: Ref<unknown>
  applyStatus: (status: PublishStatus) => void
  refreshVersions: () => void
}): UsePublishReleaseApi {
  const { notify } = useAppShell()

  const publishConfirmOpen = ref(false)
  const confirmLicense = ref(false)
  const confirmCitation = ref(false)
  const confirmReviewed = ref(false)
  const publishedResult = ref<PublishResponse | null>(null)

  const publishBlockReasons = computed<string[]>(() => {
    const reasons: string[] = []
    if (options.currentStatus.value !== 'approved') {
      reasons.push(
        '当前状态为「' +
          PUBLISH_STATUS_META[options.currentStatus.value].label +
          '」，仅「已通过」状态可发布。',
      )
    }
    if (options.riskState.value.phase !== 'success' && !options.riskUnavailableManual.value) {
      reasons.push('尚未完成 AI 风险检查（或检查结果已被放弃）。')
    }
    if (options.riskUnavailableManual.value && !options.manualCheckAck.value) {
      reasons.push('人工逐条核对尚未勾选确认。')
    }
    if (options.riskState.value.phase === 'success' && options.publishable.value === false) {
      if (options.blockers.value.length > 0) {
        for (const blocker of options.blockers.value) reasons.push('阻断项：' + blocker)
      } else {
        reasons.push('AI 判定当前稿件不可直接发布。')
      }
    }
    const pending = options.risks.value.filter(
      (risk) => risk.level === 'critical' && !risk.acknowledged,
    )
    if (options.riskState.value.phase === 'success' && pending.length > 0) {
      reasons.push('仍有 ' + String(pending.length) + ' 条严重风险未确认知晓。')
    }
    return reasons
  })

  const canPublish = computed(() => publishBlockReasons.value.length === 0)
  const confirmDisabled = computed(
    () => !confirmLicense.value || !confirmCitation.value || !confirmReviewed.value,
  )

  function buildPublishBody(): FinalConfirmRequest {
    const body: FinalConfirmRequest = {
      contentId: options.contentId,
      operator: { ...CURRENT_OPERATOR },
      confirmLicense: confirmLicense.value,
      confirmCitation: confirmCitation.value,
      confirmReviewed: confirmReviewed.value,
    }
    const note = options.actionComment.value.trim()
    if (note) body.note = note
    return body
  }

  function openPublishConfirm(): void {
    if (!canPublish.value) {
      notify('warning', '暂不能发布', publishBlockReasons.value[0] ?? '请先满足发布前置条件。')
      return
    }
    confirmLicense.value = false
    confirmCitation.value = false
    confirmReviewed.value = false
    publishConfirmOpen.value = true
  }

  const {
    state: publishState,
    isBusy: publishBusy,
    run: runPublish,
  } = useAsyncTask<PublishResponse, []>(() => publishApi.publish(buildPublishBody()))

  async function doPublish(): Promise<void> {
    options.lastRequestBody.value = buildPublishBody()
    const response = await runPublish()
    if (response) {
      publishedResult.value = response.data
      options.applyStatus(response.data.status)
      publishConfirmOpen.value = false
      notify(
        'success',
        '发布成功',
        response.data.publishedUrl +
          ' · ' +
          (response.data.visibility === 'public' ? '公开可见' : '仅内部可见'),
      )
      options.refreshVersions()
    } else if (publishState.value.error) {
      notify('error', '发布失败', publishState.value.error.displayMessage)
    }
  }

  return {
    publishConfirmOpen,
    confirmLicense,
    confirmCitation,
    confirmReviewed,
    publishedResult,
    publishBlockReasons,
    canPublish,
    confirmDisabled,
    publishState,
    publishBusy,
    openPublishConfirm,
    doPublish,
  }
}
