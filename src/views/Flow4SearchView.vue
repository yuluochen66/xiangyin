<script setup lang="ts">
/**
 * 流程 4：检索地方资料。
 *
 * 本视图是流程 4 的编排层：持有接口调用入口（searchApi.search 与对应的 7 态状态机）、
 * 顶层布局，并把检索条件、结果列表、分页、详情抽屉等职责交给 composables/ 与
 * components/flow4/ 承担。
 *
 * 交互覆盖：
 * - 条件组合检索：关键词（空格 / 逗号分隔多词）、来源类型多选、可信度多选、
 *   排序（relevance / publishedAt / credibility）、以及来自流程 3 的实体过滤；
 * - AI 检索增强（AI 介入点）：智能扩展检索词 + 相关度重排两个开关，
 *   扩展词单独成区（词 / 权重 / 理由 / 命中数），可逐条「加入关键词」或「忽略」，
 *   并展示 aiMeta 的模型、版本、置信度与耗时；
 * - 结果列表：可信度分级配色、可信度分值、命中词高亮、定位信息、相关度条；
 * - 关联线索跳转、分面筛选、分页「加载更多」（追加式，保持成功态）；
 * - 资料详情链路：详情 → 关联资料 → 详情（可无限继续），引用信息一键复制；
 * - 7 种界面状态，其中「命中包含口述记录 / 待核来源」会触发人工确认。
 *
 * 待确认（接口目录里没有的能力，用已有接口组合实现）：
 * - TODO-SEARCH-1：keywords 的 AND / OR 语义未定（见 src/api/search.ts 注释），
 *   本页把输入按空格切分为多词后原样提交、不做本地预判；
 * - TODO-SEARCH-2：响应分面里有 decade（年代），但 SearchSourcesRequest 没有对应字段，
 *   因此年代分面只展示计数、不可点击。
 */
import { computed, ref } from 'vue'

import { searchApi } from '@/api'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import FlowHeader from '@/components/common/FlowHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import EntityFilterPanel from '@/components/flow4/EntityFilterPanel.vue'
import ExpandedKeywordsPanel from '@/components/flow4/ExpandedKeywordsPanel.vue'
import RelatedLeadsPanel from '@/components/flow4/RelatedLeadsPanel.vue'
import RiskConfirmNotice from '@/components/flow4/RiskConfirmNotice.vue'
import SearchConditionPanel from '@/components/flow4/SearchConditionPanel.vue'
import SearchFacetPanel from '@/components/flow4/SearchFacetPanel.vue'
import SearchFallbackActions from '@/components/flow4/SearchFallbackActions.vue'
import SearchIdlePanel from '@/components/flow4/SearchIdlePanel.vue'
import SearchResultList from '@/components/flow4/SearchResultList.vue'
import SearchStatsBar from '@/components/flow4/SearchStatsBar.vue'
import SourceDetailDrawer from '@/components/flow4/SourceDetailDrawer.vue'
import ToolInvokePanel from '@/components/tools/ToolInvokePanel.vue'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { useSearchConditions } from '@/composables/useSearchConditions'
import { useSearchFallbacks } from '@/composables/useSearchFallbacks'
import { useSearchInsights } from '@/composables/useSearchInsights'
import { useSearchPagination } from '@/composables/useSearchPagination'
import { buildRiskPrompt } from '@/composables/useSourceMeta'
import { useSourceDetail } from '@/composables/useSourceDetail'
import { useRouter } from '@/router'
import type { SearchHit, SearchSort, SearchSourcesResponse } from '@/types/api'

const { notify } = useAppShell()
const router = useRouter()

/**
 * AI 工具契约层的默认入参。
 * 定义成模块级常量以保证引用稳定——若在模板里内联对象字面量，
 * 每次渲染都会生成新对象并覆盖用户在面板中编辑的 JSON。
 */
