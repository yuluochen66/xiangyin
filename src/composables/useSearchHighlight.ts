/**
 * 流程 4 的检索结果文本高亮与定位文案。
 *
 * 唯一职责：把「命中词」与后端返回的 highlights 落到具体文本片段上，
 * 供结果列表渲染 mark；并把 locator 结构翻译成一行中文定位说明。
 * 本模块不持有任何检索条件或状态——词表由调用方以响应式引用传入。
 */
import type { Ref } from 'vue'

import type { SearchHit } from '@/types/api'

/** 高亮切分后的文本片段。 */
export interface HighlightPart {
  text: string
  hit: boolean
}

export interface UseSearchHighlightApi {
  /** 按命中词切分任意文本。 */
  highlightParts(text: string, terms: string[]): HighlightPart[]
  /** 切分一条命中的摘录（含后端 highlights）。 */
  excerptParts(hit: SearchHit): HighlightPart[]
  /** 把定位信息翻译成一行中文。 */
  locatorText(hit: SearchHit): string
}

/**
 * 按命中词把文本切成片段，供模板渲染 mark。
 * @param text 待高亮的原文
 * @param terms 检索关键词
 * @returns 按命中位置切分好的片段序列
 */
export function highlightParts(text: string, terms: string[]): HighlightPart[] {
  const valid = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length > 0))]
  if (valid.length === 0) return [{ text, hit: false }]

  const escaped = valid.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')

  const parts: HighlightPart[] = []
  let cursor = 0
  let match = pattern.exec(text)
  while (match !== null) {
    const index = match.index
    if (index > cursor) parts.push({ text: text.slice(cursor, index), hit: false })
    parts.push({ text: match[0], hit: true })
    cursor = index + match[0].length
    if (match[0].length === 0) pattern.lastIndex += 1
    match = pattern.exec(text)
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false })
  return parts.length > 0 ? parts : [{ text, hit: false }]
}

/**
 * 把定位结构翻译成一行中文说明。
 * @param hit 单条检索结果
 * @returns 定位说明文本
 */
export function locatorText(hit: SearchHit): string {
  const parts: string[] = []
  if (hit.locator.page !== undefined) parts.push(`第 ${hit.locator.page} 页`)
  if (hit.locator.line !== undefined) parts.push(`第 ${hit.locator.line} 行`)
  if (hit.locator.callNumber !== undefined) parts.push(`索书号 ${hit.locator.callNumber}`)
  if (parts.length > 0) return parts.join(' · ')
  return hit.locator.url !== undefined ? '在线资源' : '未标注定位'
}

/**
 * 创建「摘录高亮」计算器。
 * @param activeTerms 当前生效的检索词（关键词 + 未被忽略的扩展词）
 * @returns 与文本高亮相关的三个方法
 */
export function useSearchHighlight(activeTerms: Ref<string[]>): UseSearchHighlightApi {
  /**
   * 摘录高亮 = 关键词 / 扩展词 + 后端给出的 highlights。
   * @param hit 单条检索结果
   * @returns 摘要片段序列，命中词已切分
   */
  function excerptParts(hit: SearchHit): HighlightPart[] {
    return highlightParts(hit.excerpt, [...activeTerms.value, ...hit.highlights])
  }

  return { highlightParts, excerptParts, locatorText }
}
