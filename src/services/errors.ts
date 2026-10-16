/**
 * 工具错误归一化。
 *
 * 目标：不管底层抛出来的是 DOMException、TypeError 还是后端约定的错误体，
 * 调用方拿到的永远是同一个 `ToolError` 形状，UI 层不需要写分支判断。
 */
import type { ToolError, ToolErrorCode, ToolName } from '@/types/tools'

/** 各错误码是否值得重试。 */
const RETRYABLE_CODES: ReadonlySet<ToolErrorCode> = new Set<ToolErrorCode>([
  'network',
  'timeout',
  'server',
])

const DEFAULT_MESSAGES: Record<ToolErrorCode, string> = {
  network: '网络连接失败，请检查网络后重试。',
  timeout: '工具响应超时，请稍后重试。',
  invalid_input: '提交的参数不合法，请检查后重试。',
  not_found: '未找到对应的数据。',
  server: '服务端处理失败，请稍后重试。',
  cancelled: '调用已取消。',
  unknown: '发生未知错误。',
}

/** 工具调用失败时抛出的统一异常。 */
export class ToolInvocationError extends Error {
  readonly tool: ToolName | 'unknown'
  readonly code: ToolErrorCode
  readonly retryable: boolean
  readonly details?: Record<string, unknown>

  constructor(init: {
    tool: ToolName | 'unknown'
    code: ToolErrorCode
    message?: string
    retryable?: boolean
    details?: Record<string, unknown>
    cause?: unknown
  }) {
    super(init.message ?? DEFAULT_MESSAGES[init.code], { cause: init.cause })
    this.name = 'ToolInvocationError'
    this.tool = init.tool
    this.code = init.code
    this.retryable = init.retryable ?? RETRYABLE_CODES.has(init.code)
    this.details = init.details
  }

  /**
   * 转换为可序列化的 ToolError。
   * @returns 归一化后的 ToolError（含 code / message / retryable）
   */
  toToolError(): ToolError {
    const error: ToolError = {
      tool: this.tool,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    }
    if (this.details !== undefined) error.details = this.details
    return error
  }
}

export function isToolInvocationError(value: unknown): value is ToolInvocationError {
  return value instanceof ToolInvocationError
}

/**
 * 判断是否为用户主动取消（AbortSignal）。
 * @param error 待判断的异常
 * @returns 是否属于取消或超时类异常
 */
function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError'
  }
  return error instanceof Error && error.name === 'AbortError'
}

/**
 * 把任意异常收敛为 `ToolError`。
 *
 * @param tool 发生错误的工具名，无法判定时传 'unknown'
 * @param error 任意异常
 * @returns 统一的 ToolError；绝不抛错
 */
export function normalizeToolError(tool: ToolName | 'unknown', error: unknown): ToolError {
  if (isToolInvocationError(error)) {
    const normalized = error.toToolError()
    return tool === 'unknown' ? normalized : { ...normalized, tool }
  }

  if (isAbortError(error)) {
    return {
      tool,
      code: 'cancelled',
      message: DEFAULT_MESSAGES.cancelled,
      retryable: false,
    }
  }

  if (error instanceof TypeError) {
    return {
      tool,
      code: 'network',
      message: DEFAULT_MESSAGES.network,
      retryable: true,
      details: { raw: error.message },
    }
  }

  if (error instanceof Error) {
    return {
      tool,
      code: 'unknown',
      message: error.message || DEFAULT_MESSAGES.unknown,
      retryable: false,
      details: { name: error.name },
    }
  }

  return {
    tool,
    code: 'unknown',
    message: DEFAULT_MESSAGES.unknown,
    retryable: false,
    details: { raw: String(error) },
  }
}