const TOOL_RETRIEVE_INPUT: Record<string, unknown> = {
  query: '脱胎漆器 推光',
  // 注意：工具层的 kinds 用 SourceKind（interview/document/dataset/media/official 五值），
  // 与 REST 层的 SourceType（地方志/学术论著/非遗名录等九值）不是同一套枚举。
  // 这是 TODO-ARCH-1 需要统一的地方，详见本面板说明。
  kinds: ['interview', 'official', 'dataset'],
  limit: 5,
  minConfidence: 0,
}

/**
 * 是否处于「加载更多」的追加请求中。
 * 追加页不重复触发人工确认：首次检索时用户已经确认过「低可信来源需人工核对」。
 */
const appending = ref(false)

const conditions = useSearchConditions({
  search: () => void run(1),
  hasAttempts: () => state.value.attempts > 0,
  notify,
})

const {
  keywordInput,
  keywords,
  selectedSourceTypes,
  selectedCredibility,
  selectedEntityIds,
  sort,
  pageSize,
  enableQueryExpansion,
  enableReRank,
  riskAcknowledged,
  entities,
  addKeywords,
  buildRequest,
  applyFilterChange,
  submitKeywordInput,
  removeKeyword,
  useRecommended,
  toggleSourceType,
  toggleCredibility,
  toggleEntity,
  selectConfirmedEntities,
  clearEntityFilter,
  resetConditions,
} = conditions

const { state, canRetry, isBusy, run, retry, respondConfirm, setData, reset } = useAsyncTask<
  SearchSourcesResponse,
  [number]
>((page) => searchApi.search(buildRequest(page)), {
  isEmpty: (data) => data.hits.length === 0,
  emptyHint: {
    reason: '当前关键词与筛选条件的组合没有命中任何地方资料。',
    suggestion: '可以放宽来源类型 / 可信度限制、去掉实体过滤，或减少关键词后重试。',
  },
  needsConfirm: (data) => (appending.value ? null : buildRiskPrompt(data)),
  onConfirm: (_data, decision) => {
    if (decision === 'confirmed') riskAcknowledged.value = true
  },
})

/* ------------------------------------------------------------------ */
/* 派生数据                                                            */
/* ------------------------------------------------------------------ */

const result = computed(() => state.value.data)
const hits = computed<SearchHit[]>(() => result.value?.hits ?? [])
const facets = computed(() => result.value?.facets ?? [])
const leads = computed(() => result.value?.leads ?? [])
const aiMeta = computed(() => result.value?.aiMeta)
const confirmPrompt = computed(() => state.value.confirmPrompt)
const hasMore = computed(() => result.value?.hasMore ?? false)
const expandedKeywords = computed(() => result.value?.expandedKeywords ?? [])

const {
  adoptedLeadIds,
  visibleExpandedKeywords,
  adoptExpanded,
  ignoreExpanded,
  adoptLead,
  clearInsights,
} = useSearchInsights({
  expandedKeywords,
  addKeywords,
  riskAcknowledged,
  search: () => void run(1),
  notify,
})

/** 高亮用词：已生效关键词 + 未被忽略的扩展词。 */
const activeTerms = computed(() => [
  ...keywords.value,
  ...visibleExpandedKeywords.value.map((item) => item.term),
])

const { clearAllFilters, relaxFilters, dropCredibilityFilter, browseWithEntities, toggleFacet } =
  useSearchFallbacks({
    conditions,
    search: () => void run(1),
    hasAttempts: () => state.value.attempts > 0,
    clearExtras: clearInsights,
    notify,
  })

const { loadMoreBusy, loadMore } = useSearchPagination({
  result,
  state,
  isBusy,
  run,
  setData,
  appending,
  notify,
})

const {
  detailSourceId,
  citationCopied,
  detailState,
  detailCanRetry,
  detailBusy,
  detail,
  retryDetail,
  openDetail,
  closeDetail,
  copyCitation,
} = useSourceDetail({ notify })

/* ------------------------------------------------------------------ */
/* 条件组件的事件回写                                                  */
/* ------------------------------------------------------------------ */

function updateKeywordInput(value: string): void {
  keywordInput.value = value
}

