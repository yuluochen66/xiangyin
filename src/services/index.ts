/**
 * 服务层出口。
 *
 * 默认使用 mock transport；当 `.env.local` 中配置了 `VITE_TOOL_BASE_URL` 时
 * 自动切换到 HTTP transport。上层代码只依赖 `toolClient`，无需关心实现。
 */
import { createHttpTransport } from './http/httpTransport'
import { DEFAULT_MOCK_DATASET, createMockTransport } from './mock/mockTransport'
import type { MockTransport } from './mock/mockTransport'
import { createToolClient } from './toolClient'
import type { ToolClient } from './toolClient'
import type { ToolTransport } from './transport'

/** HTTP 后端地址。未配置时回落到 mock。 */
const httpBaseUrl = import.meta.env.VITE_TOOL_BASE_URL

/** 全局共享的 mock transport，供调试面板调整失败注入。 */
export const mockTransport: MockTransport = createMockTransport({
  dataset: DEFAULT_MOCK_DATASET,
  failureRate: 0,
})

function resolveTransport(): ToolTransport {
  if (typeof httpBaseUrl === 'string' && httpBaseUrl.length > 0) {
    return createHttpTransport({ baseUrl: httpBaseUrl })
  }
  return mockTransport
}

/** 全局工具客户端。 */
export const toolClient: ToolClient = createToolClient(resolveTransport())

/** 当前实际生效的 transport 类型，用于界面提示。 */
export const activeTransportKind: 'mock' | 'http' = toolClient.transport.kind

export { createToolClient, createHttpTransport, createMockTransport, DEFAULT_MOCK_DATASET }
export type { ToolClient, MockTransport, ToolTransport }
