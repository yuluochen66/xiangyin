/**
 * HTTP transport：真实后端接入点。
 *
 * ⚠️ 以下约定为**占位假设**，后端接口确定后必须逐条核对（标 TODO 处）：
 *   TODO-1 路由：默认 POST `{baseUrl}/tools/{toolName}`，需确认实际路由风格。
 *   TODO-2 请求体：直接透传 ToolContract 的 input，需确认是否需要包一层 { params }。
 *   TODO-3 响应体：默认 `{ ok: true, data }` / `{ ok: false, error }`，需确认错误信封结构。
 *   TODO-4 认证：当前仅支持静态请求头，需确认是否使用 Cookie / Bearer / 签名。
 *   TODO-5 错误码映射：后端错误码 → ToolErrorCode 的对照表需与后端约定。
 */
import type { ToolContract, ToolErrorCode, ToolName } from '@/types/tools'

import { ToolInvocationError } from '../errors'
import type { InvokeOptions, ToolTransport } from '../transport'

export interface HttpTransportOptions {
  /** 例如 `https://api.example.com/v1`。 */
  baseUrl: string
  /** 覆盖默认路由。key 为工具名，value 为相对路径。 */
  routes?: Partial<Record<ToolName, string>>
  /** 单次调用默认超时（毫秒），默认 15000。 */
  timeoutMs?: number
  /** 静态请求头，或返回请求头的函数。 */
  headers?: Record<string, string> | (() => Record<string, string>)
  /** 注入自定义 fetch（测试用）。 */
  fetchImpl?: typeof fetch
}

/** 后端错误信封（TODO-3 待确认）。 */
interface HttpErrorEnvelope {
  code?: string
  message?: string
  details?: Record<string, unknown>
}

/** 后端成功信封（TODO-3 待确认）。 */
interface HttpSuccessEnvelope<T> {
  ok: true
  data: T
}

/** 后端错误码 → 前端错误码（TODO-5 待确认）。 */
const ERROR_CODE_MAP: Record<string, ToolErrorCode> = {
  INVALID_ARGUMENT: 'invalid_input',
  NOT_FOUND: 'not_found',
  DEADLINE_EXCEEDED: 'timeout',
  UNAVAILABLE: 'server',
  INTERNAL: 'server',
  RESOURCE_EXHAUSTED: 'server',
  CANCELLED: 'cancelled',
}

const DEFAULT_TIMEOUT_MS = 15_000

function resolveHeaders(headers: HttpTransportOptions['headers']): Record<string, string> {
  if (!headers) return {}
  return typeof headers === 'function' ? headers() : headers
}

/**
 * 把 HTTP 状态码映射为工具错误码。
 * @param status HTTP 状态码
 * @returns 对应的 ToolErrorCode
 */
function statusToCode(status: number): ToolErrorCode {
  if (status === 400 || status === 422) return 'invalid_input'
  if (status === 404) return 'not_found'
  if (status === 408 || status === 504) return 'timeout'
  if (status === 499) return 'cancelled'
  if (status >= 500) return 'server'
  return 'unknown'
}

/**
 * 创建 HTTP transport。
 * @param options 基址、超时与失败注入设置
 * @returns 走真实 HTTP 的 ToolTransport
 */
export function createHttpTransport(options: HttpTransportOptions): ToolTransport {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  async function invoke<K extends ToolName>(
    tool: K,
    input: ToolContract[K]['input'],
    invokeOptions?: InvokeOptions,
  ): Promise<ToolContract[K]['output']> {
    const route = options.routes?.[tool] ?? `/tools/${tool}`
    const url = `${options.baseUrl.replace(/\/+$/, '')}${route}`

    // 合并外部取消信号与超时信号
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new DOMException('请求超时', 'TimeoutError')),
      invokeOptions?.timeoutMs ?? timeoutMs,
    )
    const onExternalAbort = (): void =>
      controller.abort(new DOMException('调用已取消', 'AbortError'))

    if (invokeOptions?.signal) {
      if (invokeOptions.signal.aborted) onExternalAbort()
      else invokeOptions.signal.addEventListener('abort', onExternalAbort, { once: true })
    }

    try {
      const response = await doFetch(url, {
        method: 'POST', // TODO-1 待确认
        headers: { 'Content-Type': 'application/json', ...resolveHeaders(options.headers) },
        body: JSON.stringify(input), // TODO-2 待确认
        signal: controller.signal,
      })

      const text = await response.text()
      const payload: unknown = text.length > 0 ? (JSON.parse(text) as unknown) : null

      if (!response.ok) {
        const envelope = (payload ?? {}) as HttpErrorEnvelope
        throw new ToolInvocationError({
          tool,
          code: envelope.code
            ? (ERROR_CODE_MAP[envelope.code] ?? statusToCode(response.status))
            : statusToCode(response.status),
          message: envelope.message ?? `工具调用失败（HTTP ${response.status}）。`,
          details: { status: response.status, ...(envelope.details ?? {}) },
        })
      }

      // 兼容两种返回：{ ok, data } 信封，或直接返回 data
      if (payload !== null && typeof payload === 'object' && 'ok' in payload) {
        const envelope = payload as
          HttpSuccessEnvelope<ToolContract[K]['output']> | { ok: false; error?: HttpErrorEnvelope }
        if (envelope.ok === false) {
          const error = (envelope as { error?: HttpErrorEnvelope }).error ?? {}
          throw new ToolInvocationError({
            tool,
            code: error.code ? (ERROR_CODE_MAP[error.code] ?? 'server') : 'server',
            message: error.message ?? '工具返回失败结果。',
            details: error.details,
          })
        }
        return (envelope as HttpSuccessEnvelope<ToolContract[K]['output']>).data
      }

      return payload as ToolContract[K]['output']
    } catch (error) {
      if (error instanceof ToolInvocationError) throw error

      // 由本函数触发的超时：AbortController.abort(reason) 在部分运行时以 reason 抛出
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ToolInvocationError({
          tool,
          code: 'timeout',
          message: '工具响应超时，请稍后重试。',
          cause: error,
        })
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ToolInvocationError({
          tool,
          code: 'timeout',
          message: '工具响应超时，请稍后重试。',
          cause: error,
        })
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ToolInvocationError({
          tool,
          code: 'cancelled',
          message: '调用已取消。',
          cause: error,
        })
      }
      if (error instanceof SyntaxError) {
        throw new ToolInvocationError({
          tool,
          code: 'server',
          message: '服务端返回了无法解析的响应体。',
          cause: error,
        })
      }
      throw error
    } finally {
      clearTimeout(timeout)
      invokeOptions?.signal?.removeEventListener('abort', onExternalAbort)
    }
  }

  return { kind: 'http', invoke }
}
