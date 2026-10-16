/**
 * 统一异步任务状态机。
 *
 * 需求要求每个流程都必须区分 7 种状态，本 composable 就是这套状态的唯一实现，
 * 所有页面只读 `phase` 决定渲染什么，不各自维护 loading / error 布尔量。
 *
 * 状态取值（TaskPhase）：
 *   idle         未开始
 *   loading      加载中
 *   retrying     重试中（第 N/M 次）
 *   success      成功
 *   empty        空数据
 *   error        失败
 *   confirm      需人工确认
 *   unavailable  不可用（重试无意义）
 */
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { ApiError, isApiError } from '@/services/api/errors'
import type { ApiResponse } from '@/services/api/httpClient'

/** 界面状态机的状态集合。 */
export type TaskPhase =
  'idle' | 'loading' | 'retrying' | 'success' | 'empty' | 'error' | 'confirm' | 'unavailable'

/** 空数据说明。 */
export interface EmptyHint {
  reason: string
  suggestion?: string
}

/** 需人工确认时的提示内容。 */
export interface ConfirmPrompt {
  title: string
  message: string
  /** 补充细节，逐条展示。 */
  details?: string[]
  confirmText?: string
  cancelText?: string
  /** 不可取消（必须处理后才能继续）。 */
  blocking?: boolean
}

/** 任务状态快照。 */
export interface AsyncTaskState<T> {
  phase: TaskPhase
  data: T | null
  error: ApiError | null
  emptyHint: EmptyHint | null
  confirmPrompt: ConfirmPrompt | null
  unavailableReason: string | null
  /** 已发起的调用次数（含失败）。 */
  attempts: number
  /** 自动重试进度。 */
  retryProgress: { attempt: number; max: number } | null
  lastSuccessAt: number | null
  tookMs: number | null
  /** 是否来自 mock 数据。 */
  fromMock: boolean
}

export interface UseAsyncTaskOptions<TData> {
  /** 判定空数据。不传时使用响应里的 `empty` 标记。 */
  isEmpty?: (data: TData) => boolean
  /** 空数据时展示的说明。 */
  emptyHint?: EmptyHint
  /** 判定是否需要人工确认，返回 null 表示不需要。 */
  needsConfirm?: (data: TData) => ConfirmPrompt | null
  /** 是否需要人工确认（数据为空时也要确认）。 */
  /** 失败时是否允许重试，默认取 error.retryable。 */
  canRetry?: (error: ApiError) => boolean
  /** 人工确认后的回调。 */
  onConfirm?: (data: TData | null, decision: 'confirmed' | 'rejected') => void | Promise<void>
}

export interface UseAsyncTaskApi<TData, TArgs extends unknown[]> {
  state: Readonly<Ref<AsyncTaskState<TData>>>
  /** 7 态布尔视图，模板中直接用。 */
  isIdle: ComputedRef<boolean>
  isLoading: ComputedRef<boolean>
  isRetrying: ComputedRef<boolean>
  isSuccess: ComputedRef<boolean>
  isEmpty: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  needsConfirm: ComputedRef<boolean>
  isUnavailable: ComputedRef<boolean>
  /** 加载中或重试中。 */
  isBusy: ComputedRef<boolean>
  /** 当前错误是否可重试。 */
  canRetry: ComputedRef<boolean>
  /** 执行任务。首次为 loading，失败后再次调用为 retrying。 */
  run(...args: TArgs): Promise<ApiResponse<TData> | null>
  /** 使用上次参数重试。 */
  retry(): Promise<ApiResponse<TData> | null>
  /** 回应人工确认。 */
  respondConfirm(decision: 'confirmed' | 'rejected'): Promise<void>
  /** 主动把任务标记为不可用（例如能力开关关闭）。 */
  markUnavailable(reason: string): void
  /** 直接写入数据（本地编辑后同步界面）。 */
  setData(data: TData, phase?: TaskPhase): void
  /** 重置回 idle。 */
  reset(): void
  /** 中止进行中的调用。 */
  cancel(): void
}

function createInitialState<T>(): AsyncTaskState<T> {
  return {
    phase: 'idle',
    data: null,
    error: null,
    emptyHint: null,
    confirmPrompt: null,
    unavailableReason: null,
    attempts: 0,
    retryProgress: null,
    lastSuccessAt: null,
    tookMs: null,
    fromMock: false,
  }
}

/**
 * 创建异步任务。
 *
 * @param task 实际发起请求的函数，例如 `(id: string) => transcribeApi.getTranscript(id)`
 * @param options 空数据 / 需确认 / 可重试的判定规则
 * @returns 任务状态机：状态快照、8 态布尔视图，以及 run / retry / respondConfirm 等操作
 */
