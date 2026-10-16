/**
 * Mock 场景开关（全局单例）。
 *
 * 用途：在没有后端的情况下，验证每个流程的 7 种界面状态。
 * 顶栏的「Mock 场景」下拉直接读写这里的 `mockScenario`，
 * 所有接口的 mock 实现都通过 `request` 收到 `MockContext.scenario`。
 */
import { computed, ref } from 'vue'

import { env } from '@/config/env'
import type { MockScenario } from '@/services/api/types'

/** 当前场景。 */
export const mockScenario = ref<MockScenario>('normal')

/** 模拟延迟倍数，用于「加载中」场景。 */
export const mockLatencyOverride = ref<number | null>(null)

/** 随机失败率，可在调试面板调整。 */
export const mockFailureRate = ref<number>(env.mockFailureRate)

/**
 * 同一接口连续调用计数。
 * 用于「失败」场景：第 1 次失败、用户点重试后第 2 次成功，
 * 这样「失败 → 重试中 → 成功」的完整链路可以被真实走通。
 */
const attemptCounter = new Map<string, number>()

/**
 * 记录一次调用并返回当前是第几次（从 1 开始）。
 * @param key 接口标识，通常为「请求方法 + 路径」
 * @returns 该接口是第几次被调用，从 1 开始
 */
export function nextAttempt(key: string): number {
  const next = (attemptCounter.get(key) ?? 0) + 1
  attemptCounter.set(key, next)
  return next
}

/** 清空计数。切换场景时调用，保证每次切换都从「第一次」开始。 */
export function resetAttempts(): void {
  attemptCounter.clear()
}

/**
 * 切换场景（并重置计数）。
 * @param scenario 要切换到的场景；切换后会重置调用计数
 */
export function setMockScenario(scenario: MockScenario): void {
  mockScenario.value = scenario
  resetAttempts()
}

/** 当前生效的延迟（毫秒）。 */
export const currentLatency = computed(() => {
  const base = mockLatencyOverride.value ?? env.mockLatencyMs
  return mockScenario.value === 'slow' ? base * 5 : base
})

/**
 * 可取消的 sleep。
 * @param ms 等待时长（毫秒）
 * @param signal 可选的取消信号，触发后立即 reject
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('请求已取消', 'AbortError'))
      return
    }
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('请求已取消', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
