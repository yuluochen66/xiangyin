/**
 * 统一请求封装层（fetch 实例封装 + 请求/响应拦截器 + 统一错误处理）。
 *
 * 一次调用的完整链路：
 *
 *   src/api/*.ts  ──►  request(config)
 *                         │
 *                         ├─ 路径/查询参数拼装
 *                         ├─ 请求拦截器（注入鉴权头、traceId、租户头……）
 *                         ├─ 分流：VITE_USE_MOCK=true → mock 分支
 *                         │        否则 → fetch + 超时 + 自动重试
 *                         ├─ 响应拦截器（拆信封）
 *                         ├─ normalize（补齐后端可能缺失的字段）
 *                         └─ ApiError 归一化后抛出
 *
 * 约定：
 * - 组件与 composable 只依赖 `request`，不直接使用 fetch；
 * - 所有失败都以 `ApiError` 抛出，UI 不需要区分错误来源；
 * - mock 分支不自动重试，以便真实走通「失败 → 重试 → 成功」。
 */
import { env, resolveApiUrl } from '@/config/env'
import { currentLatency, mockScenario, nextAttempt, sleep } from '@/mock/scenario'

import { buildAuthHeaders, handleUnauthorized } from './auth'
import { ApiError, normalizeApiError, statusToErrorCode } from './errors'
import type {
  HttpMethod,
  MockContext,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from './types'

/** 一次成功调用的返回。 */
export interface ApiResponse<T> {
  data: T
  status: number
  /** 是否来自 mock 分支。 */
  fromMock: boolean
  /** 服务端链路 id（若返回）。 */
  traceId?: string
  /** 本次调用耗时（毫秒）。 */
  tookMs: number
  /** 是否判定为空数据（用于界面空状态）。 */
  empty: boolean
}

/** 调用钩子。 */
export interface RequestHooks {
  /** 每次自动重试前触发，用于展示「重试中 N/M」。 */
  onRetry?: (attempt: number, maxRetries: number, error: ApiError) => void
}

export interface ApiClient {
  /** 发起一次请求。失败时抛出 ApiError。 */
  request<TBody = unknown, TRes = unknown>(
    config: RequestConfig<TBody, TRes>,
    hooks?: RequestHooks,
  ): Promise<ApiResponse<TRes>>
  /** 注册请求拦截器，返回取消注册函数。 */
  useRequestInterceptor(interceptor: RequestInterceptor): () => void
  /** 注册响应拦截器，返回取消注册函数。 */
  useResponseInterceptor(interceptor: ResponseInterceptor): () => void
}

/** 后端统一信封（TODO-API-2 待确认字段名）。 */
interface Envelope<T> {
  code?: string | number
  success?: boolean
  message?: string
  msg?: string
  data?: T
  traceId?: string
  requestId?: string
}

let traceSeq = 0

function nextTraceId(): string {
  traceSeq += 1
  return `fe-${Date.now().toString(36)}-${traceSeq.toString(36)}`
}

/**
 * 替换路径参数：'/transcripts/{id}' + { id: 'T-1' } → '/transcripts/T-1'。
 * @param url 含 `{name}` 占位符的路径模板
 * @param path 占位符取值表
 * @returns 替换后的路径；未提供取值的占位符原样保留
 */
function applyPathParams(url: string, path?: Record<string, string | number>): string {
  if (!path) return url
  return url.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = path[key]
    return value === undefined ? match : encodeURIComponent(String(value))
  })
}

/**
 * 拼装查询串，剔除 undefined / null / 空数组。
 * @param query 查询参数对象
 * @returns 以 `?` 开头的查询串；无有效参数时返回空串
 */
function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      for (const item of value) params.append(key, String(item))
      continue
    }
    params.append(key, String(value))
  }
  const text = params.toString()
  return text.length > 0 ? `?${text}` : ''
}

/**
 * 后端业务码是否表示成功。
 * @param code 后端业务码
 * @returns 是否表示成功（0 / 200 / OK / SUCCESS 或缺省）
 */
function isSuccessCode(code: string | number | undefined): boolean {
  if (code === undefined) return true
  if (typeof code === 'number') return code === 0 || code === 200
  const normalized = code.trim().toUpperCase()
  return (
    normalized === '0' || normalized === '200' || normalized === 'OK' || normalized === 'SUCCESS'
  )
}

