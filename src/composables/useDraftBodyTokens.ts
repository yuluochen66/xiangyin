/**
 * 流程 6 的正文档分片解析。
 *
 * 唯一职责：把区块正文按 [n] 角标切成「文本 + 角标」序列，供结果区逐片渲染成可点击的
 * 上标；不持有草稿的其他状态，也不发起接口调用。
 */
import { computed } from 'vue'
import type { Ref } from 'vue'

import type { DraftBlock } from '@/types/api'

/** 正文分片：普通文本或引用角标。 */
export interface BodyToken {
  type: 'text' | 'cite'
  text: string
  /** cite 时为角标序号，text 时为 -1。 */
  index: number
}

/**
 * 创建正文档分片解析。
 * @param editableBlocks 待解析的草稿区块
 * @returns 以区块 id 为键的分片映射
 */
export function useDraftBodyTokens(editableBlocks: Ref<DraftBlock[]>) {
  // 把单段正文切成「文本 + 角标」序列，cite 分片带角标序号。
  function parseBody(body: string): BodyToken[] {
    const tokens: BodyToken[] = []
    const pattern = /\[(\d+)\]/g
    let cursor = 0
    let match: RegExpExecArray | null = pattern.exec(body)
    while (match !== null) {
      if (match.index > cursor) {
        tokens.push({ type: 'text', text: body.slice(cursor, match.index), index: -1 })
      }
      tokens.push({ type: 'cite', text: match[0], index: Number(match[1]) })
      cursor = match.index + match[0].length
      match = pattern.exec(body)
    }
    if (cursor < body.length) {
      tokens.push({ type: 'text', text: body.slice(cursor), index: -1 })
    }
    return tokens
  }

  const bodyTokens = computed<Record<string, BodyToken[]>>(() => {
    const map: Record<string, BodyToken[]> = {}
    for (const block of editableBlocks.value) {
      map[block.id] = parseBody(block.body)
    }
    return map
  })

  return { bodyTokens }
}
