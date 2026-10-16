/**
 * Transport 抽象层。
 *
 * 组件永远不直接调用工具；`ToolClient` → `ToolTransport` → 具体实现（mock / http）。
 * 后端就绪时只需替换 transport，上层 composable 与组件零改动。
 */
import type { ToolContract, ToolName } from '@/types/tools'

export interface InvokeOptions {
  /** 取消信号。取消后 reject 一个 code='cancelled' 的 ToolInvocationError。 */
  signal?: AbortSignal
  /** 单次调用超时（毫秒）。不传表示使用 transport 默认值。 */
  timeoutMs?: number
}

export interface ToolTransport {
  /** 实现标识，用于调试面板展示。 */
  readonly kind: 'mock' | 'http'
  /** 发起一次工具调用。失败时必须 reject，不得返回 undefined。 */
  invoke<K extends ToolName>(
    tool: K,
    input: ToolContract[K]['input'],
    options?: InvokeOptions,
  ): Promise<ToolContract[K]['output']>
}