/**
 * 从响应体中取出 data，并把业务失败转成 ApiError。
 * @param raw 已解析的响应体
 * @param config 本次请求配置，用于补充错误文案
 * @param status HTTP 状态码
 * @returns `{ data, traceId }`；业务失败时抛 ApiError
 */
function unwrapEnvelope<T>(
  raw: unknown,
  config: RequestConfig<unknown, T>,
  status: number,
): { data: T; traceId?: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: raw as T }
  }

  const envelope = raw as Envelope<T>
  const looksLikeEnvelope =
    'data' in envelope || 'code' in envelope || 'success' in envelope || 'message' in envelope

  if (!looksLikeEnvelope) return { data: raw as T }

  const traceId = envelope.traceId ?? envelope.requestId
  const failed = envelope.success === false || !isSuccessCode(envelope.code)

  if (failed) {
    const businessCode = envelope.code
    throw new ApiError({
      // 业务失败但 HTTP 200：统一归为 business；若后端 503 则归为 unavailable
      code: status === 503 ? 'unavailable' : 'business',
      message: envelope.message ?? envelope.msg ?? `业务处理失败（code=${String(businessCode)}）。`,
      status,
      businessCode,
      label: config.label,
      ...(traceId ? { traceId } : {}),
    })
  }

  const result: { data: T; traceId?: string } = { data: (envelope.data ?? (raw as T)) as T }
  if (traceId) result.traceId = traceId
  return result
}

/**
 * 把响应体交给响应拦截器链。
 * @param raw 响应体
 * @param interceptors 响应拦截器列表
 * @param meta 拦截器可见的上下文（url / label）
 * @returns 依次经过全部拦截器后的响应体
 */
function runResponseInterceptors(
  raw: unknown,
  interceptors: ResponseInterceptor[],
  meta: { url: string; label: string },
): unknown {
  let current = raw
  for (const interceptor of interceptors) {
    current = interceptor(current, meta)
  }
  return current
}

/**
 * 指数退避：300ms / 900ms / 1800ms……封顶 4s。
 * @param attempt 第几次重试（从 1 开始）
 * @returns 退避毫秒数，上限 4 秒
 */
function backoffMs(attempt: number): number {
  return Math.min(4000, 300 * 3 ** (attempt - 1))
}

/**
 * 创建请求客户端。
 * @returns 带拦截器注册能力的请求客户端
 */