export function useAsyncTask<TData, TArgs extends unknown[] = []>(
  task: (...args: TArgs) => Promise<ApiResponse<TData>>,
  options: UseAsyncTaskOptions<TData> = {},
): UseAsyncTaskApi<TData, TArgs> {
  const state = shallowRef<AsyncTaskState<TData>>(createInitialState<TData>())

  let controller: AbortController | null = null
  let lastArgs: TArgs | null = null
  /** 递增令牌，丢弃过期响应。 */
  let token = 0

  const isIdle = computed(() => state.value.phase === 'idle')
  const isLoading = computed(() => state.value.phase === 'loading')
  const isRetrying = computed(() => state.value.phase === 'retrying')
  const isSuccess = computed(() => state.value.phase === 'success')
  const isEmpty = computed(() => state.value.phase === 'empty')
  const isError = computed(() => state.value.phase === 'error')
  const needsConfirm = computed(() => state.value.phase === 'confirm')
  const isUnavailable = computed(() => state.value.phase === 'unavailable')
  const isBusy = computed(() => isLoading.value || isRetrying.value)
  const canRetry = computed(() => {
    const error = state.value.error
    if (!error) return false
    return options.canRetry ? options.canRetry(error) : error.retryable
  })

  /**
   * 把成功响应落到某个终态。
   * @param response 接口成功响应
   * @param currentToken 本次调用的令牌，用于丢弃过期响应
   */
  function settleSuccess(response: ApiResponse<TData>, currentToken: number): void {
    const data = response.data
    const prompt = options.needsConfirm ? options.needsConfirm(data) : null

    if (prompt) {
      state.value = {
        ...state.value,
        phase: 'confirm',
        data,
        error: null,
        emptyHint: null,
        confirmPrompt: prompt,
        unavailableReason: null,
        retryProgress: null,
        tookMs: response.tookMs,
        fromMock: response.fromMock,
      }
      return
    }

    const empty = options.isEmpty ? options.isEmpty(data) : response.empty

    state.value = {
      ...state.value,
      phase: empty ? 'empty' : 'success',
      data,
      error: null,
      emptyHint: empty
        ? (options.emptyHint ?? {
            reason: '当前条件下没有任何数据。',
            suggestion: '请调整筛选条件或稍后重试。',
          })
        : null,
      confirmPrompt: null,
      unavailableReason: null,
      retryProgress: null,
      lastSuccessAt: Date.now(),
      tookMs: response.tookMs,
      fromMock: response.fromMock,
    }

    void currentToken
  }

  async function execute(args: TArgs, isRetry: boolean): Promise<ApiResponse<TData> | null> {
    controller?.abort()
    controller = new AbortController()

    token += 1
    const currentToken = token

    const attempts = state.value.attempts + 1

    state.value = {
      ...state.value,
      phase: isRetry ? 'retrying' : 'loading',
      error: null,
      emptyHint: null,
      confirmPrompt: null,
      unavailableReason: null,
      retryProgress:
        isRetry && state.value.retryProgress
          ? state.value.retryProgress
          : isRetry
            ? { attempt: 1, max: 1 }
            : null,
      attempts,
    }

    try {
      const response = await task(...args)
      if (currentToken !== token) return null
      settleSuccess(response, currentToken)
      return response
    } catch (error) {
      if (currentToken !== token) return null

      const apiError = isApiError(error)
        ? error
        : new ApiError({ code: 'unknown', message: String(error) })

      const unavailable = apiError.code === 'unavailable'
      const cancelled = apiError.code === 'cancelled'

      state.value = {
        ...state.value,
        phase: cancelled ? 'idle' : unavailable ? 'unavailable' : 'error',
        error: cancelled ? null : apiError,
        unavailableReason: unavailable ? apiError.message : null,
        confirmPrompt: null,
        emptyHint: null,
        retryProgress: null,
        tookMs: null,
      }

      return null
    } finally {
      if (currentToken === token) controller = null
    }
  }

  async function run(...args: TArgs): Promise<ApiResponse<TData> | null> {
    lastArgs = args
    const isRetry = state.value.attempts > 0
    return execute(args, isRetry)
  }

  async function retry(): Promise<ApiResponse<TData> | null> {
    const args = (lastArgs ?? []) as TArgs
    return execute(args, true)
  }

  async function respondConfirm(decision: 'confirmed' | 'rejected'): Promise<void> {
    const data = state.value.data
    state.value = {
      ...state.value,
      phase: decision === 'confirmed' ? 'success' : 'empty',
      confirmPrompt: null,
      emptyHint:
        decision === 'confirmed'
          ? null
          : { reason: '已放弃本次结果。', suggestion: '你可以重新发起该操作。' },
    }
    await options.onConfirm?.(data, decision)
  }

  function markUnavailable(reason: string): void {
    state.value = {
      ...state.value,
      phase: 'unavailable',
      unavailableReason: reason,
      error: null,
      confirmPrompt: null,
      retryProgress: null,
    }
  }

  function setData(data: TData, phase: TaskPhase = 'success'): void {
    state.value = {
      ...state.value,
      phase,
      data,
      error: null,
      confirmPrompt: null,
      emptyHint: null,
      lastSuccessAt: Date.now(),
    }
  }

  function reset(): void {
    controller?.abort()
    controller = null
    token += 1
    state.value = createInitialState<TData>()
    lastArgs = null
  }

  function cancel(): void {
    controller?.abort()
    controller = null
    token += 1
    if (isBusy.value) state.value = { ...state.value, phase: 'idle', retryProgress: null }
  }

  onBeforeUnmount(() => {
    controller?.abort()
  })

  return {
    state,
    isIdle,
    isLoading,
    isRetrying,
    isEmpty,
    isSuccess,
    isError,
    needsConfirm,
    isUnavailable,
    isBusy,
    canRetry,
    run,
    retry,
    respondConfirm,
    markUnavailable,
    setData,
    reset,
    cancel,
  }
}
