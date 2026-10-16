/**
 * 手工新增 / 编辑实体的保存动作。
 *
 * 唯一职责：把表单内容交给调用方注入的 upsert 任务执行，成功后用响应数据刷新本地
 * 成功态（不重新请求，避免再次触发 needsConfirm），并按新增 / 编辑给出提示。
 */
import type { Ref } from 'vue'

import type { NoticeLevel } from '@/composables/useAppShell'
import type { AsyncTaskState, TaskPhase } from '@/composables/useAsyncTask'
import type { EntityForm } from '@/composables/useEntityForm'
import type { ApiResponse } from '@/services/api/httpClient'
import type { ExtractedEntity, GetExtractionResponse, UpsertEntityResponse } from '@/types/api'

/** 本地成功态回写所需的抽取标识（数据为空时用来构造兜底结果）。 */
export interface ExtractionIds {
  extractionId: string
  interviewId: string
  transcriptId: string
}

export interface UseEntitySaveDeps {
  form: EntityForm
  formOpen: Ref<boolean>
  /** 主任务状态机，用于读回当前结果并写入本地成功态。 */
  state: Readonly<Ref<AsyncTaskState<GetExtractionResponse>>>
  setData: (data: GetExtractionResponse, phase?: TaskPhase) => void
  notify: (level: NoticeLevel, text: string) => void
  ids: ExtractionIds
  /** 由视图注入的 upsert 任务入口。 */
  runUpsert: () => Promise<ApiResponse<UpsertEntityResponse> | null>
}

export interface UseEntitySaveApi {
  saveEntity: () => Promise<void>
}

/**
 * 创建实体保存动作。
 * @param deps 表单、主任务状态机、抽取标识与 upsert 任务入口
 * @returns 保存动作：名称为空时只提示不请求，成功时回写本地数据并关闭弹窗
 */
export function useEntitySave(deps: UseEntitySaveDeps): UseEntitySaveApi {
  /**
   * 用写操作返回的数据刷新本地成功态（不重新请求，避免再次触发 needsConfirm）。
   * @param entity 要写入的实体
   * @param pending 写入后的待确认条数
   */
  function upsertLocal(entity: ExtractedEntity, pending: number): void {
    const data = deps.state.value.data
    const base: GetExtractionResponse = data ?? {
      extractionId: deps.ids.extractionId,
      interviewId: deps.ids.interviewId,
      transcriptId: deps.ids.transcriptId,
      status: 'succeeded',
      entities: [],
      pendingConfirmCount: 0,
      duplicateGroups: [],
      aiMeta: {
        model: 'manual',
        modelVersion: '-',
        confidence: 0,
        needsHumanConfirm: false,
        generatedAt: new Date().toISOString(),
        tookMs: 0,
        unavailableReason: 'NER 能力未部署，已切换为手工录入。',
      },
    }
    const exists = base.entities.some((item) => item.id === entity.id)
    const nextEntities = exists
      ? base.entities.map((item) => (item.id === entity.id ? entity : item))
      : [...base.entities, entity]
    deps.setData({
      ...base,
      entities: nextEntities,
      pendingConfirmCount: pending,
      status: nextEntities.length === 0 ? 'partial' : 'succeeded',
    })
  }

  async function saveEntity(): Promise<void> {
    const name = deps.form.name.trim()
    if (name.length === 0) {
      deps.notify('warning', '实体名称不能为空。')
      return
    }
    const editing = deps.form.entityId.length > 0
    const response = await deps.runUpsert()
    if (!response) return
    const saved = response.data.entity
    upsertLocal(saved, response.data.pendingConfirmCount)
    deps.notify(
      'success',
      editing
        ? '已更新实体「' + saved.name + '」并标记为已确认。'
        : '已新增实体「' + saved.name + '」。',
    )
    deps.formOpen.value = false
  }

  return { saveEntity }
}
