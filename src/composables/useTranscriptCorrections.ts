/**
 * 流程 2：人工校正的保存与提交。
 *
 * 唯一职责：维护「变更说明」与「服务端剩余低置信度」，发起 POST /corrections
 * （正式提交或存草稿），并在成功后把服务端返回的版本信息与本地校正结果写回主任务数据；
 * 失败时保留本地草稿供直接重试。不含逐段编辑本身，也不涉及回滚。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { transcribeApi } from '@/api'
import type { AppShellApi } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState, TaskPhase } from '@/composables/useAsyncTask'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type { ApiError } from '@/services/api/errors'
import type { GetTranscriptResponse, SubmitCorrectionResponse } from '@/types/api'

export interface UseTranscriptCorrectionsOptions {
  /** 转写任务 id。 */
  transcriptId: string
  /** 主任务状态快照（保存成功后写入新版本与片段）。 */
  state: Readonly<Ref<AsyncTaskState<GetTranscriptResponse>>>
  /** 主任务数据写入。 */
  setData: (data: GetTranscriptResponse) => void
  /** 逐段草稿（提交失败时保留，供重试）。 */
  drafts: TranscriptDraftsApi
  /** 全局提示。 */
  notify: AppShellApi['notify']
}

export interface TranscriptCorrectionsApi {
  /** 变更说明（写入版本记录，可为空）。 */
  saveNote: Ref<string>
  /** 服务端返回的剩余低置信度段数（未收到时为 null）。 */
  lowConfidenceRemaining: Ref<number | null>
  /** 保存任务的状态机阶段。 */
  phase: ComputedRef<TaskPhase>
  /** 保存失败的错误。 */
  error: ComputedRef<ApiError | null>
  /** 保存成功但存在乐观锁冲突时的提示（非成功态为 null）。 */
  conflict: ComputedRef<SubmitCorrectionResponse['conflict']>
  /** 保存是否进行中。 */
  isBusy: ComputedRef<boolean>
  /** 提交校正；saveAsDraft 为 true 时只存草稿、不生成版本。 */
  save(saveAsDraft: boolean): Promise<void>
  /** 放弃全部未提交的校正。 */
  discardAll(): void
  /** 仅清空「剩余低置信度」（流程重置用）。 */
  resetRemaining(): void
}

export function useTranscriptCorrections(
  options: UseTranscriptCorrectionsOptions,
): TranscriptCorrectionsApi {
  const { transcriptId, state, setData, drafts, notify } = options

  const saveNote = ref('')
  const lowConfidenceRemaining = ref<number | null>(null)

  const {
    state: saveState,
    isBusy,
    run: saveRun,
  } = useAsyncTask<SubmitCorrectionResponse, [boolean]>((saveAsDraft) =>
    transcribeApi.submitCorrections({
      transcriptId,
      baseVersionId: state.value.data?.version.versionId ?? 'TVER-0001',
      editor: CURRENT_OPERATOR,
      corrections: drafts.buildCorrections(),
      saveAsDraft,
      note: saveNote.value.trim() || undefined,
    }),
  )

  const phase = computed(() => saveState.value.phase)
  const error = computed(() => saveState.value.error)
  const conflict = computed(() =>
    saveState.value.phase === 'success' ? (saveState.value.data?.conflict ?? null) : null,
  )

  /**
   * 用服务端返回的版本信息 + 本地校正结果刷新成功态数据。
   * @param saveAsDraft 是否落为草稿而非正式提交
   * @param result 接口返回的校正结果
   */
  function applyCorrectionsLocally(saveAsDraft: boolean, result: SubmitCorrectionResponse): void {
    const data = state.value.data
    if (!data) return
    const corrections = drafts.buildCorrections()
    const updatedSegments = data.segments.map((segment) => {
      const correction = corrections.find((item) => item.segmentId === segment.id)
      if (!correction) return segment
      return {
        ...segment,
        text: correction.text,
        speaker: correction.speaker,
        edited: true,
        editedBy: CURRENT_OPERATOR,
        editedAt: result.savedAt,
        confidence: Math.max(segment.confidence, 0.9),
        lowConfidence: false,
      }
    })
    const version = saveAsDraft
      ? data.version
      : {
          ...data.version,
          versionId: result.versionId,
          versionNo: result.versionNo,
          createdBy: CURRENT_OPERATOR,
          createdAt: result.savedAt,
          note: saveNote.value.trim() || '人工校正',
        }
    setData({
      ...data,
      segments: updatedSegments,
      version,
      editedCount: updatedSegments.filter((item) => item.edited).length,
      lowConfidenceCount: result.lowConfidenceRemaining,
    })
    drafts.clearDrafts()
    saveNote.value = ''
  }

  async function save(saveAsDraft: boolean): Promise<void> {
    if (!drafts.commitEditor()) return
    if (Object.keys(drafts.drafts.value).length === 0) {
      notify('info', '没有待提交的修改。')
      return
    }
    const response = await saveRun(saveAsDraft)
    if (!response) return

    const result = response.data
    lowConfidenceRemaining.value = result.lowConfidenceRemaining
    applyCorrectionsLocally(saveAsDraft, result)

    if (result.conflict && result.conflict.conflictSegmentIds.length > 0) {
      notify('warning', '保存成功，但检测到版本冲突。', result.conflict.message)
      return
    }
    notify(
      'success',
      saveAsDraft
        ? '已保存为草稿，改动 ' + String(result.changedCount) + ' 段。'
        : '已提交校正，生成版本 v' +
            String(result.versionNo) +
            '，改动 ' +
            String(result.changedCount) +
            ' 段。',
    )
  }

  function discardAll(): void {
    drafts.clearDrafts()
    drafts.cancelEdit()
    lowConfidenceRemaining.value = null
    notify('info', '已放弃全部未提交的校正内容。')
  }

  function resetRemaining(): void {
    lowConfidenceRemaining.value = null
  }

  return {
    saveNote,
    lowConfidenceRemaining,
    phase,
    error,
    conflict,
    isBusy,
    save,
    discardAll,
    resetRemaining,
  }
}
