/**
 * 删除实体的动作。
 *
 * 唯一职责：用当前删除目标调用注入的 delete 任务，成功后从本地结果中移除该实体，
 * 同步待确认数与同义项分组，并在必要时清空原文依据的选中态。
 */
import type { Ref } from 'vue'

import type { NoticeLevel } from '@/composables/useAppShell'
import type { AsyncTaskState, TaskPhase } from '@/composables/useAsyncTask'
import type { ActiveEvidence } from '@/composables/useEvidenceTrace'
import type { ApiResponse } from '@/services/api/httpClient'
import type { ExtractedEntity, GetExtractionResponse } from '@/types/api'

/** 删除接口返回的数据。 */
export interface DeleteEntityResult {
  deletedId: string
  pendingConfirmCount: number
}

export interface UseEntityDeleteDeps {
  deleteTarget: Ref<ExtractedEntity | null>
  activeEvidence: Ref<ActiveEvidence | null>
  state: Readonly<Ref<AsyncTaskState<GetExtractionResponse>>>
  setData: (data: GetExtractionResponse, phase?: TaskPhase) => void
  notify: (level: NoticeLevel, text: string) => void
  /** 由视图注入的 delete 任务入口。 */
  runDelete: () => Promise<ApiResponse<DeleteEntityResult> | null>
}

export interface UseEntityDeleteApi {
  confirmDelete: () => Promise<void>
}

/**
 * 创建删除动作。
 * @param deps 删除目标、原文选中态、主任务状态机与 delete 任务入口
 * @returns 二次确认后的删除动作（无目标时不请求）
 */
export function useEntityDelete(deps: UseEntityDeleteDeps): UseEntityDeleteApi {
  async function confirmDelete(): Promise<void> {
    const target = deps.deleteTarget.value
    if (!target) return
    const response = await deps.runDelete()
    if (!response) return
    const data = deps.state.value.data
    if (data) {
      deps.setData({
        ...data,
        entities: data.entities.filter((item) => item.id !== response.data.deletedId),
        pendingConfirmCount: response.data.pendingConfirmCount,
        duplicateGroups: data.duplicateGroups.filter(
          (group) => !group.memberIds.includes(response.data.deletedId),
        ),
      })
    }
    if (deps.activeEvidence.value?.entity.id === target.id) deps.activeEvidence.value = null
    deps.deleteTarget.value = null
    deps.notify('success', '已删除实体「' + target.name + '」。删除原因与操作人建议在审计中核对。')
  }

  return { confirmDelete }
}
