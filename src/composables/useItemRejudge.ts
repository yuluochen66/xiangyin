/**
 * 流程 5 的单条 AI 重判。
 *
 * 唯一职责：维护「当前要重判哪一条」与人工补充的上下文，发起重判请求，
 * 并把成功 / 失败结果、以及「人工结论仍与新初判不一致」的提醒交给全局提示。
 */
import { ref } from 'vue'
import type { Ref } from 'vue'

import { compareApi } from '@/api'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { UseAsyncTaskApi } from '@/composables/useAsyncTask'
import type { ComparisonNotify } from '@/composables/useComparisonDraftRules'
import type { ComparisonItem, RejudgeItemResponse } from '@/types/api'

/** useItemRejudge 的入参。 */
export interface UseItemRejudgeOptions {
  /** 比对任务 id。 */
  comparisonId: string
  /** 全局提示。 */
  notify: ComparisonNotify
  /** 判断某条的人工结论是否与 AI 初判不一致。 */
  disagreesWithAi(item: ComparisonItem): boolean
}

/** 单条 AI 重判的操作面。 */
export interface ItemRejudgeApi {
  /** 正在重判的比对项 id；未选中时为 null。 */
  rejudgeItemId: Ref<string | null>
  /** 人工补充的重判上下文。 */
  rejudgeHints: Ref<string>
  rejudgeState: UseAsyncTaskApi<RejudgeItemResponse, []>['state']
  rejudgeBusy: UseAsyncTaskApi<RejudgeItemResponse, []>['isBusy']
  toggleRejudge(itemId: string): void
  requestRejudge(): Promise<void>
}

/**
 * 单条 AI 重判的组合式函数。
 * @param options 入参：比对任务 id、全局提示与不一致判定函数
 * @returns 重判选中的条目、补充上下文、请求状态与两个操作函数
 */
export function useItemRejudge(options: UseItemRejudgeOptions): ItemRejudgeApi {
  const { notify } = options
  const rejudgeItemId = ref<string | null>(null)
  const rejudgeHints = ref('')

  const {
    state: rejudgeState,
    isBusy: rejudgeBusy,
    run: runRejudge,
    reset: resetRejudge,
  } = useAsyncTask<RejudgeItemResponse, []>(() =>
    compareApi.rejudgeItem({
      comparisonId: options.comparisonId,
      itemId: rejudgeItemId.value ?? '',
      ...(rejudgeHints.value.trim().length > 0 ? { hints: rejudgeHints.value.trim() } : {}),
    }),
  )

  // 展开 / 收起某条的重判面板；切换条目时清空补充上下文与上次结果。
  function toggleRejudge(itemId: string): void {
    if (rejudgeItemId.value === itemId) {
      rejudgeItemId.value = null
      resetRejudge()
      return
    }
    rejudgeItemId.value = itemId
    rejudgeHints.value = ''
    resetRejudge()
  }

  /** 提交当前选中条目的重判请求，并就地把结果反馈到全局提示。 */
  async function requestRejudge(): Promise<void> {
    if (rejudgeItemId.value === null) {
      notify('warning', '请先选择要重判的比对项。')
      return
    }
    const response = await runRejudge()
    if (!response) {
      notify(
        'error',
        'AI 重判失败',
        rejudgeState.value.error?.displayMessage ?? '请稍后重试，人工输入不受影响。',
      )
      return
    }
    notify(
      'success',
      'AI 已完成重判',
      `${response.data.aiMeta.model} · 耗时 ${response.data.aiMeta.tookMs} ms · 新置信度 ${response.data.item.aiConfidence.toFixed(2)}`,
    )
    if (options.disagreesWithAi(response.data.item)) {
      notify('info', '人工结论与新的 AI 初判仍不一致', '请确认是否需要调整人工判定或补充差异原因。')
    }
  }

  return { rejudgeItemId, rejudgeHints, rejudgeState, rejudgeBusy, toggleRejudge, requestRejudge }
}