function updateSort(value: SearchSort): void {
  sort.value = value
}

function updatePageSize(value: number): void {
  pageSize.value = value
}

function updateEnableQueryExpansion(value: boolean): void {
  enableQueryExpansion.value = value
}

function updateEnableReRank(value: boolean): void {
  enableReRank.value = value
}

/** 重置检索：清空条件与扩展词 / 线索记录，关闭详情并回到 idle。 */
function resetSearch(): void {
  clearInsights()
  resetConditions()
  closeDetail()
  reset()
}
</script>

<template>
  <div class="space-y-4">
    <FlowHeader
      :step="4"
      title="检索地方资料"
      description="把口述里出现的地点、人物、事件拿到方志 / 档案 / 学术资料中交叉核验。AI 负责扩展检索词与相关度重排，但低可信来源必须由人确认后才能引用。"
      :phase="state.phase"
      :attempts="state.attempts"
      :endpoints="['POST /sources/search', 'GET /sources/{sourceId}']"
    >
      <template #actions>
        <StatusPill :tone="enableQueryExpansion ? 'violet' : 'neutral'" dense>
          扩展检索词 {{ enableQueryExpansion ? '开' : '关' }}
        </StatusPill>
        <StatusPill :tone="enableReRank ? 'violet' : 'neutral'" dense>
          相关度重排 {{ enableReRank ? '开' : '关' }}
        </StatusPill>
        <BaseButton v-if="state.attempts > 0" variant="ghost" size="sm" @click="resetSearch">
          重置检索
        </BaseButton>
      </template>
    </FlowHeader>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <!-- ==================== 左栏：检索条件 ==================== -->
      <div class="space-y-4">
        <SearchConditionPanel
          :keyword-input="keywordInput"
          :keywords="keywords"
          :selected-source-types="selectedSourceTypes"
          :selected-credibility="selectedCredibility"
          :entity-filter-count="selectedEntityIds.length"
          :sort="sort"
          :page-size="pageSize"
          :enable-query-expansion="enableQueryExpansion"
          :enable-re-rank="enableReRank"
          :is-busy="isBusy"
          @update:keyword-input="updateKeywordInput"
          @update:sort="updateSort"
          @update:page-size="updatePageSize"
          @update:enable-query-expansion="updateEnableQueryExpansion"
          @update:enable-re-rank="updateEnableReRank"
          @submit="submitKeywordInput"
          @remove-keyword="removeKeyword"
          @toggle-source-type="toggleSourceType"
          @toggle-credibility="toggleCredibility"
          @filter-change="applyFilterChange"
          @clear-all="clearAllFilters"
        />

        <EntityFilterPanel
          :entities="entities"
          :selected-entity-ids="selectedEntityIds"
          :is-busy="isBusy"
          @select-confirmed="selectConfirmedEntities"
          @clear="clearEntityFilter"
          @toggle-entity="toggleEntity"
        />
      </div>

      <!-- ==================== 右栏：检索结果（7 态） ==================== -->
      <div class="space-y-4">
        <AsyncStateBoundary
          :phase="state.phase"
          :error="state.error"
          :can-retry="canRetry"
          :retry-progress="state.retryProgress"
          :empty-reason="state.emptyHint?.reason"
          :empty-suggestion="state.emptyHint?.suggestion"
          :unavailable-reason="state.unavailableReason"
          empty-title="没有命中任何地方资料"
          loading-text="正在检索地方资料（含 AI 扩展与重排）…"
          :skeleton-rows="5"
          min-height-class="min-h-[240px]"
          @retry="retry()"
        >
          <div class="space-y-4">
            <RiskConfirmNotice
              :phase="state.phase"
              :confirm-prompt="confirmPrompt"
              :risk-acknowledged="riskAcknowledged"
              @respond="respondConfirm"
            />

            <SearchStatsBar
              v-if="result"
              :result="result"
              :took-ms="state.tookMs"
              :from-mock="state.fromMock"
              :attempts="state.attempts"
            />

            <ExpandedKeywordsPanel
              v-if="result"
              :result="result"
              :visible-expanded-keywords="visibleExpandedKeywords"
              :ai-meta="aiMeta"
              :enable-query-expansion="enableQueryExpansion"
              :is-busy="isBusy"
              @adopt="adoptExpanded"
              @ignore="ignoreExpanded"
            />

            <SearchFacetPanel
              v-if="facets.length > 0"
              :facets="facets"
              :selected-source-types="selectedSourceTypes"
              :selected-credibility="selectedCredibility"
              :is-busy="isBusy"
              @toggle-facet="toggleFacet"
              @clear-all="clearAllFilters"
            />

            <SearchResultList
              v-if="result"
              :result="result"
              :hits="hits"
              :risk-acknowledged="riskAcknowledged"
              :is-busy="isBusy"
              :detail-busy="detailBusy"
              :detail-source-id="detailSourceId"
              :load-more-busy="loadMoreBusy"
              :has-more="hasMore"
              :active-terms="activeTerms"
              @open-detail="openDetail"
              @load-more="loadMore"
            />

            <RelatedLeadsPanel
              v-if="leads.length > 0"
              :leads="leads"
              :adopted-lead-ids="adoptedLeadIds"
              @adopt="adoptLead"
            />
          </div>

          <!-- idle：推荐检索词 -->
          <template #idle>
            <SearchIdlePanel
              :is-busy="isBusy"
              @use-recommended="useRecommended"
              @browse-all="run(1)"
            />
          </template>

          <!-- empty：可执行动作 -->
          <template #empty-actions>
            <SearchFallbackActions
              variant="empty"
              :is-busy="isBusy"
              @relax="relaxFilters"
              @drop-credibility="dropCredibilityFilter"
              @reset="resetSearch"
            />
          </template>

          <!-- unavailable：本地资料库未接入 -->
          <template #unavailable-actions>
            <SearchFallbackActions
              variant="unavailable"
              :is-busy="isBusy"
              @browse-entities="browseWithEntities"
              @go-step3="router.goToStep(3)"
            />
          </template>

          <!-- error：额外动作 -->
          <template #error-actions>
            <BaseButton variant="ghost" size="sm" @click="resetSearch">重置检索条件</BaseButton>
          </template>
        </AsyncStateBoundary>

        <p class="text-2xs leading-4 text-ink-4">
          交互说明：所有写操作（采纳扩展词、加入线索、切换筛选）都会给出提示并记录调用次数；
          「需人工确认」只在命中包含口述记录 / 待核来源时出现，确认结果会标记到具体结果上。
        </p>
      </div>
    </div>

    <!-- ==================== 资料详情侧栏（可继续跳转，形成链路） ==================== -->
    <SourceDetailDrawer
      v-if="detailSourceId"
      :source-id="detailSourceId"
      :detail-state="detailState"
      :detail="detail"
      :can-retry="detailCanRetry"
      :busy="detailBusy"
      :citation-copied="citationCopied"
      @close="closeDetail"
      @retry="retryDetail()"
      @copy-citation="copyCitation"
      @open-detail="openDetail"
      @adopt-lead="adoptLead"
    />

    <ToolInvokePanel
      tool="retrieve_local_sources"
      title="地方资料检索（工具契约层）"
      description="按同一份检索意图走 retrieve_local_sources 工具契约：入参是纯关键词 + 类型白名单 + 可信度下限，出参是带相关度得分与命中词的 RetrievedSource[]。与上方 REST 通路（POST /sources/search）互为对照——REST 通路额外返回分面统计、AI 扩展词与关联线索，工具通路则更贴近「来源标签」这一原始能力。两者目前有一处枚举差异：工具层 kinds 用 SourceKind（五值），REST 层 sourceTypes 用 SourceType（九值）——传错枚举不会报错，只会静默筛空，这正是 TODO-ARCH-1 要统一的地方。"
      :input="TOOL_RETRIEVE_INPUT"
    />
  </div>
</template>
