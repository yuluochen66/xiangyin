/**
 * Mock transport：本地假数据实现，用于在后端就绪前驱动全部交互。
 *
 * 特性：
 * - 确定性：同一 seed 下结果可复现（mulberry32）；
 * - 真实感：带随机网络延迟，走真实的异步/取消路径；
 * - 可注入失败：`failureRate > 0` 时按概率抛出 server 错误，用于验证错误态 UI。
 */
import { DEMO_CLAIMS, DEMO_REVIEW_UNITS, DEMO_SOURCES, DEMO_TRANSCRIPT } from '@/data/demoProject'
import type {
  Claim,
  ClaimAssessment,
  ClaimVerdict,
  ReviewUnit,
  SourceTag,
  StoryCard,
  StoryTimelineEntry,
  Transcript,
} from '@/types'
import type {
  BuildStoryCardOutput,
  CompareClaimsOutput,
  RetrieveLocalSourcesOutput,
  RetrievedSource,
  SubmitReviewOutput,
  ToolContract,
  ToolName,
} from '@/types/tools'

import { ToolInvocationError } from '../errors'
import type { InvokeOptions, ToolTransport } from '../transport'
import { createRandom, randomInt } from './random'

/** mock 所依赖的数据集合。默认使用演示数据集，测试时可整体替换。 */
export interface MockDataset {
  sources: SourceTag[]
  claims: Claim[]
  transcript: Transcript
  reviewUnits: ReviewUnit[]
}

export interface MockTransportOptions {
  dataset?: MockDataset
  /** 延迟区间（毫秒），默认 [220, 680]。 */
  latencyMs?: [number, number]
  /** 随机种子。 */
  seed?: number
  /** 失败注入概率 0~1，默认 0。 */
  failureRate?: number
}

export interface MockTransport extends ToolTransport {
  /** 可变：调试面板可在运行时切换失败注入。 */
  failureRate: number
  /** 已处理的调用次数。 */
  readonly callCount: number
}

export const DEFAULT_MOCK_DATASET: MockDataset = {
  sources: DEMO_SOURCES,
  claims: DEMO_CLAIMS,
  transcript: DEMO_TRANSCRIPT,
  reviewUnits: DEMO_REVIEW_UNITS,
}

/** 预置的论断核查结论，模拟后端已有的人工核查结果。 */
const KNOWN_ASSESSMENTS: Record<string, Omit<ClaimAssessment, 'claimId'>> = {
  'C-01': {
    verdict: 'supported',
    confidence: 0.88,
    rationale:
      '工序描述与国家级非遗名录记载一致，福州漆器行业语料亦印证「推光」「脱胎」的固定用法。',
    supportingSourceIds: ['SRC-01', 'SRC-03', 'SRC-05'],
    contradictingSourceIds: [],
  },
  'C-02': {
    verdict: 'contradicted',
    confidence: 0.79,
    rationale:
      '「闽王建塔得名」仅见于《闽都别记》这类民间传闻辑录，原书自注「与正史所载颇有出入」；坊巷手工业普查亦未采信该说法。把它写成结论属于传说被当作史实。',
    supportingSourceIds: [],
    contradictingSourceIds: ['SRC-06', 'SRC-07'],
  },
  'C-03': {
    verdict: 'partial',
    confidence: 0.72,
    rationale:
      '讲述人口述为「窨七八次」，而官方口径为「三至七窨」；草稿把上限抬高到十次，属个人记忆被放大后写入结论。',
    supportingSourceIds: ['SRC-01'],
    contradictingSourceIds: ['SRC-06'],
  },
  'C-04': {
    verdict: 'supported',
    confidence: 0.9,
    rationale: '与《三坊七巷手工业普查》所载「前店后坊」格局表述一致。',
    supportingSourceIds: ['SRC-06'],
    contradictingSourceIds: [],
  },
  'C-05': {
    verdict: 'unverified',
    confidence: 0.41,
    rationale:
      '宗谱记「民国间自设铺号『聚漆斋』于塔巷口」，地点与草稿「南后街」不符，且未记入行年份，证据不足以支撑该结论。',
    supportingSourceIds: [],
    contradictingSourceIds: ['SRC-04'],
  },
}

/**
 * 可等待的延迟，支持 AbortSignal 取消。
 * @param ms 模拟的网络延迟（毫秒）
 * @param signal 可选的取消信号
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('调用已取消', 'AbortError'))
      return
    }

    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new DOMException('调用已取消', 'AbortError'))
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 把检索词切分为关键词。
 * @param query 检索词原文，支持空格与中英文逗号、顿号、分号分隔
 * @returns 去空后得到的关键词数组
 */
