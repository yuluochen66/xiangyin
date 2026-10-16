/**
 * 流程 4 的资料详情链路。
 *
 * 唯一职责：维护「详情 → 关联资料 → 详情」这条可无限继续的核证链路——
 * 用 7 态状态机请求 GET /sources/{sourceId}，管理当前详情 id 与引用信息复制状态，
 * 并给出打开 / 关闭 / 重试 / 复制四个动作。它不负责检索列表本身。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { searchApi } from '@/api'
import type { NoticeLevel } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import type { ApiResponse } from '@/services/api/httpClient'
import type { GetSourceDetailResponse } from '@/types/api'

export interface UseSourceDetailOptions {
  /** 界面提示。 */
  notify: (level: NoticeLevel, text: string, detail?: string) => void
}

export interface UseSourceDetailApi {
  /** 当前打开的资料 id；null 表示侧栏关闭。 */
  detailSourceId: Ref<string | null>
  /** 引用信息是否刚复制成功。 */
  citationCopied: Ref<boolean>
  /** 详情请求的 7 态状态。 */
  detailState: Readonly<Ref<AsyncTaskState<GetSourceDetailResponse>>>
  /** 详情错误是否可重试。 */
  detailCanRetry: ComputedRef<boolean>
  /** 详情请求是否进行中。 */
  detailBusy: ComputedRef<boolean>
  /** 详情数据。 */
  detail: ComputedRef<GetSourceDetailResponse | null>
  /** 使用上次参数重试详情。 */
  retryDetail(): Promise<ApiResponse<GetSourceDetailResponse> | null>
  /** 打开资料详情；可继续点关联资料形成核证链路。 */
  openDetail(sourceId: string): void
  /** 关闭详情侧栏并复位状态。 */
  closeDetail(): void
  /** 复制 GB/T 7714 引用信息到剪贴板。 */
  copyCitation(): Promise<void>
}

/**
 * 创建资料详情链路。
 * @param options 全局提示回调
 * @returns 详情状态与打开 / 关闭 / 重试 / 复制四个动作
 */
export function useSourceDetail(options: UseSourceDetailOptions): UseSourceDetailApi {
  const detailSourceId = ref<string | null>(null)
  const citationCopied = ref(false)

  const {
    state: detailState,
    canRetry: detailCanRetry,
    isBusy: detailBusy,
    run: runDetail,
    retry: retryDetail,
    reset: resetDetail,
  } = useAsyncTask<GetSourceDetailResponse, [string]>((sourceId) =>
    searchApi.getSourceDetail(sourceId),
  )

  const detail = computed(() => detailState.value.data)

  function openDetail(sourceId: string): void {
    detailSourceId.value = sourceId
    citationCopied.value = false
    void runDetail(sourceId)
  }

  function closeDetail(): void {
    detailSourceId.value = null
    citationCopied.value = false
    resetDetail()
  }

  /**
   * 复制引用信息，并在成功后短暂显示「已复制」。
   * @returns 无返回值
   */
  async function copyCitation(): Promise<void> {
    const citation = detail.value?.citation
    if (!citation) return
    try {
      await navigator.clipboard.writeText(citation)
      citationCopied.value = true
      options.notify('success', '引用信息已复制，可直接粘贴到讲稿或参考文献。')
      window.setTimeout(() => {
        citationCopied.value = false
      }, 1800)
    } catch {
      options.notify('warning', '浏览器拒绝了剪贴板写入', '请手动选中引用文本后复制。')
    }
  }

  return {
    detailSourceId,
    citationCopied,
    detailState,
    detailCanRetry,
    detailBusy,
    detail,
    retryDetail,
    openDetail,
    closeDetail,
    copyCitation,
  }
}
