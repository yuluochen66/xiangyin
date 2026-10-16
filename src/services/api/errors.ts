/**
 * 接口错误归一化。
 *
 * 无论底层是 fetch 抛的 TypeError、AbortError、HTTP 状态码还是后端的业务错误体，
 * 到达 UI 层时永远是这个 `ApiError` 形状，组件不需要写分支判断。
 */
import type { ApiErrorCode } from './types'

/** 各错误码的默认中文文案。 */
const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  network: '网络连接失败，请检查网络后重试。',
  timeout: '请求超时，服务响应过慢，请稍后重试。',
  auth: '登录状态已失效，请重新登录。',
  forbidden: '当前账号没有该操作的权限。',
  notFound: '请求的资源不存在或已被删除。',
  validation: '提交的参数不合法，请检查后重试。',
  business: '业务规则拒绝了本次操作。',
  server: '服务端处理失败，请稍后重试。',
  unavailable: '该能力当前不可用，请联系管理员或稍后再试。',
  cancelled: '请求已取消。',
  unknown: '发生未知错误。',
}

/** 哪些错误码值得自动 / 手动重试。 */
const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>(['network', 'timeout', 'server'])

/** 哪些错误码需要跳转登录。 */
const AUTH_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>(['auth'])

export interface ApiErrorInit {
  code: ApiErrorCode
  /** 可直接展示给用户的中文文案；不传则用默认文案。 */
  message?: string
  /** HTTP 状态码，网络层错误为 undefined。 */
  status?: number
  /** 后端业务码，原样保留用于排查。 */
  businessCode?: string | number
  /** 接口中文名，用于提示「哪个操作失败了」。 */
  label?: string
  /** 链路追踪 id。 */
  traceId?: string
  /** 附加信息（字段级校验错误等）。 */
  details?: Record<string, unknown>
  cause?: unknown
}

/** 统一的接口异常。 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | undefined
  readonly businessCode: string | number | undefined
  readonly label: string | undefined
  readonly traceId: string | undefined
  readonly details: Record<string, unknown> | undefined
  readonly retryable: boolean
  /** 是否需要跳转登录。 */
  readonly needsLogin: boolean

  constructor(init: ApiErrorInit) {
    super(init.message ?? DEFAULT_MESSAGE[init.code], { cause: init.cause })
    this.name = 'ApiError'
    this.code = init.code
    this.status = init.status
    this.businessCode = init.businessCode
    this.label = init.label
    this.traceId = init.traceId
    this.details = init.details
    this.retryable = RETRYABLE.has(init.code)
    this.needsLogin = AUTH_CODES.has(init.code)
  }

  /**
   * 带操作名的完整提示，例如「转写任务发起失败：网络连接失败」。
   * @returns 带接口名的完整提示，例如「转写任务发起失败：请求超时」
   */
  get displayMessage(): string {
    return this.label ? `${this.label}失败：${this.message}` : this.message
  }

  /**
   * 可序列化副本，便于写入日志或展示。
   * @returns 可序列化副本，便于写日志或展示
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      businessCode: this.businessCode,
      label: this.label,
      traceId: this.traceId,
      retryable: this.retryable,
      details: this.details,
    }
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError' || error.name === 'TimeoutError'
  }
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError'
}

/**
 * HTTP 状态码 → 错误码。
 * @param status HTTP 状态码
 * @returns 对应的前端错误码
 */
export function statusToErrorCode(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return 'validation'
  if (status === 401) return 'auth'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'notFound'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 499) return 'cancelled'
  if (status === 503) return 'unavailable'
  if (status >= 500) return 'server'
  return 'unknown'
}

/**
 * 把任意异常收敛为 ApiError。
 * @param error 任意异常（含非 Error 值）
 * @param label 接口中文名，会附加到错误上用于提示
 * @returns 统一的 ApiError 实例
 */
export function normalizeApiError(error: unknown, label?: string): ApiError {
  if (isApiError(error)) {
    return label && !error.label
      ? new ApiError({
          code: error.code,
          message: error.message,
          status: error.status,
          businessCode: error.businessCode,
          label,
          traceId: error.traceId,
          details: error.details,
          cause: error,
        })
      : error
  }

  if (isTimeoutError(error)) {
    return new ApiError({ code: 'timeout', label, cause: error })
  }

  if (isAbortError(error)) {
    return new ApiError({ code: 'cancelled', label, cause: error })
  }

  if (error instanceof TypeError) {
    return new ApiError({ code: 'network', label, details: { raw: error.message }, cause: error })
  }

  if (error instanceof SyntaxError) {
    return new ApiError({
      code: 'server',
      message: '服务端返回了无法解析的响应体。',
      label,
      cause: error,
    })
  }

  if (error instanceof Error) {
    return new ApiError({ code: 'unknown', message: error.message, label, cause: error })
  }

  return new ApiError({ code: 'unknown', label, details: { raw: String(error) } })
}
