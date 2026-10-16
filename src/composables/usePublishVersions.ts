/**
 * 流程 7「审核发布」的版本记录与回滚。
 *
 * 唯一职责：持有版本列表、当前版本标记与待确认的回滚目标，并把
 * GET /contents/{contentId}/versions 与 POST /contents/{contentId}/rollback
 * 两条接口封装成带 7 态状态的异步任务。
 * 不负责状态机判定、风险检查与发布，那些属于相邻的 usePublish* 组合式函数。
 */
import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { PUBLISH_STATUS_META, publishApi } from '@/api'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type {
  ContentVersionRecord,
  PublishStatus,
  RollbackContentResponse,
  VersionListResponse,
} from '@/types/api'

/** 版本记录与回滚能力的对外接口。 */
export interface UsePublishVersionsApi {
  /** 版本记录列表。 */
  versions: Ref<ContentVersionRecord[]>
  /** 当前版本 id，用于高亮与禁用回滚。 */
  currentVersionId: Ref<string>
  /** 待二次确认的回滚目标；非 null 时弹出确认框。 */
  rollbackTarget: Ref<ContentVersionRecord | null>
  /** 版本列表任务的 7 态状态快照。 */
  versionState: Readonly<Ref<AsyncTaskState<VersionListResponse>>>
  /** 版本列表是否加载中。 */
  versionBusy: ComputedRef<boolean>
  /** 版本列表失败是否可重试。 */
  versionCanRetry: ComputedRef<boolean>
  /** 回滚任务的 7 态状态快照。 */
  rollbackState: Readonly<Ref<AsyncTaskState<RollbackContentResponse>>>
  /** 回滚是否进行中。 */
  rollbackBusy: ComputedRef<boolean>
  /** 拉取版本记录。 */
  refreshVersions: () => Promise<void>
  /** 记录回滚目标，仅打开确认框，不发起请求。 */
  requestRollback: (version: ContentVersionRecord) => void
  /** 确认后执行回滚。 */
  doRollback: () => Promise<void>
}

/**
 * 组装版本记录与回滚能力。
 * @param options contentId 为被操作内容 id；applyStatus 用于回滚成功后同步状态机
 * @returns 版本列表、回滚目标与两条接口任务的状态和操作
 */
export function usePublishVersions(options: {
  contentId: string
  applyStatus: (status: PublishStatus) => void
}): UsePublishVersionsApi {
  const { notify } = useAppShell()

  const versions = ref<ContentVersionRecord[]>([])
  const currentVersionId = ref<string>('')
  const rollbackTarget = ref<ContentVersionRecord | null>(null)

  const {
    state: versionState,
    isBusy: versionBusy,
    canRetry: versionCanRetry,
    run: runListVersions,
  } = useAsyncTask<VersionListResponse, []>(() => publishApi.listVersions(options.contentId), {
    isEmpty: (data) => data.versions.length === 0,
    emptyHint: {
      reason: '该内容还没有任何版本记录。',
      suggestion: '在流程 6 中「保存为版本」，或在流程 7 完成一次状态流转后，这里就会产生记录。',
    },
  })

  const {
    state: rollbackState,
    isBusy: rollbackBusy,
    run: runRollback,
  } = useAsyncTask<RollbackContentResponse, [string]>((versionId: string) =>
    publishApi.rollback({
      contentId: options.contentId,
      targetVersionId: versionId,
      operator: { ...CURRENT_OPERATOR },
    }),
  )

  async function refreshVersions(): Promise<void> {
    const response = await runListVersions()
    if (response) {
      versions.value = response.data.versions.map((item) => ({ ...item }))
      currentVersionId.value = response.data.currentVersionId
    } else if (versionState.value.error) {
      notify('error', '获取版本记录失败', versionState.value.error.displayMessage)
    }
  }

  function requestRollback(version: ContentVersionRecord): void {
    rollbackTarget.value = version
  }

  async function doRollback(): Promise<void> {
    const target = rollbackTarget.value
    if (!target) return
    const response = await runRollback(target.versionId)
    if (response) {
      options.applyStatus(response.data.status)
      rollbackTarget.value = null
      notify(
        'success',
        '已回滚',
        '当前状态：' +
          PUBLISH_STATUS_META[response.data.status].label +
          ' · 新版本 v' +
          String(response.data.versionNo),
      )
      void refreshVersions()
    } else if (rollbackState.value.error) {
      notify('error', '回滚失败', rollbackState.value.error.displayMessage)
    }
  }

  return {
    versions,
    currentVersionId,
    rollbackTarget,
    versionState,
    versionBusy,
    versionCanRetry,
    rollbackState,
    rollbackBusy,
    refreshVersions,
    requestRollback,
    doRollback,
  }
}
