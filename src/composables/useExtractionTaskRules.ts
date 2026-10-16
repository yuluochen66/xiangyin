/**
 * 流程 3 各任务的状态判定规则。
 *
 * 唯一职责：集中「什么算空数据、什么情况需要人工确认、确认后如何反馈、失败时展示什么
 * 文案」这四条判定规则，供视图创建 useAsyncTask 与渲染弹窗时使用；不发起任何接口调用。
 */
import type { NoticeLevel } from '@/composables/useAppShell'
import type { AsyncTaskState, UseAsyncTaskOptions } from '@/composables/useAsyncTask'
import { KIND_LABEL } from '@/composables/useEntityFilters'
import type { GetExtractionResponse } from '@/types/api'
import { formatPercent } from '@/utils/format'

/**
 * 创建主任务的判定规则。
 * @param notify 全局提示入口，用于回应人工确认后的反馈
 * @returns 空数据判定、空数据说明、需确认判定与确认后回调
 */
export function useExtractionTaskOptions(
  notify: (level: NoticeLevel, text: string) => void,
): UseAsyncTaskOptions<GetExtractionResponse> {
  return {
    isEmpty: (data) => data.entities.length === 0,
    emptyHint: {
      reason:
        '本次抽取没有返回任何实体，可能是可用文本过短，或 NER 任务部分失败（status = partial）。',
      suggestion: '重新拉取结果、放宽置信度阈值，或直接手工新增实体后继续。',
    },
    needsConfirm: (data) => {
      if (data.pendingConfirmCount <= 0) return null
      return {
        title: '有抽取结果需要人工确认',
        message:
          '共 ' +
          String(data.pendingConfirmCount) +
          ' 条实体置信度偏低，确认后才展示「进入检索」动作；未确认的实体不会进入检索流程。',
        details: data.entities
          .filter((item) => item.confirmStatus === 'pending')
          .slice(0, 5)
          .map(
            (item) =>
              KIND_LABEL[item.kind] +
              '「' +
              item.name +
              '」置信度 ' +
              formatPercent(item.confidence) +
              (item.uncertaintyNote ? '：' + item.uncertaintyNote : ''),
          ),
        confirmText: '已了解，开始人工核对',
        cancelText: '暂不处理',
      }
    },
    onConfirm: (_data, decision) => {
      if (decision === 'confirmed') {
        notify('info', '已进入人工核对环节：请逐条确认或驳回，未确认项不可进入检索。')
      } else {
        notify('warning', '已放弃本次抽取结果，可重新发起抽取或手工录入实体。')
      }
    },
  }
}

/**
 * 取任务在「失败」态下的可展示错误文案。
 * @param taskState 任意任务的状态快照
 * @returns 失败态返回错误文案，其余状态（含 unavailable）返回 null
 */
export function taskErrorText(taskState: AsyncTaskState<unknown>): string | null {
  return taskState.phase === 'error' ? (taskState.error?.displayMessage ?? null) : null
}
