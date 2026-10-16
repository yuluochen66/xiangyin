/**
 * 流程 7「审核发布」的共享上下文。
 *
 * 唯一职责：按依赖顺序装配状态流转、风险检查、审核意见、发布、版本记录五块能力，
 * 汇总跨模块的流程状态（7 态 phase）与跨流程跳转动作，并通过 provide/inject
 * 把同一份实例提供给流程 7 的各个子组件。
 * 本身不实现具体业务规则。
 */
import { computed, inject, provide } from 'vue'
import type { InjectionKey } from 'vue'

import { usePublishRelease } from '@/composables/usePublishRelease'
import { usePublishReview } from '@/composables/usePublishReview'
import { usePublishRiskCheck } from '@/composables/usePublishRiskCheck'
import { usePublishStatusFlow } from '@/composables/usePublishStatusFlow'
import { usePublishVersions } from '@/composables/usePublishVersions'
import type { TaskPhase } from '@/composables/useAsyncTask'
import { useRouter } from '@/router'

const CONTENT_ID = 'CONTENT-0007'

/**
 * 把 ISO 时间戳格式化为「年-月-日 时:分」。
 * @param iso ISO 8601 时间字符串
 * @returns 去掉秒与毫秒后的可读时间
 */
export function formatTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16)
}

function createPublishFlow() {
  const risk = usePublishRiskCheck({ contentId: CONTENT_ID })

  const statusFlow = usePublishStatusFlow({
    contentId: CONTENT_ID,
    manualCheckAck: risk.manualCheckAck,
    refreshVersions: () => versions.refreshVersions(),
    requestPublish: () => release.openPublishConfirm(),
  })

  const review = usePublishReview({
    contentId: CONTENT_ID,
    risks: risk.risks,
    applyStatus: statusFlow.applyStatus,
    refreshVersions: () => versions.refreshVersions(),
  })

  const release = usePublishRelease({
    contentId: CONTENT_ID,
    currentStatus: statusFlow.currentStatus,
    riskState: risk.riskState,
    risks: risk.risks,
    publishable: risk.publishable,
    blockers: risk.blockers,
    riskUnavailableManual: risk.riskUnavailableManual,
    manualCheckAck: risk.manualCheckAck,
    actionComment: statusFlow.actionComment,
    lastRequestBody: statusFlow.lastRequestBody,
    applyStatus: statusFlow.applyStatus,
    refreshVersions: () => versions.refreshVersions(),
  })

  const versions = usePublishVersions({
    contentId: CONTENT_ID,
    applyStatus: statusFlow.applyStatus,
  })

  /**
   * 汇总六个异步任务的状态，供页面头部展示流程整体 phase。
   * 已在进行的任务优先，其次保留风险检查的失败 / 不可用 / 待确认 / 空态。
   */
  const flowPhase = computed<TaskPhase>(() => {
    if (statusFlow.transitionBusy.value) return statusFlow.transitionState.value.phase
    if (risk.riskBusy.value) return risk.riskState.value.phase
    if (review.commentBusy.value) return review.commentState.value.phase
    if (release.publishBusy.value) return release.publishState.value.phase
    if (versions.versionBusy.value) return versions.versionState.value.phase
    if (versions.rollbackBusy.value) return versions.rollbackState.value.phase
    if (
      risk.riskState.value.phase === 'error' ||
      risk.riskState.value.phase === 'unavailable' ||
      risk.riskState.value.phase === 'confirm' ||
      risk.riskState.value.phase === 'empty'
    ) {
      return risk.riskState.value.phase
    }
    return 'success'
  })

  const { goToStep } = useRouter()

  function goToFlow(step: number): void {
    goToStep(step)
  }

  return {
    ...statusFlow,
    ...risk,
    ...review,
    ...release,
    ...versions,
    flowPhase,
    goToFlow,
    formatTime,
  }
}

/** 流程 7 的共享上下文类型。 */
export type PublishFlowContext = ReturnType<typeof createPublishFlow>

const PUBLISH_FLOW_KEY: InjectionKey<PublishFlowContext> = Symbol('publish-flow')

/**
 * 创建并下发流程 7 的共享上下文，在流程 7 主视图的 setup 中调用一次。
 * @returns 流程 7 的完整上下文
 */
export function providePublishFlow(): PublishFlowContext {
  const flow = createPublishFlow()
  provide(PUBLISH_FLOW_KEY, flow)
  return flow
}

/**
 * 读取当前流程 7 的共享上下文，在流程 7 子组件的 setup 中调用。
 * @returns 流程 7 的完整上下文
 */
export function usePublishFlowContext(): PublishFlowContext {
  const flow = inject(PUBLISH_FLOW_KEY)
  if (!flow)
    throw new Error('usePublishFlowContext 必须在流程 7 的 providePublishFlow 作用域内使用。')
  return flow
}
