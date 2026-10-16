/**
 * 流程 4：检索地方资料 —— 接口调用层。
 */
import { request } from '@/services/api'
import type { ApiResponse } from '@/services/api/httpClient'
import { isEmptyScenario, nowIso } from '@/mock/helpers'
import { mockStore } from '@/mock/store'
import type {
  CredibilityLevel,
  ExpandedKeyword,
  GetSourceDetailResponse,
  RelatedLead,
  SearchFacet,
  SearchHit,
  SearchSourcesRequest,
  SearchSourcesResponse,
  SourceType,
} from '@/types/api'

/** 关联线索文案表（真实环境由后端根据知识图谱生成）。 */
const LEAD_DEFS: Record<string, Omit<RelatedLead, 'id'>> = {
  'LEAD-001': {
    title: '脱胎漆器髹饰技艺',
    kind: 'entity',
    hint: '该技艺于 2006 年列入国家级非遗名录，可继续检索其传承谱系。',
    confidence: 0.9,
  },
  'LEAD-002': {
    title: '塔巷地名沿革',
    kind: 'event',
    hint: '《三坊七巷志》对塔巷得名有多种说法，建议与《榕城考古略》对照。',
    confidence: 0.82,
  },
  'LEAD-003': {
    title: '闽王建塔传说的流变',
    kind: 'event',
    hint: '该传说在《闽都别记》与民国报刊中版本不同，属于典型的「传说被写作史实」风险点。',
    confidence: 0.6,
  },
  'LEAD-004': {
    title: '国家级非遗代表性项目名录',
    kind: 'source',
    hint: '可作为权威出处直接引用，可信度分级为「高」。',
    confidence: 0.95,
  },
  'LEAD-005': {
    title: '1958 年前后福州漆器业变迁',
    kind: 'event',
    hint: '可检索同期《福建日报》与工商档案，交叉验证建厂时间。',
    confidence: 0.85,
  },
  'LEAD-006': {
    title: '南后街「前店后坊」空间格局',
    kind: 'event',
    hint: '与本次口述中「一条街会行半日」的描述可相互印证。',
    confidence: 0.78,
  },
  'LEAD-007': {
    title: '茉莉花茶窨制次数差异',
    kind: 'event',
    hint: '口述称「七八次」，官方资料称「三至七窨」，存在需要标注的差异。',
    confidence: 0.72,
  },
  'LEAD-008': {
    title: '林氏宗谱中的林依妹',
    kind: 'entity',
    hint: '宗谱记载与口述在铺号年代与地点上略有出入，建议人工核对是否同一人。',
    confidence: 0.65,
  },
  'LEAD-009': {
    title: '水榭戏台与闽剧演出史',
    kind: 'event',
    hint: '可继续检索闽剧院档案，补充演出剧目与年代。',
    confidence: 0.8,
  },
}

/** AI 检索词扩展表（mock）。 */
const EXPANSION_RULES: Array<{
  match: string
  expansions: Array<{ term: string; reason: string; weight: number }>
}> = [
  {
    match: '漆器',
    expansions: [
      { term: '脱胎漆器', reason: '「漆器」在福州语境中通常特指脱胎漆器。', weight: 0.95 },
      { term: '髹饰技艺', reason: '非遗名录中的正式项目名称。', weight: 0.8 },
      { term: '推光', reason: '脱胎漆器的关键工序，可用于定位工艺细节。', weight: 0.6 },
    ],
  },
  {
    match: '三坊巷',
    expansions: [
      { term: '三坊七巷', reason: '「三坊巷」疑为「三坊七巷」的漏字写法。', weight: 0.98 },
    ],
  },
  {
    match: '塔巷',
    expansions: [
      { term: '修文巷', reason: '塔巷旧名修文巷，可扩大检索命中范围。', weight: 0.85 },
      { term: '王审知', reason: '塔巷得名传说与闽王相关。', weight: 0.7 },
    ],
  },
  {
    match: '茉莉花茶',
    expansions: [
      { term: '窨制', reason: '茉莉花茶工艺的专业术语。', weight: 0.9 },
      { term: '花茶窨次', reason: '用于核对口述中的窨制次数。', weight: 0.65 },
    ],
  },
  {
    match: '闽剧',
    expansions: [{ term: '水榭戏台', reason: '本次口述中闽剧演出的具体场所。', weight: 0.75 }],
  },
  {
    match: '南后街',
    expansions: [
      { term: '前店后坊', reason: '描述南后街手工业空间格局的学术用语。', weight: 0.8 },
      { term: '油纸伞', reason: '南后街传统手工艺之一。', weight: 0.6 },
    ],
  },
]