function toTerms(query: string): string[] {
  return query
    .split(/[\s,，、;；]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
}

/**
 * 计算单个来源与关键词的匹配度。
 * @param source 待打分的来源
 * @param terms 检索关键词
 * @returns 相关度得分（0~1）与命中的关键词列表
 */
function scoreSource(
  source: SourceTag,
  terms: string[],
): { score: number; matchedTerms: string[] } {
  const matchedTerms: string[] = []
  let score = 0

  for (const term of terms) {
    const lower = term.toLowerCase()
    if (source.id.toLowerCase() === lower) {
      score = Math.max(score, 1)
      matchedTerms.push(term)
      continue
    }
    if (source.label.toLowerCase().includes(lower)) {
      score = Math.max(score, 0.9)
      matchedTerms.push(term)
      continue
    }
    if (source.publisher.toLowerCase().includes(lower)) {
      score = Math.max(score, 0.6)
      matchedTerms.push(term)
      continue
    }
    if (source.excerpt.toLowerCase().includes(lower)) {
      score = Math.max(score, 0.7)
      matchedTerms.push(term)
    }
  }

  // 用可信度做轻微加权，避免同分时低可信来源排在前列
  return { score: score * (0.85 + source.confidence * 0.15), matchedTerms }
}

/**
 * 创建 mock transport。
 * @param options 数据集、延迟区间、随机种子与失败注入设置
 * @returns mock 版工具传输实现
 */
export function createMockTransport(options: MockTransportOptions = {}): MockTransport {
  const dataset = options.dataset ?? DEFAULT_MOCK_DATASET
  const [minLatency, maxLatency] = options.latencyMs ?? [220, 680]
  const random = createRandom(options.seed ?? 20260318)

  let failureRate = options.failureRate ?? 0
  let callCount = 0

  const sourceById = new Map(dataset.sources.map((source) => [source.id, source]))
  const claimById = new Map(dataset.claims.map((claim) => [claim.id, claim]))

  async function simulate(options?: InvokeOptions): Promise<void> {
    await delay(randomInt(random, minLatency, maxLatency), options?.signal)
    if (failureRate > 0 && random() < failureRate) {
      throw new ToolInvocationError({
        tool: 'unknown',
        code: 'server',
        message: '工具服务暂时不可用（模拟故障，可在调试面板关闭）。',
        details: { simulated: true },
      })
    }
  }

  async function retrieveLocalSources(
    input: ToolContract['retrieve_local_sources']['input'],
    invokeOptions?: InvokeOptions,
  ): Promise<RetrieveLocalSourcesOutput> {
    const started = performance.now()
    await simulate(invokeOptions)

    const terms = toTerms(input.query)
    const limit = input.limit ?? 10
    const minConfidence = input.minConfidence ?? 0
    const kinds = input.kinds && input.kinds.length > 0 ? new Set(input.kinds) : null

    const items: RetrievedSource[] = []

    for (const source of dataset.sources) {
      if (kinds && !kinds.has(source.kind)) continue
      if (source.confidence < minConfidence) continue
      const { score, matchedTerms } = scoreSource(source, terms)
      if (score <= 0) continue
      items.push({ source, score: Number(score.toFixed(3)), matchedTerms })
    }

    items.sort((a, b) => b.score - a.score || b.source.confidence - a.source.confidence)

    return {
      query: input.query,
      total: items.length,
      items: items.slice(0, limit),
      tookMs: Math.round(performance.now() - started),
    }
  }

  async function compareClaims(
    input: ToolContract['compare_claims']['input'],
    invokeOptions?: InvokeOptions,
  ): Promise<CompareClaimsOutput> {
    const started = performance.now()
    await simulate(invokeOptions)

    const summary: Record<ClaimVerdict, number> = {
      supported: 0,
      partial: 0,
      contradicted: 0,
      unverified: 0,
    }
    const assessments: ClaimAssessment[] = []

    for (const claimId of input.claimIds) {
      const known = KNOWN_ASSESSMENTS[claimId]
      const claim = claimById.get(claimId) ?? input.claims?.find((item) => item.id === claimId)

      if (!known || !claim) {
        assessments.push({
          claimId,
          verdict: 'unverified',
          confidence: 0.2,
          rationale: '本地来源库中未检索到与该论断直接对应的证据。',
          supportingSourceIds: [],
          contradictingSourceIds: [],
        })
        summary.unverified += 1
        continue
      }

      const verdict: ClaimVerdict =
        input.strictMode && known.confidence < 0.6 ? 'unverified' : known.verdict
      assessments.push({ claimId, ...known, verdict })
      summary[verdict] += 1
    }

    if (assessments.length === 0) {
      throw new ToolInvocationError({
        tool: 'compare_claims',
        code: 'not_found',
        message: '没有可核查的论断。',
      })
    }

    return { assessments, summary, tookMs: Math.round(performance.now() - started) }
  }

  async function buildStoryCard(
    input: ToolContract['build_story_card']['input'],
    invokeOptions?: InvokeOptions,
  ): Promise<BuildStoryCardOutput> {
    const started = performance.now()
    await simulate(invokeOptions)

    const selected = input.claimIds
      .map((claimId) => claimById.get(claimId))
      .filter((claim): claim is Claim => claim !== undefined)

    if (selected.length === 0) {
      throw new ToolInvocationError({
        tool: 'build_story_card',
        code: 'not_found',
        message: '所选论断不存在，无法生成故事卡。',
      })
    }

    const omittedClaimIds: string[] = []
    const keyClaimIds: string[] = []
    const sourceIds = new Set<string>()

    for (const claim of selected) {
      const assessment = KNOWN_ASSESSMENTS[claim.id]
      if (
        !assessment ||
        assessment.verdict === 'unverified' ||
        assessment.verdict === 'contradicted'
      ) {
        omittedClaimIds.push(claim.id)
        continue
      }
      keyClaimIds.push(claim.id)
      for (const sourceId of claim.sourceIds) {
        if (sourceById.has(sourceId)) sourceIds.add(sourceId)
      }
    }

    const timeline: StoryTimelineEntry[] = selected
      .map((claim) => {
        const source = claim.sourceIds
          .map((id) => sourceById.get(id))
          .find((item) => item !== undefined)
        return {
          id: `TL-${claim.id}`,
          at: source?.publishedAt ?? new Date().toISOString(),
          title: claim.text,
          detail: source ? `依据：${source.label}（${source.publisher}）` : '暂无来源标注',
        }
      })
      .sort((a, b) => a.at.localeCompare(b.at))

    const contradicted = selected.some(
      (claim) => KNOWN_ASSESSMENTS[claim.id]?.verdict === 'contradicted',
    )
    const unverified = omittedClaimIds.length > 0

    const card: StoryCard = {
      id: `CARD-${Date.now().toString(36).toUpperCase()}`,
      headline: input.title,
      summary:
        `本卡由 ${selected.length} 条论断聚合，其中 ${keyClaimIds.length} 条证据充分可发布，` +
        `${omittedClaimIds.length} 条因证据不足或与来源冲突被排除。`,
      timeline,
      keyClaimIds,
      sourceIds: [...sourceIds].sort(),
      riskLevel: contradicted ? 'high' : unverified ? 'medium' : 'low',
      generatedAt: new Date().toISOString(),
    }

    // 让 mock 的耗时统计覆盖生成过程本身
    void started
    return { card, omittedClaimIds }
  }

  async function submitReview(
    input: ToolContract['submit_review']['input'],
    invokeOptions?: InvokeOptions,
  ): Promise<SubmitReviewOutput> {
    await simulate(invokeOptions)

    const knownUnits = new Set(dataset.reviewUnits.map((unit) => unit.id))
    const unknown = input.decisions.filter((decision) => !knownUnits.has(decision.unitId))

    if (unknown.length > 0) {
      throw new ToolInvocationError({
        tool: 'submit_review',
        code: 'invalid_input',
        message: `以下审校单元不存在：${unknown.map((item) => item.unitId).join('、')}`,
        details: { unitIds: unknown.map((item) => item.unitId) },
      })
    }

    let accepted = 0
    let rejected = 0
    let flagged = 0

    for (const decision of input.decisions) {
      if (decision.status === 'accepted') accepted += 1
      else if (decision.status === 'rejected') rejected += 1
      else flagged += 1
    }

    return {
      receiptId: `RCPT-${Date.now().toString(36).toUpperCase()}`,
      reviewId: input.reviewId,
      submittedAt: new Date().toISOString(),
      accepted,
      rejected,
      flagged,
      status: 'committed',
    }
  }

  return {
    kind: 'mock',

    get failureRate(): number {
      return failureRate
    },
    set failureRate(value: number) {
      failureRate = Math.max(0, Math.min(1, value))
    },

    get callCount(): number {
      return callCount
    },

    async invoke<K extends ToolName>(
      tool: K,
      input: ToolContract[K]['input'],
      invokeOptions?: InvokeOptions,
    ): Promise<ToolContract[K]['output']> {
      callCount += 1

      switch (tool) {
        case 'retrieve_local_sources':
          return (await retrieveLocalSources(
            input as ToolContract['retrieve_local_sources']['input'],
            invokeOptions,
          )) as ToolContract[K]['output']
        case 'compare_claims':
          return (await compareClaims(
            input as ToolContract['compare_claims']['input'],
            invokeOptions,
          )) as ToolContract[K]['output']
        case 'build_story_card':
          return (await buildStoryCard(
            input as ToolContract['build_story_card']['input'],
            invokeOptions,
          )) as ToolContract[K]['output']
        case 'submit_review':
          return (await submitReview(
            input as ToolContract['submit_review']['input'],
            invokeOptions,
          )) as ToolContract[K]['output']
        default: {
          const exhaustive: never = tool
          throw new ToolInvocationError({
            tool: 'unknown',
            code: 'invalid_input',
            message: `未实现的工具：${String(exhaustive)}`,
          })
        }
      }
    },
  }
}
