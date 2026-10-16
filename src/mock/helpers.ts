/**
 * mock 实现的公共工具。
 *
 * 统一处理「空数据 / 需人工确认 / 慢响应」三类场景开关，
 * 避免每个接口各写一遍分支。
 */
import type { MockContext, MockScenario, PageResult } from '@/services/api/types'

/**
 * 当前是否要求返回空数据。
 * @param ctx 调用上下文，含当前 Mock 场景与尝试次数
 * @returns 当前场景是否要求返回空数据
 */
export function isEmptyScenario(ctx: MockContext): boolean {
  return ctx.scenario === 'empty'
}

/**
 * 当前是否要求把结果标记为「需人工确认」。
 * @param ctx 调用上下文，含当前 Mock 场景与尝试次数
 * @returns 当前场景是否要求把结果标记为「需人工确认」
 */
export function isConfirmScenario(ctx: MockContext): boolean {
  return ctx.scenario === 'needsConfirm'
}

/**
 * 统一延迟（已由 request 层在外层等待，这里仅用于需要额外等待的接口）。
 * @param ctx 调用上下文，含当前 Mock 场景与尝试次数
 * @returns 当前生效的 Mock 场景
 */
export function scenarioOf(ctx: MockContext): MockScenario {
  return ctx.scenario
}

/**
 * 构造空分页结果。
 * @param page 页码，从 1 开始
 * @param pageSize 每页条数
 * @returns 空的分页结果，字段与真实响应保持一致
 */
export function emptyPage<T>(page = 1, pageSize = 10): PageResult<T> {
  return { list: [], total: 0, page, pageSize, hasMore: false }
}

/** 生成带前缀的递增 id。 */
let seq = 0
export function mockId(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${seq}`
}

/**
 * 当前 ISO 时间。
 * @returns 当前时间的 ISO 8601 字符串
 */
export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 简单文本相似度（基于字符二元组），用于同义项候选推荐。
 * @param a 比较串 A
 * @param b 比较串 B
 * @returns 0~1 的相似度，1 表示完全相同
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0
  const grams = (text: string): string[] => {
    const result: string[] = []
    for (let i = 0; i < text.length - 1; i += 1) result.push(text.slice(i, i + 2))
    return result
  }
  const ga = grams(a)
  const gb = new Set(grams(b))
  const hit = ga.filter((g) => gb.has(g)).length
  return Number(((2 * hit) / (ga.length + gb.size)).toFixed(3))
}
