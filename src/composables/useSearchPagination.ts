/**
 * 流程 4 的「加载更多」追加式分页。
 *
 * 唯一职责：在已有结果的基础上请求下一页，把新命中去重后追加到列表末尾并写回成功态；
 * 追加页为空时只把 hasMore 置为 false，不清空已有列表。
 * 追加期间置起 appending 标记，供主视图在 needsConfirm 里跳过重复的人工确认。
 */
import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { NoticeLevel } from '@/composables/useAppShell'
import type { AsyncTaskState, TaskPhase } from '@/composables/useAsyncTask'
import type { ApiResponse } from '@/services/api/httpClient'
import type { SearchSourcesResponse } from '@/types/api'

export interface UseSearchPaginationOptions {
  /** 当前结果（含页码与 hasMore）。 */
  result: ComputedRef<SearchSourcesResponse | null>
  /** 检索任务状态，用于判断追加后落在哪个终态。 */
  state: Readonly<Ref<AsyncTaskState<SearchSourcesResponse>>>
  /** 是否有请求进行中。 */
  isBusy: ComputedRef<boolean>
  /** 发起某一页的检索。 */
  run: (page: number) => Promise<ApiResponse<SearchSourcesResponse> | null>
  /** 直接写回状态机数据。 */
  setData: (data: SearchSourcesResponse, phase?: TaskPhase) => void
  /** 追加请求标记；为 true 时 needsConfirm 不再弹人工确认。 */
  appending: Ref<boolean>
  /** 界面提示。 */
  notify: (level: NoticeLevel, text: string, detail?: string) => void
}

export interface UseSearchPaginationApi {
  /** 追加请求是否进行中。 */
  loadMoreBusy: Ref<boolean>
  /** 加载下一页并追加到列表末尾。 */
  loadMore(): Promise<void>
}

/**
 * 创建追加式分页。
 * @param options 结果、状态机与提示回调
 * @returns 追加请求状态与 loadMore 动作
 */
export function useSearchPagination(options: UseSearchPaginationOptions): UseSearchPaginationApi {
  const loadMoreBusy = ref(false)

  /**
   * 请求下一页并把结果追加到已有列表末尾。
   * @returns 无返回值
   */
  async function loadMore(): Promise<void> {
    const current = options.result.value
    if (!current || !current.hasMore || loadMoreBusy.value || options.isBusy.value) return

    loadMoreBusy.value = true
    options.appending.value = true
    const response = await options.run(current.page + 1)
    options.appending.value = false
    loadMoreBusy.value = false

    if (!response) return

    if (options.state.value.phase === 'success' || options.state.value.phase === 'confirm') {
      const seen = new Set(current.hits.map((hit) => hit.sourceId))
      const appended = response.data.hits.filter((hit) => !seen.has(hit.sourceId))
      // 追加后写回成功态，避免状态机停留在 loading / 把已有列表清空
      options.setData(
        { ...response.data, hits: [...current.hits, ...appended], page: response.data.page },
        'success',
      )
      options.notify('success', `已追加第 ${response.data.page} 页共 ${appended.length} 条结果。`)
      return
    }

    if (options.state.value.phase === 'empty') {
      // 追加页为空：保留已有列表，仅把 hasMore 置为 false
      options.setData({ ...current, hasMore: false }, 'success')
      options.notify('info', '没有更多结果了。')
    }
  }

  return { loadMoreBusy, loadMore }
}
