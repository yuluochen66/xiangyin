/**
 * 流程 7「审核发布」的状态流转。
 *
 * 唯一职责：持有审核状态机的当前状态与可执行动作、流转检查清单、流转备注、
 * 「用过期状态提交」调试开关与乐观锁冲突标记，构造并提交
 * POST /contents/{contentId}/transitions，冲突时给出可恢复的失败态。
 * 不负责风险检查、审核意见、发布与版本记录。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { PUBLISH_STATUS_META, publishApi } from '@/api'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type {
  ChecklistItem,
  PublishStatus,
  ReviewAction,
  TransitionRequest,
  TransitionResponse,
} from '@/types/api'

/** 主状态链，用于步骤条。 */
export const STATUS_FLOW: PublishStatus[] = ['draft', 'pending_review', 'approved', 'published']

/** 状态流转能力的对外接口。 */
export interface UsePublishStatusFlowApi {
  /** 当前状态。 */
  currentStatus: Ref<PublishStatus>
  /** 当前状态下允许执行的流转动作。 */
  allowedActions: Ref<ReviewAction[]>
  /** 最近一次提交的动作，用于按钮 loading 定位。 */
  lastAction: Ref<ReviewAction | null>
  /** 是否用过期状态提交（演示乐观锁冲突；待确认：仅原型调试用）。 */
  forceStaleStatus: Ref<boolean>
  /** 是否命中乐观锁冲突。 */
  conflictDetected: Ref<boolean>
  /** 流转备注，随流转一起提交。 */
  actionComment: Ref<string>
  /** 最近一次请求体，供调试预览。 */
  lastRequestBody: Ref<unknown>
  /** 流转检查清单，勾选状态就地写回。 */
  checklist: Ref<ChecklistItem[]>
  /** 流转任务的 7 态状态快照。 */
  transitionState: Readonly<Ref<AsyncTaskState<TransitionResponse>>>
  /** 流转是否进行中。 */
  transitionBusy: ComputedRef<boolean>
  /** 流转失败是否可重试。 */
  transitionCanRetry: ComputedRef<boolean>
  /** 当前状态在主状态链中的下标。 */
  stepIndex: ComputedRef<number>
  /** 是否处于 rejected / archived 分支状态。 */
  isBranchStatus: ComputedRef<boolean>
  /** 用接口当前状态覆盖本地状态机。 */
  applyStatus: (status: PublishStatus) => void
  /** 提交一次流转。 */
  doTransition: (action: ReviewAction) => Promise<void>
  /** 重试最近一次流转动作。 */
  retryLastAction: () => Promise<void>
  /** 拉取接口当前状态并清理冲突与人工核对标记。 */
  refreshStatus: () => void
}

/**
 * 组装状态流转能力。
 * @param options contentId 为被流转内容 id；manualCheckAck 供刷新时复位；
 *   refreshVersions 在流转成功后刷新版本记录；requestPublish 在 publish 动作时打开最终确认
 * @returns 状态机数据、流转任务状态与操作
 */
export function usePublishStatusFlow(options: {
  contentId: string
  manualCheckAck: Ref<boolean>
  refreshVersions: () => void
  requestPublish: () => void
}): UsePublishStatusFlowApi {
  const { notify } = useAppShell()

  const currentStatus = ref<PublishStatus>(publishApi.currentStatus())
  const allowedActions = ref<ReviewAction[]>(publishApi.actionsFor(currentStatus.value))
  /** 进入本页时的状态快照，用于演示乐观锁冲突（待确认：仅原型调试用）。 */
  const staleStatus = ref<PublishStatus>(publishApi.currentStatus())
  const forceStaleStatus = ref(false)
  const lastAction = ref<ReviewAction | null>(null)
  const conflictDetected = ref(false)
  const actionComment = ref('')
  const lastRequestBody = ref<unknown>(null)

  const checklist = ref<ChecklistItem[]>([
    { key: 'license', label: '授权范围已核对', checked: false, required: true },
    { key: 'citation', label: '引用标注已核对', checked: false, required: true },
    { key: 'proofread', label: '文字校对已完成', checked: false, required: false },
  ])

  const {
    state: transitionState,
    isBusy: transitionBusy,
    canRetry: transitionCanRetry,
    run: runTransition,
  } = useAsyncTask<TransitionResponse, [ReviewAction]>((action: ReviewAction) =>
    publishApi.transition(buildTransitionBody(action)),
  )

  const stepIndex = computed(() => STATUS_FLOW.indexOf(currentStatus.value))
  const isBranchStatus = computed(
    () => currentStatus.value === 'rejected' || currentStatus.value === 'archived',
  )

  function staleExpectedFrom(): PublishStatus {
    if (staleStatus.value !== currentStatus.value) return staleStatus.value
    return currentStatus.value === 'draft' ? 'pending_review' : 'draft'
  }

  function buildTransitionBody(action: ReviewAction): TransitionRequest {
    const body: TransitionRequest = {
      contentId: options.contentId,
      action,
      expectedFrom: forceStaleStatus.value ? staleExpectedFrom() : currentStatus.value,
      operator: { ...CURRENT_OPERATOR },
      checklist: checklist.value.map((item) => ({ ...item })),
    }
    const comment = actionComment.value.trim()
    if (comment) body.comment = comment
    return body
  }

  function applyStatus(status: PublishStatus): void {
    currentStatus.value = status
    allowedActions.value = publishApi.actionsFor(status)
  }

  async function doTransition(action: ReviewAction): Promise<void> {
    if (action === 'publish') {
      options.requestPublish()
      return
    }
    if (action === 'reject' && actionComment.value.trim().length === 0) {
      notify('warning', '驳回必须填写审核意见', '请在下方审核意见中说明驳回原因与需修改的点。')
      return
    }

    lastAction.value = action
    conflictDetected.value = false
    lastRequestBody.value = buildTransitionBody(action)
    const response = await runTransition(action)

    if (response) {
      applyStatus(response.data.status)
      notify(
        'success',
        '状态已流转',
        PUBLISH_STATUS_META[response.data.status].label +
          ' · 版本 v' +
          String(response.data.versionNo) +
          (response.data.publishedUrl ? ' · ' + response.data.publishedUrl : ''),
      )
      actionComment.value = ''
      options.refreshVersions()
      return
    }

    if (transitionState.value.error) {
      const message = transitionState.value.error.message
      if (message.indexOf('状态已变更') >= 0) {
        conflictDetected.value = true
        notify('error', '状态已变更，请刷新', message)
      } else {
        notify('error', '状态流转失败', transitionState.value.error.displayMessage)
      }
    }
  }

  async function retryLastAction(): Promise<void> {
    if (lastAction.value) await doTransition(lastAction.value)
  }

  function refreshStatus(): void {
    applyStatus(publishApi.currentStatus())
    staleStatus.value = publishApi.currentStatus()
    forceStaleStatus.value = false
    conflictDetected.value = false
    options.manualCheckAck.value = false
    notify('info', '已刷新状态', '当前状态：' + PUBLISH_STATUS_META[currentStatus.value].label)
  }

  return {
    currentStatus,
    allowedActions,
    lastAction,
    forceStaleStatus,
    conflictDetected,
    actionComment,
    lastRequestBody,
    checklist,
    transitionState,
    transitionBusy,
    transitionCanRetry,
    stepIndex,
    isBranchStatus,
    applyStatus,
    doTransition,
    retryLastAction,
    refreshStatus,
  }
}
