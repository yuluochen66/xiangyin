/**
 * ToolClient：四个工具的类型化门面。
 *
 * 职责：
 * 1. 入参前置校验（省掉一次无效网络往返）；
 * 2. 计时；
 * 3. 把异常（含入参校验失败）收敛成 `ToolResult`，保证调用方永远不会因为工具失败而抛错中断。
 */
import type {
  BuildStoryCardInput,
  BuildStoryCardOutput,
  CompareClaimsInput,
  CompareClaimsOutput,
  RetrieveLocalSourcesInput,
  RetrieveLocalSourcesOutput,
  SubmitReviewInput,
  SubmitReviewOutput,
  ToolContract,
  ToolName,
  ToolResult,
} from '@/types/tools'

import { ToolInvocationError, normalizeToolError } from './errors'
import type { InvokeOptions, ToolTransport } from './transport'

export interface ToolClient {
  readonly transport: ToolTransport
  /** 通用调用入口，供未来新增工具时使用。 */
  invoke<K extends ToolName>(
    tool: K,
    input: ToolContract[K]['input'],
    options?: InvokeOptions,
  ): Promise<ToolResult<ToolContract[K]['output']>>

  retrieveLocalSources(
    input: RetrieveLocalSourcesInput,
    options?: InvokeOptions,
  ): Promise<ToolResult<RetrieveLocalSourcesOutput>>

  compareClaims(
    input: CompareClaimsInput,
    options?: InvokeOptions,
  ): Promise<ToolResult<CompareClaimsOutput>>

  buildStoryCard(
    input: BuildStoryCardInput,
    options?: InvokeOptions,
  ): Promise<ToolResult<BuildStoryCardOutput>>

  submitReview(
    input: SubmitReviewInput,
    options?: InvokeOptions,
  ): Promise<ToolResult<SubmitReviewOutput>>
}

/**
 * 入参校验失败时抛出的错误，携带字段说明。
 * @param tool 工具名，用于错误归属
 * @param message 面向开发者的错误说明
 * @param details 附加上下文，例如出错的字段名
 * @returns 已预置 tool 与 code=invalid_input 的 ToolInvocationError
 */
function invalidInput(
  tool: ToolName,
  message: string,
  details?: Record<string, unknown>,
): ToolInvocationError {
  return new ToolInvocationError({
    tool,
    code: 'invalid_input',
    message,
    retryable: false,
    ...(details ? { details } : {}),
  })
}

function requireNonEmptyString(tool: ToolName, value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidInput(tool, `参数 ${field} 不能为空。`, { field })
  }
  return value.trim()
}

function requireNonEmptyArray(tool: ToolName, value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidInput(tool, `参数 ${field} 至少需要一项。`, { field })
  }
  return value
}

/**
 * 创建工具客户端。
 * @param transport 工具调用的传输实现（mock 或 http）
 * @returns 四个工具的类型化门面
 */
export function createToolClient(transport: ToolTransport): ToolClient {
  async function invoke<K extends ToolName>(
    tool: K,
    input: ToolContract[K]['input'],
    options?: InvokeOptions,
  ): Promise<ToolResult<ToolContract[K]['output']>> {
    const started = performance.now()

    try {
      const data = await transport.invoke(tool, input, options)
      return { ok: true, data, tookMs: Math.round(performance.now() - started) }
    } catch (error) {
      return {
        ok: false,
        error: normalizeToolError(tool, error),
        tookMs: Math.round(performance.now() - started),
      }
    }
  }

  /**
   * 把「入参前置校验失败」这类同步异常也收敛成 ToolResult。
   * 契约要求调用方永远不必 try/catch，因此校验错误必须是 ok:false 而不是抛出。
   * @param tool 工具名，用于错误归属
   * @param run 实际调用；其同步异常也会被收敛
   * @returns 永远返回 ToolResult，不向调用方抛错
   */
  async function guarded<T>(
    tool: ToolName,
    run: () => Promise<ToolResult<T>>,
  ): Promise<ToolResult<T>> {
    try {
      return await run()
    } catch (error) {
      return { ok: false, error: normalizeToolError(tool, error), tookMs: 0 }
    }
  }

  return {
    transport,
    invoke,

    retrieveLocalSources(input, options) {
      return guarded('retrieve_local_sources', () => {
        const query = requireNonEmptyString('retrieve_local_sources', input.query, 'query')
        const limit = input.limit ?? 10
        if (!Number.isInteger(limit) || limit <= 0) {
          throw invalidInput('retrieve_local_sources', '参数 limit 必须是正整数。', {
            field: 'limit',
          })
        }
        return invoke('retrieve_local_sources', { ...input, query, limit }, options)
      })
    },

    compareClaims(input, options) {
      return guarded('compare_claims', () => {
        const claimIds = requireNonEmptyArray(
          'compare_claims',
          input.claimIds,
          'claimIds',
        ) as string[]
        return invoke('compare_claims', { ...input, claimIds }, options)
      })
    },

    buildStoryCard(input, options) {
      return guarded('build_story_card', () => {
        const title = requireNonEmptyString('build_story_card', input.title, 'title')
        const claimIds = requireNonEmptyArray(
          'build_story_card',
          input.claimIds,
          'claimIds',
        ) as string[]
        return invoke('build_story_card', { ...input, title, claimIds }, options)
      })
    },

    submitReview(input, options) {
      return guarded('submit_review', () => {
        requireNonEmptyString('submit_review', input.reviewer, 'reviewer')
        const decisions = requireNonEmptyArray('submit_review', input.decisions, 'decisions')
        return invoke(
          'submit_review',
          { ...input, decisions: decisions as SubmitReviewInput['decisions'] },
          options,
        )
      })
    },
  }
}
