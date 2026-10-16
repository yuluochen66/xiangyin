/**
 * 流程 2：版本记录的拉取与回滚。
 *
 * 唯一职责：维护版本列表弹窗与回滚二次确认的界面状态，
 * 发起 GET /versions 与 POST /rollback，并把回滚结果写回主任务的转写数据。
 * 不负责逐段编辑，也不负责 AI 建议。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { transcribeApi } from '@/api'
import type { AppShellApi } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type {
  GetTranscriptResponse,
  RollbackTranscriptResponse,
  TranscriptVersionListResponse,
  TranscriptVersionRecord,
} from '@/types/api'
import type { ApiError } from '@/services/api/errors'

/** 版本来源的中文名。 */
export const VERSION_SOURCE_LABEL: Record<TranscriptVersionRecord['source'], string> = {
  ai: 'AI 初稿',
  human: '人工校正',
  rollback: '回滚',
}

/** 版本来源对应的胶囊色。 */
export const VERSION_SOURCE_TONE: Record<
  TranscriptVersionRecord['source'],
  'info' | 'success' | 'warning'
> = {
  ai: 'info',
  human: 'success',
  rollback: 'warning',
}

export interface UseTranscriptVersionsOptions {
  /** 转写任务 id。 */
  transcriptId: string
  /** 主任务状态快照（回滚成功后写入新数据）。 */
  state: Readonly<Ref<AsyncTaskState<GetTranscriptResponse>>>
  /** 主任务数据写入（回滚后刷新片段与当前版本）。 */
  setData: (data: GetTranscriptResponse) => void
  /** 逐段草稿（回滚会清空未提交内容）。 */
  drafts: TranscriptDraftsApi
  /** 全局提示。 */
  notify: AppShellApi['notify']
}

export interface TranscriptVersionsApi {
  /** 版本列表任务的 7 态状态机快照。 */
  state: Readonly<Ref<AsyncTaskState<TranscriptVersionListResponse>>>
  /** 版本列表失败后是否允许重试。 */
  canRetry: ComputedRef<boolean>
  /** 版本列表是否进行中。 */
  isBusy: ComputedRef<boolean>
  /** 回滚是否进行中。 */
  rollbackIsBusy: ComputedRef<boolean>
  /** 回滚失败的错误（非 error 态时为 null）。 */
  rollbackError: ComputedRef<ApiError | null>
  /** 版本记录弹窗是否打开。 */
  versionOpen: Ref<boolean>
  /** 待确认回滚的目标版本。 */
  pendingRollback: Ref<TranscriptVersionRecord | null>
  /** 拉取版本列表（并打开弹窗）。 */
  openVersions(): void
  /** 关闭版本记录弹窗。 */
  closeVersions(): void
  /** 请求回滚到某个版本（进入二次确认）。 */
  askRollback(record: TranscriptVersionRecord): void
  /** 取消回滚二次确认。 */
  cancelRollback(): void
  /** 确认回滚并刷新数据与版本列表。 */
  confirmRollback(): Promise<void>
  /** 重新拉取版本列表。 */
  run(): void
  /** 使用上次参数重试版本列表。 */
  retry(): void
}

export function useTranscriptVersions(
  options: UseTranscriptVersionsOptions,
): TranscriptVersionsApi {
  const { transcriptId, state, setData, drafts, notify } = options

  const {
    state: versionState,
    canRetry: versionCanRetry,
    isBusy: versionBusy,
    run: versionRun,
    retry: versionRetry,
  } = useAsyncTask<TranscriptVersionListResponse, []>(
    () => transcribeApi.listVersions(transcriptId),
    {
      isEmpty: (data) => data.versions.length === 0,
      emptyHint: {
        reason: '该转写稿还没有任何版本记录。',
        suggestion: '保存一次人工校正后会生成新版本。',
      },
    },
  )

  const versionOpen = ref(false)
  const pendingRollback = ref<TranscriptVersionRecord | null>(null)

  const {
    state: rollbackState,
    isBusy: rollbackBusy,
    run: rollbackRun,
  } = useAsyncTask<RollbackTranscriptResponse, [string]>((targetVersionId) =>
    transcribeApi.rollback({
      transcriptId,
      targetVersionId,
      operator: CURRENT_OPERATOR,
      note: '回滚到版本 v' + String(pendingRollback.value?.versionNo ?? '?'),
    }),
  )

  const rollbackError = computed(() =>
    rollbackState.value.phase === 'error' ? rollbackState.value.error : null,
  )

  function run(): void {
    void versionRun()
  }

  function retry(): void {
    void versionRetry()
  }

  function openVersions(): void {
    versionOpen.value = true
    run()
  }

  function closeVersions(): void {
    versionOpen.value = false
  }

  function askRollback(record: TranscriptVersionRecord): void {
    pendingRollback.value = record
  }

  function cancelRollback(): void {
    pendingRollback.value = null
  }

  async function confirmRollback(): Promise<void> {
    const target = pendingRollback.value
    if (!target) return
    const response = await rollbackRun(target.versionId)
    if (!response) return
    const data = state.value.data
    if (data) {
      const rollbackSegments = response.data.segments
      setData({
        ...data,
        segments: rollbackSegments,
        lowConfidenceCount: rollbackSegments.filter((item) => item.lowConfidence).length,
        editedCount: rollbackSegments.filter((item) => item.edited).length,
        version: {
          ...data.version,
          versionId: response.data.currentVersionId,
          versionNo: response.data.versionNo,
          createdBy: CURRENT_OPERATOR,
          createdAt: new Date().toISOString(),
          note: '回滚至版本 v' + String(target.versionNo),
        },
      })
    }
    drafts.clearDrafts()
    drafts.cancelEdit()
    pendingRollback.value = null
    versionOpen.value = false
    notify(
      'success',
      '已回滚至版本 v' +
        String(target.versionNo) +
        '，并生成新版本 v' +
        String(response.data.versionNo) +
        '。',
    )
    run()
  }

  return {
    state: versionState,
    canRetry: versionCanRetry,
    isBusy: versionBusy,
    rollbackIsBusy: rollbackBusy,
    rollbackError,
    versionOpen,
    pendingRollback,
    openVersions,
    closeVersions,
    askRollback,
    cancelRollback,
    confirmRollback,
    run,
    retry,
  }
}
