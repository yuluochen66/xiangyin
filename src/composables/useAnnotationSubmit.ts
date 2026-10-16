/**
 * 流程 5 的标注提交。
 *
 * 唯一职责：跑通增量保存与提交整批两条提交路径——提交前的必填校验、
 * 提交整批的二次确认、请求发起，以及失败后保留草稿、成功后推进基线
 * 并就地标出服务端校验失败的条目。
 */
import { ref } from 'vue'
import type { Ref } from 'vue'

import { compareApi } from '@/api'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { UseAsyncTaskApi } from '@/composables/useAsyncTask'
import type { ComparisonDraftsApi } from '@/composables/useComparisonDrafts'
import type { ComparisonNotify } from '@/composables/useComparisonDraftRules'
import type { ComparisonStatsApi } from '@/composables/useComparisonStats'
import type { OperatorInfo, SubmitAnnotationsResponse } from '@/types/api'
import { formatDateTime } from '@/utils/format'

/** useAnnotationSubmit 的入参。 */
export interface UseAnnotationSubmitOptions {
  /** 比对任务 id。 */
  comparisonId: string
  /** 标注人。 */
  annotator: OperatorInfo
  /** 逐条标注草稿的操作面，用于取提交体与落库。 */
  drafts: ComparisonDraftsApi
  /** 标注统计视图，用于取待提交内容与提交前计数。 */
  stats: ComparisonStatsApi
  /** 全局提示。 */
  notify: ComparisonNotify
}

/** 标注提交的操作面。 */
export interface AnnotationSubmitApi {
  /** 本次提交是否为整批提交（submitAll=true）。 */
  submitAllMode: Ref<boolean>
  /** 提交整批的二次确认弹窗是否打开。 */
  submitAllModalOpen: Ref<boolean>
  submitState: UseAsyncTaskApi<SubmitAnnotationsResponse, []>['state']
  submitBusy: UseAsyncTaskApi<SubmitAnnotationsResponse, []>['isBusy']
  saveAnnotations(): void
  openSubmitAll(): void
  confirmSubmitAll(): void
}

/**
 * 标注提交的组合式函数。
 * @param options 入参：比对任务 id、标注人、草稿操作面、统计视图与全局提示
 * @returns 提交模式与确认弹窗状态、请求状态，以及保存 / 提交整批 / 确认提交三个入口
 */
export function useAnnotationSubmit(options: UseAnnotationSubmitOptions): AnnotationSubmitApi {
  const { drafts, stats, notify } = options

  const submitAllMode = ref(false)
  const submitAllModalOpen = ref(false)

  const {
    state: submitState,
    isBusy: submitBusy,
    run: runSubmit,
  } = useAsyncTask<SubmitAnnotationsResponse, []>(() =>
    compareApi.submitAnnotations({
      comparisonId: options.comparisonId,
      annotations: submitAllMode.value ? stats.allInputs.value : stats.changedInputs.value,
      annotator: options.annotator,
      submitAll: submitAllMode.value,
    }),
  )

  /** 发起提交：请求体在 runSubmit 内部同步构造，这里先记下本次要提交的条目，供成功后推进基线。 */
  async function doSubmit(): Promise<void> {
    const attempted = submitAllMode.value ? stats.allInputs.value : stats.changedInputs.value
    const response = await runSubmit()

    if (!response) {
      // 保存失败：草稿原样保留，用户输入不丢
      notify(
        'error',
        '标注保存失败',
        submitState.value.error?.displayMessage ?? '请稍后重试；已填写的内容仍保留在界面上。',
      )
      return
    }

    // 仅把「实际写入成功」的条目推进到已保存基线，并就地记下校验失败的条目
    drafts.applySubmitResult(attempted, response.data)

    if (response.data.invalid.length > 0) {
      notify(
        'error',
        `${response.data.invalid.length} 条标注未通过校验`,
        '已在对应条目上就地标出原因，修改后可再次保存；其余条目已写入。',
      )
      return
    }

    notify(
      submitAllMode.value ? 'success' : 'info',
      submitAllMode.value
        ? `已提交全部 ${response.data.savedCount} 条标注`
        : `已保存 ${response.data.savedCount} 条标注`,
      `服务端时间 ${formatDateTime(response.data.savedAt)}`,
    )
    submitAllModalOpen.value = false
  }

  /** 增量保存：先校验必填原因与待保存改动，再提交本次变更的条目。 */
  function saveAnnotations(): void {
    if (stats.reasonIssueCount.value > 0) {
      notify(
        'error',
        '还有判定缺少差异原因',
        '判定为「差异 / 待核实」的条目必须填写原因后才能保存。',
      )
      return
    }
    if (stats.changedInputs.value.length === 0) {
      notify('warning', '没有需要保存的改动。', '先修改至少一条结论或原因，再点保存。')
      return
    }
    submitAllMode.value = false
    void doSubmit()
  }

  /** 提交全部：先校验必填原因与已标注条数，有未标注条目时先弹二次确认。 */
  function openSubmitAll(): void {
    if (stats.reasonIssueCount.value > 0) {
      notify('error', '还有判定缺少差异原因', '请先补齐「差异 / 待核实」条目的原因再提交整批。')
      return
    }
    if (stats.allInputs.value.length === 0) {
      notify('warning', '还没有任何已标注条目。', '至少标注一条后再提交整批。')
      return
    }
    if (stats.missingCount.value > 0) {
      submitAllModalOpen.value = true
      return
    }
    confirmSubmitAll()
  }

  /** 二次确认通过后，按 submitAll=true 提交整批。 */
  function confirmSubmitAll(): void {
    submitAllModalOpen.value = false
    submitAllMode.value = true
    void doSubmit()
  }

  return {
    submitAllMode,
    submitAllModalOpen,
    submitState,
    submitBusy,
    saveAnnotations,
    openSubmitAll,
    confirmSubmitAll,
  }
}
