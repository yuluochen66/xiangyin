/**
 * 轻量文本差异计算（零依赖）。
 *
 * 场景：审校对照视图需要「原文 vs 修订稿」的逐词差异。
 * 中文没有空格分词，因此分词器把每个汉字视为一个 token，拉丁词与数字整体保留。
 *
 * 复杂度：先剥离公共前后缀，再对中段做 LCS 动态规划。中段 token 数超过
 * `MAX_LCS_TOKENS` 时退化为「整段替换」，避免长文本拖垮主线程。
 */

export type DiffOp = 'equal' | 'insert' | 'delete'

/** 差异 token。`delete` 只出现在左侧，`insert` 只出现在右侧。 */
export interface DiffToken {
  text: string
  op: DiffOp
}

/** 对照块：`equal` 块两侧一致；`change` 块需要并排展示并高亮。 */
export interface DiffBlock {
  id: string
  type: 'equal' | 'change'
  /** 左侧（原文）token 序列，仅含 equal / delete。 */
  left: DiffToken[]
  /** 右侧（修订稿）token 序列，仅含 equal / insert。 */
  right: DiffToken[]
}

export interface DiffStats {
  /** 新增字符数。 */
  insertedChars: number
  /** 删除字符数。 */
  deletedChars: number
  /** change 块数量。 */
  changeBlocks: number
  /** 相似度 0~1，= 1 - (增删字符数 / 两侧总字符数)。 */
  similarity: number
}

export interface DiffResult {
  blocks: DiffBlock[]
  stats: DiffStats
}

/** LCS 保护的 token 上限。 */
const MAX_LCS_TOKENS = 1500

const TOKEN_PATTERN =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]|[A-Za-z0-9]+(?:[.'’-][A-Za-z0-9]+)*|\s+|[^\s]/g

/**
 * 把文本切分为 token 序列。
 * @param text 待切分的文本
 * @returns 按「CJK 字符 / 单词 / 空白 / 标点」切分出的 token 序列
 */
export function tokenize(text: string): string[] {
  return text.match(TOKEN_PATTERN) ?? []
}

/**
 * 判断 token 是否为纯空白。
 * @param token 待判断的 token
 * @returns 是否为纯空白 token（比对时需忽略）
 */
function isWhitespace(token: string): boolean {
  return token.trim().length === 0
}

/**
 * LCS 回溯，返回左右两侧的逐 token 操作序列。
 * @param left 左侧文本的 token 序列
 * @param right 右侧文本的 token 序列
 * @returns equal / delete / insert 三类 token 组成的差异序列
 */
function lcsDiff(left: string[], right: string[]): DiffToken[] {
  const n = left.length
  const m = right.length

  if (n === 0 && m === 0) return []
  if (n === 0) return right.map<DiffToken>((text) => ({ text, op: 'insert' }))
  if (m === 0) return left.map<DiffToken>((text) => ({ text, op: 'delete' }))

  if (n * m > MAX_LCS_TOKENS * MAX_LCS_TOKENS) {
    return [
      ...left.map<DiffToken>((text) => ({ text, op: 'delete' })),
      ...right.map<DiffToken>((text) => ({ text, op: 'insert' })),
    ]
  }

  // dp[i][j] = left[i..] 与 right[j..] 的 LCS 长度
  const width = m + 1
  const dp = new Uint32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        left[i] === right[j]
          ? dp[(i + 1) * width + (j + 1)] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + (j + 1)])
    }
  }

  const tokens: DiffToken[] = []
  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (left[i] === right[j]) {
      tokens.push({ text: left[i], op: 'equal' })
      i += 1
      j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      tokens.push({ text: left[i], op: 'delete' })
      i += 1
    } else {
      tokens.push({ text: right[j], op: 'insert' })
      j += 1
    }
  }

  while (i < n) {
    tokens.push({ text: left[i], op: 'delete' })
    i += 1
  }
  while (j < m) {
    tokens.push({ text: right[j], op: 'insert' })
    j += 1
  }

  return tokens
}