const CREDIBILITY_ORDER: Record<CredibilityLevel, number> = {
  high: 4,
  medium: 3,
  low: 2,
  unverified: 1,
}

/**
 * 依据关键词计算命中与相关度。
 * @param hit 待打分的资料来源
 * @param terms 检索关键词
 * @param expand 是否启用 AI 扩展词；扩展命中只加权，不改判定
 * @returns 相关度得分与命中方式
 */
function scoreHit(
  hit: SearchHit,
  terms: string[],
  expand: boolean,
): { score: number; highlights: string[] } {
  const highlights: string[] = []
  let score = 0

  for (const term of terms) {
    const needle = term.trim().toLowerCase()
    if (needle.length === 0) continue

    if (hit.title.toLowerCase().includes(needle)) {
      score += 0.5
      highlights.push(hit.title)
    }
    if (hit.publisher.toLowerCase().includes(needle)) score += 0.15
    if (hit.excerpt.toLowerCase().includes(needle)) {
      score += 0.4
      const index = hit.excerpt.toLowerCase().indexOf(needle)
      highlights.push(hit.excerpt.slice(Math.max(0, index - 12), index + needle.length + 18))
    }
    for (const keyword of hit.highlights) {
      if (keyword.toLowerCase().includes(needle) || needle.includes(keyword.toLowerCase())) {
        score += 0.25
        highlights.push(keyword)
      }
    }
  }

  // AI 相关度重排：可信度加权 + 来源类型偏好
  if (expand && score > 0) {
    score *= 0.8 + hit.credibilityScore * 0.3
    if (hit.sourceType === 'gazetteer' || hit.sourceType === 'heritage_list') score *= 1.08
  }

  return { score: Number(Math.min(1, score).toFixed(3)), highlights: [...new Set(highlights)] }
}