export function createApiClient(): ApiClient {
  const requestInterceptors: RequestInterceptor[] = []
  const responseInterceptors: ResponseInterceptor[] = []

  async function runMock<TBody, TRes>(
    config: RequestConfig<TBody, TRes>,
    label: string,
  ): Promise<ApiResponse<TRes>> {
    if (!config.mock) {
      throw new ApiError({
        code: 'unavailable',
        message: `接口 ${config.url} 未提供 mock 实现，且未配置后端地址。`,
        label,
      })
    }

    const started = performance.now()
    const key = `${config.method} ${config.url}`
    const attempt = nextAttempt(key)
    const ctx: MockContext = {
      scenario: mockScenario.value,
      latencyMs: currentLatency.value,
      attempt,
    }

    await sleep(ctx.latencyMs, config.signal)

    if (ctx.scenario === 'failure' && attempt === 1) {
      throw new ApiError({
        code: 'server',
        status: 500,
        message: 'AI 服务返回 500（Mock 场景：首次失败，重试可成功）。',
        label,
        businessCode: 'INTERNAL',
      })
    }

    if (mockScenario.value === 'unavailable') {
      throw new ApiError({
        code: 'unavailable',
        status: 503,
        message: '该 AI 能力当前未部署或已下线（Mock 场景：能力不可用）。',
        label,
        businessCode: 'CAPABILITY_OFFLINE',
      })
    }

    const data = await config.mock(ctx)
    const normalized = config.normalize ? config.normalize(data) : data
    const empty = config.isEmpty ? config.isEmpty(normalized) : false

    return {
      data: normalized,
      status: 200,
      fromMock: true,
      tookMs: Math.round(performance.now() - started),
      empty,
    }
  }

  async function runHttp<TBody, TRes>(
    config: RequestConfig<TBody, TRes>,
    label: string,
    hooks?: RequestHooks,
  ): Promise<ApiResponse<TRes>> {
    const started = performance.now()
    const maxRetries = config.maxRetries ?? env.requestMaxRetries
    const timeoutMs = config.timeoutMs ?? env.requestTimeoutMs
    const traceId = nextTraceId()

    const baseUrl =
      resolveApiUrl(applyPathParams(config.url, config.path)) + buildQuery(config.query)

    let attempt = 0

    // 重试循环：退出条件全部在 catch 分支里判断（可重试则退避后继续，否则抛出）
    while (true) {
      attempt += 1
      const controller = new AbortController()
      const onExternalAbort = (): void =>
        controller.abort(new DOMException('请求已取消', 'AbortError'))

      if (config.signal) {
        if (config.signal.aborted) onExternalAbort()
        else config.signal.addEventListener('abort', onExternalAbort, { once: true })
      }

      const timeout = setTimeout(
        () => controller.abort(new DOMException('请求超时', 'TimeoutError')),
        timeoutMs,
      )

      try {
        // ---- 请求拦截器链 ----
        let init = {
          url: baseUrl,
          method: config.method as HttpMethod,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': traceId,
            ...buildAuthHeaders(),
            ...(config.headers ?? {}),
          } as Record<string, string>,
          body: config.body as unknown,
        }
        for (const interceptor of requestInterceptors) {
          init = await interceptor(init)
        }

        const response = await fetch(init.url, {
          method: init.method,
          headers: init.headers,
          ...(init.body === undefined || init.method === 'GET'
            ? {}
            : { body: JSON.stringify(init.body) }),
          signal: controller.signal,
        })

        const text = await response.text()
        const parsed: unknown = text.length > 0 ? JSON.parse(text) : null

        if (!response.ok) {
          const envelope = (parsed ?? {}) as Envelope<unknown>
          const code = statusToErrorCode(response.status)

          if (code === 'auth') {
            handleUnauthorized(envelope.message ?? '登录状态已失效')
          }

          throw new ApiError({
            code,
            status: response.status,
            message: envelope.message ?? envelope.msg ?? `请求失败（HTTP ${response.status}）。`,
            businessCode: envelope.code,
            label,
            traceId: envelope.traceId ?? envelope.requestId ?? traceId,
          })
        }

        // ---- 响应拦截器链 ----
        const intercepted = runResponseInterceptors(parsed, responseInterceptors, {
          url: init.url,
          label,
        })

        const { data, traceId: serverTraceId } = unwrapEnvelope<TRes>(
          intercepted,
          config as unknown as RequestConfig<unknown, TRes>,
          response.status,
        )
        const normalized = config.normalize ? config.normalize(data) : data
        const empty = config.isEmpty ? config.isEmpty(normalized) : false

        const result: ApiResponse<TRes> = {
          data: normalized,
          status: response.status,
          fromMock: false,
          tookMs: Math.round(performance.now() - started),
          empty,
        }
        if (serverTraceId ?? traceId) result.traceId = serverTraceId ?? traceId
        return result
      } catch (error) {
        const apiError = normalizeApiError(error, label)

        const aborted = config.signal?.aborted === true
        const canRetry =
          apiError.retryable && attempt <= maxRetries && !aborted && apiError.code !== 'cancelled'

        if (!canRetry) throw apiError

        hooks?.onRetry?.(attempt, maxRetries, apiError)
        await sleep(backoffMs(attempt))
      } finally {
        clearTimeout(timeout)
        config.signal?.removeEventListener('abort', onExternalAbort)
      }
    }
  }

  async function request<TBody = unknown, TRes = unknown>(
    config: RequestConfig<TBody, TRes>,
    hooks?: RequestHooks,
  ): Promise<ApiResponse<TRes>> {
    const label = config.label
    try {
      if (env.useMock && config.mock) {
        return await runMock(config, label)
      }
      return await runHttp(config, label, hooks)
    } catch (error) {
      // 兜底：保证调用方拿到的永远是 ApiError
      throw normalizeApiError(error, label)
    }
  }

  return {
    request,
    useRequestInterceptor(interceptor) {
      requestInterceptors.push(interceptor)
      return () => {
        const index = requestInterceptors.indexOf(interceptor)
        if (index >= 0) requestInterceptors.splice(index, 1)
      }
    },
    useResponseInterceptor(interceptor) {
      responseInterceptors.push(interceptor)
      return () => {
        const index = responseInterceptors.indexOf(interceptor)
        if (index >= 0) responseInterceptors.splice(index, 1)
      }
    },
  }
}

/** 全局唯一客户端。业务模块统一从这里取。 */
export const api = createApiClient()
