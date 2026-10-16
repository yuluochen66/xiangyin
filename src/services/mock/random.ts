/** 确定性伪随机数，保证 mock 数据在同一 seed 下可复现。 */

/**
 * mulberry32 PRNG。
 * @param seed 随机种子；同一 seed 下序列可复现
 * @returns 返回 0~1 随机数的函数
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 从数组中等概率取一个元素。空数组返回 undefined。
 * @param random 随机函数
 * @param items 候选集合
 * @returns 随机选中的一个元素；集合为空时返回 undefined
 */
export function pickOne<T>(random: () => number, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(random() * items.length)]
}

/**
 * 生成 [min, max] 内的随机整数。
 * @param random 随机函数
 * @param min 下界（含）
 * @param max 上界（含）
 * @returns 区间内的随机整数
 */
export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}
