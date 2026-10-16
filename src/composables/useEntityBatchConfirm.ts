/**
 * 人工确认 / 驳回动作（单条与批量）。
 *
 * 唯一职责：按待确认实体集合或单条实体调用注入的批量确认任务，把返回的实体逐个
 * 合并回本地抽取结果，并按确认 / 驳回给出对应提示。
 */
import type { ComputedRef, Ref } from 'vue'

import type { NoticeLevel } from '@/composables/useAppShell'
import type { AsyncTaskState, TaskPhase } from '@/composables/useAsyncTask'
import type { ApiResponse } from '@/services/api/httpClient'
import type { BatchConfirmResponse, ExtractedEntity, GetExtractionResponse } from '@/types/api'

/** 批量确认 / 驳回的参数。 */
export interface BatchPayload {
  entityIds: string[]
  confirmStatus: 'confirmed' | 'rejected'
}

export interface UseEntityBatchConfirmDeps {
  pendingEntities: ComputedRef<ExtractedEntity[]>
  state: Readonly<Ref<AsyncTaskState<GetExtractionResponse>>>
  setData: (data: GetExtractionResponse, phase?: TaskPhase) => void
  notify: (level: NoticeLevel, text: string) => void
  /** 由视图注入的批量确认任务入口。 */
  runBatch: (payload: BatchPayload) => Promise<ApiResponse<BatchConfirmResponse> | null>
}

export interface UseEntityBatchConfirmApi {
  /** 采纳全部待确认实体。 */
  confirmAll: () => Promise<void>
  /** 驳回全部待确认实体。 */
  rejectAll: () => Promise<void>
  /** 采纳单条实体。 */
  acceptOne: (entity: ExtractedEntity) => Promise<void>
  /** 驳回单条实体。 */
  rejectOne: (entity: ExtractedEntity) => Promise<void>
}

/**
 * 创建人工确认动作。
 * @param deps 待确认实体集合、主任务状态机与批量确认任务入口
 * @returns 批量确认 / 批量驳回 / 单条采纳 / 单条驳回四个动作
 */
export function useEntityBatchConfirm(deps: UseEntityBatchConfirmDeps): UseEntityBatchConfirmApi {
  function applyBatch(result: BatchConfirmResponse): void {
    const data = deps.state.value.data
    if (!data) return
    const updated = new Map<string, ExtractedEntity>()
    for (const item of result.entities) updated.set(item.id, item)
    deps.setData({
      ...data,
      entities: data.entities.map((item) => updated.get(item.id) ?? item),
      pendingConfirmCount: result.pendingConfirmCount,
    })
  }

  async function confirmAll(): Promise<void> {
    const ids = deps.pendingEntities.value.map((item) => item.id)
    if (ids.length === 0) {
      deps.notify('info', '当前没有待人工确认的实体。')
      return
    }
    const response = await deps.runBatch({ entityIds: ids, confirmStatus: 'confirmed' })
    if (!response) return
    applyBatch(response.data)
    deps.notify(
      'success',
      '已确认 ' +
        String(response.data.confirmedCount) +
        ' 条实体，剩余待确认 ' +
        String(response.data.pendingConfirmCount) +
        ' 条。',
    )
  }

  async function rejectAll(): Promise<void> {
    const ids = deps.pendingEntities.value.map((item) => item.id)
    if (ids.length === 0) {
      deps.notify('info', '当前没有待人工确认的实体。')
      return
    }
    const response = await deps.runBatch({ entityIds: ids, confirmStatus: 'rejected' })
    if (!response) return
    applyBatch(response.data)
    deps.notify(
      'warning',
      '已驳回 ' + String(response.data.entities.length) + ' 条实体，它们不会进入检索流程。',
    )
  }

  async function acceptOne(entity: ExtractedEntity): Promise<void> {
    const response = await deps.runBatch({ entityIds: [entity.id], confirmStatus: 'confirmed' })
    if (!response) return
    applyBatch(response.data)
    deps.notify('success', '已采纳 AI 建议并确认「' + entity.name + '」。')
  }

  async function rejectOne(entity: ExtractedEntity): Promise<void> {
    const response = await deps.runBatch({ entityIds: [entity.id], confirmStatus: 'rejected' })
    if (!response) return
    applyBatch(response.data)
    deps.notify('warning', '已驳回「' + entity.name + '」，它不会进入检索流程。')
  }

  return { confirmAll, rejectAll, acceptOne, rejectOne }
}
