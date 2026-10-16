/**
 * 同义项合并动作。
 *
 * 唯一职责：维护「候选分组 / 待保留主实体 / 最近一次合并结果」三个合并界面状态，
 * 并用注入的 merge 任务执行合并，把结果写回本地抽取结果后清空弹窗状态。
 */
import type { ComputedRef, Ref } from 'vue'

import type { NoticeLevel } from '@/composables/useAppShell'
import type { AsyncTaskState, TaskPhase } from '@/composables/useAsyncTask'
import type { ApiResponse } from '@/services/api/httpClient'
import type {
  DuplicateGroup,
  ExtractedEntity,
  GetExtractionResponse,
  MergeEntitiesResponse,
} from '@/types/api'

/** 合并成功后展示的摘要。 */
export interface MergeResultSummary {
  mergedAliases: string[]
  removedIds: string[]
}

export interface UseEntityMergeDeps {
  mergeGroup: Ref<DuplicateGroup | null>
  mergePrimaryId: Ref<string>
  mergeResult: Ref<MergeResultSummary | null>
  duplicateGroups: ComputedRef<DuplicateGroup[]>
  state: Readonly<Ref<AsyncTaskState<GetExtractionResponse>>>
  setData: (data: GetExtractionResponse, phase?: TaskPhase) => void
  notify: (level: NoticeLevel, text: string) => void
  /** 由视图注入的 merge 任务入口。 */
  runMerge: () => Promise<ApiResponse<MergeEntitiesResponse> | null>
}

export interface UseEntityMergeApi {
  /** 打开指定分组的合并弹窗，默认选中后端建议的主实体。 */
  openMerge: (group: DuplicateGroup) => void
  /** 为某条实体找到所属分组后打开合并弹窗，找不到时只提示。 */
  openMergeForEntity: (entity: ExtractedEntity) => void
  /** 关闭合并弹窗。 */
  cancelMerge: () => void
  /** 执行合并：回写本地数据、记录合并摘要并提示。 */
  confirmMerge: () => Promise<void>
}

/**
 * 创建同义项合并动作。
 * @param deps 合并界面状态、分组列表、主任务状态机与 merge 任务入口
 * @returns 打开 / 取消 / 确认合并四个动作
 */
export function useEntityMerge(deps: UseEntityMergeDeps): UseEntityMergeApi {
  function openMerge(group: DuplicateGroup): void {
    deps.mergeGroup.value = group
    deps.mergePrimaryId.value = group.suggestedPrimaryId
  }

  function openMergeForEntity(entity: ExtractedEntity): void {
    const group = deps.duplicateGroups.value.find(
      (item) => item.memberIds.includes(entity.id) && item.memberIds.length > 1,
    )
    if (!group) {
      deps.notify('info', '没有找到与该实体相关的同义项候选，可在下方分组中查看全部候选。')
      return
    }
    openMerge(group)
  }

  function cancelMerge(): void {
    deps.mergeGroup.value = null
  }

  async function confirmMerge(): Promise<void> {
    const group = deps.mergeGroup.value
    if (!group) return
    const response = await deps.runMerge()
    if (!response) return
    const result = response.data
    const data = deps.state.value.data
    if (data) {
      const nextEntities = data.entities
        .filter((item) => !result.removedIds.includes(item.id))
        .map((item) => (item.id === result.entity.id ? result.entity : item))
      deps.setData({
        ...data,
        entities: nextEntities,
        pendingConfirmCount: result.pendingConfirmCount,
        duplicateGroups: data.duplicateGroups.filter((item) => item.groupId !== group.groupId),
      })
    }
    deps.mergeResult.value = { mergedAliases: result.mergedAliases, removedIds: result.removedIds }
    deps.mergeGroup.value = null
    deps.notify(
      'success',
      '已合并为「' +
        result.entity.name +
        '」：新增别名 ' +
        String(result.mergedAliases.length) +
        ' 个，移除 ' +
        String(result.removedIds.length) +
        ' 个实体。',
    )
  }

  return { openMerge, openMergeForEntity, cancelMerge, confirmMerge }
}
