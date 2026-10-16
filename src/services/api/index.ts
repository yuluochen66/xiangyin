/**
 * 服务层出口（统一请求封装 + 鉴权 + 错误归一）。
 *
 * 业务模块（src/api/*.ts）统一 `import { request } from '@/services/api'`，
 * 不直接使用 fetch。
 */
import { api } from './httpClient'
import type { ApiResponse, RequestHooks } from './httpClient'
import type { RequestConfig } from './types'

export { api, createApiClient } from './httpClient'
export type { ApiClient, ApiResponse, RequestHooks } from './httpClient'
export { ApiError, isApiError, normalizeApiError, statusToErrorCode } from './errors'
export {
  AUTH_EXPIRED_EVENT,
  buildAuthHeaders,
  clearSession,
  getAuthToken,
  getSession,
  handleUnauthorized,
  isAuthenticated,
  onAuthExpired,
  setSession,
} from './auth'
export type { AuthSession } from './auth'
export { MOCK_SCENARIOS } from './types'
export type {
  ApiErrorCode,
  HttpMethod,
  MockContext,
  MockResolver,
  MockScenario,
  PageQuery,
  PageResult,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from './types'

/**
 * 发起一次接口调用（全局单例客户端）。
 *
 * @param config 接口描述，见 RequestConfig
 * @param hooks  调用钩子（自动重试通知等）
 * @throws ApiError 所有失败路径都会归一为 ApiError
 * @returns 接口响应信封；任何失败都会抛 ApiError
 */
export function request<TBody = unknown, TRes = unknown>(
  config: RequestConfig<TBody, TRes>,
  hooks?: RequestHooks,
): Promise<ApiResponse<TRes>> {
  return api.request<TBody, TRes>(config, hooks)
}