export const searchApi = {
  /**
   * 组合检索地方资料。
   * POST /sources/search
   * TODO-SEARCH-1 待确认：多关键词是 AND 还是 OR 语义；分页字段命名。
   * @param body 检索请求体：关键词、来源类型与筛选条件
   * @returns 检索结果：命中列表与检索条件回显
   */
  search(body: SearchSourcesRequest): Promise<ApiResponse<SearchSourcesResponse>> {
    return request<SearchSourcesRequest, SearchSourcesResponse>({
      label: '检索地方资料',
      method: 'POST',
      url: '/sources/search',
      body,
      mock: (ctx) => {
        const started = performance.now()
        const page = body.page ?? 1
        const pageSize = body.pageSize ?? 10

        if (isEmptyScenario(ctx)) {
          return {
            total: 0,
            page,
            pageSize,
            hasMore: false,
            hits: [],
            expandedKeywords: [],
            facets: [],
            leads: [],
            tookMs: 320,
          }
        }

        // ---- AI 检索词扩展 ----
        const expandedKeywords: ExpandedKeyword[] = []
        if (body.enableQueryExpansion) {
          for (const keyword of body.keywords) {
            for (const rule of EXPANSION_RULES) {
              if (!keyword.includes(rule.match)) continue
              for (const expansion of rule.expansions) {
                if (body.keywords.includes(expansion.term)) continue
                if (expandedKeywords.some((item) => item.term === expansion.term)) continue
                expandedKeywords.push({
                  term: expansion.term,
                  weight: expansion.weight,
                  reason: expansion.reason,
                  hitCount: mockStore.sources.filter(
                    (hit) =>
                      hit.title.includes(expansion.term) ||
                      hit.excerpt.includes(expansion.term) ||
                      hit.highlights.some((item) => item.includes(expansion.term)),
                  ).length,
                })
              }
            }
          }
        }

        const terms = [...body.keywords, ...expandedKeywords.map((item) => item.term)].filter(
          (term) => term.trim().length > 0,
        )

        // ---- 过滤 ----
        const hits: SearchHit[] = []
        for (const hit of mockStore.sources) {
          if (
            body.sourceTypes &&
            body.sourceTypes.length > 0 &&
            !body.sourceTypes.includes(hit.sourceType)
          ) {
            continue
          }
          if (
            body.credibility &&
            body.credibility.length > 0 &&
            !body.credibility.includes(hit.credibility)
          ) {
            continue
          }
          if (body.entityIds && body.entityIds.length > 0) {
            const matched = hit.relatedEntityIds.some((id) => body.entityIds?.includes(id))
            if (!matched) continue
          }

          const { score, highlights } = scoreHit(hit, terms, body.enableReRank)
          // 无关键词时返回全部（浏览模式）
          const finalScore = terms.length === 0 ? hit.credibilityScore : score
          if (terms.length > 0 && finalScore <= 0) continue

          hits.push({
            ...hit,
            score: finalScore,
            highlights: highlights.length > 0 ? highlights : hit.highlights,
          })
        }

        // ---- 排序 ----
        const sort = body.sort ?? 'relevance'
        hits.sort((a, b) => {
          if (sort === 'publishedAt') return b.publishedAt.localeCompare(a.publishedAt)
          if (sort === 'credibility') {
            return CREDIBILITY_ORDER[b.credibility] - CREDIBILITY_ORDER[a.credibility]
          }
          return b.score - a.score || b.credibilityScore - a.credibilityScore
        })

        const total = hits.length
        const paged = hits.slice((page - 1) * pageSize, page * pageSize)

        // ---- 分面统计 ----
        const facets: SearchFacet[] = [
          {
            field: 'sourceType',
            buckets: Object.entries(
              hits.reduce<Record<string, number>>((acc, hit) => {
                acc[hit.sourceType] = (acc[hit.sourceType] ?? 0) + 1
                return acc
              }, {}),
            ).map(([value, count]) => ({
              value,
              label: SOURCE_TYPE_LABEL[value as SourceType] ?? value,
              count,
            })),
          },
          {
            field: 'credibility',
            buckets: (['high', 'medium', 'low', 'unverified'] as CredibilityLevel[]).map(
              (value) => ({
                value,
                label: CREDIBILITY_LABEL[value],
                count: hits.filter((hit) => hit.credibility === value).length,
              }),
            ),
          },
        ]

        // ---- 关联线索 ----
        const leadIds = [...new Set(hits.flatMap((hit) => hit.relatedLeadIds))]
        const leads: RelatedLead[] = leadIds
          .map((id) => LEAD_DEFS[id])
          .filter((lead) => lead !== undefined)
          .map((lead, index) => ({ id: leadIds[index] ?? `LEAD-${index}`, ...lead }))

        return {
          total,
          page,
          pageSize,
          hasMore: page * pageSize < total,
          hits: paged,
          expandedKeywords,
          facets,
          leads,
          tookMs: Math.round(performance.now() - started) + 180,
          aiMeta:
            body.enableQueryExpansion || body.enableReRank
              ? {
                  model: 'fuzhou-retriever',
                  modelVersion: '1.6.0',
                  confidence: 0.83,
                  needsHumanConfirm: false,
                  generatedAt: nowIso(),
                  tookMs: 420,
                }
              : undefined,
        }
      },
      isEmpty: (data) => data.hits.length === 0,
    })
  },

  /**
   * 获取资料详情。
   * GET /sources/{sourceId}
   * @param sourceId 资料来源 id
   * @returns 资料来源详情：原文、出版信息与引用位置
   */
  getSourceDetail(sourceId: string): Promise<ApiResponse<GetSourceDetailResponse>> {
    return request<unknown, GetSourceDetailResponse>({
      label: '获取资料详情',
      method: 'GET',
      url: '/sources/{sourceId}',
      path: { sourceId },
      mock: () => {
        const source = mockStore.sources.find((hit) => hit.sourceId === sourceId)
        if (!source) throw new Error(`资料 ${sourceId} 不存在。`)

        const relatedSources = mockStore.sources
          .filter(
            (hit) =>
              hit.sourceId !== sourceId &&
              hit.relatedEntityIds.some((id) => source.relatedEntityIds.includes(id)),
          )
          .slice(0, 4)

        const leads: RelatedLead[] = source.relatedLeadIds
          .map((id) => (LEAD_DEFS[id] ? { id, ...LEAD_DEFS[id] } : undefined))
          .filter((lead): lead is RelatedLead => lead !== undefined)

        return {
          source,
          fullExcerpt: `${source.excerpt}\n\n（以上为演示用摘录，真实环境返回资料全文或授权范围内可展示的段落。）`,
          citation: `${source.publisher}. ${source.title}[M]. ${source.publishedAt.slice(0, 4)}.`,
          relatedSources,
          leads,
        }
      },
    })
  },
}

/** 来源类型中文名。 */
export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  gazetteer: '地方志',
  chronicle: '年鉴大事记',
  genealogy: '族谱',
  newspaper: '旧报刊',
  academic: '学术论著',
  archive: '官方档案',
  oral: '口述记录',
  inscription: '碑刻匾额',
  heritage_list: '非遗名录',
}

/** 可信度中文名。 */
export const CREDIBILITY_LABEL: Record<CredibilityLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
  unverified: '待核',
}
