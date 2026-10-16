/**
 * 流程 4 的检索增强与线索采纳状态。
 *
 * 唯一职责：维护两份纯前端状态——「AI 扩展词里哪些被忽略」与「关联线索里哪些
 * 已加入检索」，并实现采纳扩展词 / 忽略扩展词 / 采纳线索三个动作，同时给出
 * 过滤后的可见扩展词列表。
 *
 * 关键词的实际追加、人工确认标记的重置与检索触发都通过回调交回调用方，
 * 本模块不持有检索条件，也不发起请求。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { NoticeLevel } from '@/composables/useAppShell'
import type { ExpandedKeyword, RelatedLead } from '@/types/api'

export interface UseSearchInsightsOptions {
  /** 后端返回的扩展词。 */
  expandedKeywords: Ref<ExpandedKeyword[]>
  /** 追加检索词（不触发检索）。 */
  addKeywords: (terms: string[]) => void
  /** 低可信来源的人工确认标记；采纳动作会把它清掉。 */
  riskAcknowledged: Ref<boolean>
  /** 立即以第 1 页重新检索。 */
  search: () => void
  /** 界面提示。 */
  notify: (level: NoticeLevel, text: string, detail?: string) => void
}

export interface UseSearchInsightsApi {
  /** 被用户忽略的扩展词（仅前端隐藏，不改动已返回的结果）。 */
  ignoredExpanded: Ref<string[]>
  /** 已加入检索的线索 id。 */
  adoptedLeadIds: Ref<string[]>
  /** 过滤掉已忽略项后的扩展词。 */
  visibleExpandedKeywords: ComputedRef<ExpandedKeyword[]>
  /** 采纳扩展词：加入关键词并重新检索。 */
  adoptExpanded(term: string): void
  /** 忽略扩展词：只影响展示。 */
  ignoreExpanded(term: string): void
  /** 采纳线索：把线索标题追加为关键词并重新检索。 */
  adoptLead(lead: RelatedLead): void
  /** 清空两份前端状态（清空筛选 / 重置检索时调用）。 */
  clearInsights(): void
}

/**
 * 创建检索增强与线索采纳状态。
 * @param options 扩展词列表、关键词追加、检索触发与全局提示的回调
 * @returns 忽略 / 采纳状态与三个动作
 */
export function useSearchInsights(options: UseSearchInsightsOptions): UseSearchInsightsApi {
  const ignoredExpanded = ref<string[]>([])
  const adoptedLeadIds = ref<string[]>([])

  const visibleExpandedKeywords = computed(() =>
    options.expandedKeywords.value.filter((item) => !ignoredExpanded.value.includes(item.term)),
  )

  function adoptExpanded(term: string): void {
    options.addKeywords([term])
    options.riskAcknowledged.value = false
    options.notify(
      'success',
      `已把扩展词「${term}」加入检索条件。`,
      '重新检索中，可随时在关键词区移除。',
    )
    options.search()
  }

  function ignoreExpanded(term: string): void {
    ignoredExpanded.value = [...ignoredExpanded.value, term]
    options.notify('info', `已忽略扩展词「${term}」。`, '已返回的结果不受影响；清空筛选可恢复。')
  }

  function adoptLead(lead: RelatedLead): void {
    if (adoptedLeadIds.value.includes(lead.id)) {
      options.notify('info', `线索「${lead.title}」已在检索条件中。`, lead.hint)
      return
    }
    adoptedLeadIds.value = [...adoptedLeadIds.value, lead.id]
    options.addKeywords([lead.title])
    options.riskAcknowledged.value = false
    options.notify('success', `已加入检索：${lead.title}`, lead.hint)
    options.search()
  }

  function clearInsights(): void {
    ignoredExpanded.value = []
    adoptedLeadIds.value = []
  }

  return {
    ignoredExpanded,
    adoptedLeadIds,
    visibleExpandedKeywords,
    adoptExpanded,
    ignoreExpanded,
    adoptLead,
    clearInsights,
  }
}