/**
 * 计算两侧文本的差异并按块分组，供左右对照视图直接渲染。
 *
 * @param original 原文
 * @param revised 修订稿
 * @returns 差异块与统计信息，供对照视图直接渲染
 */
export function compareText(original: string, revised: string): DiffResult {
  if (original === revised) {
    return {
      blocks:
        original.length === 0
          ? []
          : [
              {
                id: 'block-0',
                type: 'equal',
                left: [{ text: original, op: 'equal' }],
                right: [{ text: revised, op: 'equal' }],
              },
            ],
      stats: { insertedChars: 0, deletedChars: 0, changeBlocks: 0, similarity: 1 },
    }
  }

  const leftTokens = tokenize(original)
  const rightTokens = tokenize(revised)

  // 剥离公共前后缀，缩短 DP 规模
  let prefix = 0
  while (
    prefix < leftTokens.length &&
    prefix < rightTokens.length &&
    leftTokens[prefix] === rightTokens[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < leftTokens.length - prefix &&
    suffix < rightTokens.length - prefix &&
    leftTokens[leftTokens.length - 1 - suffix] === rightTokens[rightTokens.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const head = leftTokens.slice(0, prefix)
  const middleLeft = leftTokens.slice(prefix, leftTokens.length - suffix)
  const middleRight = rightTokens.slice(prefix, rightTokens.length - suffix)
  const tail = leftTokens.slice(leftTokens.length - suffix)

  const ops: DiffToken[] = [
    ...head.map<DiffToken>((text) => ({ text, op: 'equal' })),
    ...lcsDiff(middleLeft, middleRight),
    ...tail.map<DiffToken>((text) => ({ text, op: 'equal' })),
  ]

  // 按 equal / change 分组
  const blocks: DiffBlock[] = []
  let cursor = 0
  let insertedChars = 0
  let deletedChars = 0
  let changeBlocks = 0

  const flushEqual = (items: DiffToken[]): void => {
    if (items.length === 0) return
    const payload = items.map((token) => token.text).join('')
    if (payload.length === 0) return
    blocks.push({
      id: `block-${blocks.length}`,
      type: 'equal',
      left: [{ text: payload, op: 'equal' }],
      right: [{ text: payload, op: 'equal' }],
    })
  }

  while (cursor < ops.length) {
    if (ops[cursor].op === 'equal') {
      const start = cursor
      while (cursor < ops.length && ops[cursor].op === 'equal') cursor += 1
      flushEqual(ops.slice(start, cursor))
      continue
    }

    // 收集一段连续的增删，合并为一个 change 块
    const start = cursor
    while (cursor < ops.length && ops[cursor].op !== 'equal') cursor += 1
    const chunk = ops.slice(start, cursor)

    const left: DiffToken[] = []
    const right: DiffToken[] = []

    for (const token of chunk) {
      if (token.op === 'delete') {
        left.push(token)
        if (!isWhitespace(token.text)) deletedChars += token.text.length
      } else {
        right.push(token)
        if (!isWhitespace(token.text)) insertedChars += token.text.length
      }
    }

    // 两侧都退化为空白时无需高亮，直接并入 equal
    if (
      left.every((token) => isWhitespace(token.text)) &&
      right.every((token) => isWhitespace(token.text))
    ) {
      flushEqual([
        ...left.map((t) => ({ ...t, op: 'equal' as DiffOp })),
        ...right.map((t) => ({ ...t, op: 'equal' as DiffOp })),
      ])
      continue
    }

    changeBlocks += 1
    blocks.push({ id: `block-${blocks.length}`, type: 'change', left, right })
  }

  const originalChars = original.replace(/\s+/g, '').length
  const revisedChars = revised.replace(/\s+/g, '').length
  const denominator = Math.max(originalChars, revisedChars, 1)
  const similarity = Math.max(
    0,
    Math.min(1, 1 - (insertedChars + deletedChars) / (denominator * 2)),
  )

  return {
    blocks,
    stats: { insertedChars, deletedChars, changeBlocks, similarity },
  }
}
