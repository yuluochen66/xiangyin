<script setup lang="ts">
/**
 * 流程 4 的检索结果列表。
 *
 * 唯一职责：渲染命中列表——可信度分级配色与分值、命中词高亮、定位信息、相关度条、
 * 「查看详情」入口，以及底部的「加载更多」追加式分页控件。
 * 本组件不持有结果数据、不发起请求，高亮切分复用 useSearchHighlight。
 */
import { computed } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useSearchHighlight } from '@/composables/useSearchHighlight'
import { CREDIBILITY_META, isRiskyHit, sourceTypeLabel } from '@/composables/useSourceMeta'
import type { SearchHit, SearchSourcesResponse } from '@/types/api'
import { formatDate } from '@/utils/format'

interface Props {
  result: SearchSourcesResponse | null
  hits: SearchHit[]
  riskAcknowledged: boolean
  isBusy: boolean
  /** 详情请求进行中。 */
  detailBusy: boolean
  /** 正在加载详情的那条资料 id（用于把 loading 只挂在对应按钮上）。 */
  detailSourceId: string | null
  loadMoreBusy: boolean
  hasMore: boolean
  /** 当前生效的检索词（关键词 + 未被忽略的扩展词）。 */
  activeTerms: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{ 'open-detail': [sourceId: string]; 'load-more': [] }>()

const result = computed(() => props.result)
const { excerptParts, locatorText } = useSearchHighlight(computed(() => props.activeTerms))
</script>

<template>
  <!-- 结果列表 -->
  <PanelSection
    v-if="result"
    title="检索结果"
    :description="`共 ${result.total} 条，当前展示 ${props.hits.length} 条。命中词已高亮，「查看详情」可继续追踪关联资料与线索。`"
  >
    <div class="space-y-2.5">
      <article
        v-for="hit in props.hits"
        :key="hit.sourceId"
        class="border p-3 transition-colors"
        :class="
          props.riskAcknowledged && isRiskyHit(hit)
            ? 'border-attention bg-attention'
            : 'border-rule bg-paper hover:border-rule'
        "
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-medium text-ink">{{ hit.title }}</h3>
            <p class="mt-0.5 text-2xs text-ink-4">
              {{ hit.publisher }} · {{ formatDate(hit.publishedAt) }} ·
              <span class="font-mono">{{ hit.sourceId }}</span>
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-1.5">
            <StatusPill tone="neutral" dense>{{ sourceTypeLabel(hit.sourceType) }}</StatusPill>
            <StatusPill :tone="CREDIBILITY_META[hit.credibility].tone" dense>
              可信度 {{ CREDIBILITY_META[hit.credibility].label }} ·
              {{ hit.credibilityScore.toFixed(2) }}
            </StatusPill>
            <StatusPill v-if="isRiskyHit(hit)" tone="warning" dense>
              {{ hit.sourceType === 'oral' ? '口述记录' : '待核' }} · 引用需人工确认
            </StatusPill>
            <StatusPill v-if="props.riskAcknowledged && isRiskyHit(hit)" tone="success" dense>
              已确认分级
            </StatusPill>
            <StatusPill v-if="hit.cited" tone="info" dense>已被草稿引用</StatusPill>
          </div>
        </div>

        <!-- 相关度条 -->
        <div class="mt-2 flex items-center gap-2">
          <span class="text-2xs text-ink-4">相关度</span>
          <span class="h-1 min-w-0 flex-1 bg-paper-3">
            <span class="block h-full" :style="{ width: `${Math.round(hit.score * 100)}%` }" />
          </span>
          <span class="font-mono text-2xs text-ink-3">{{ hit.score.toFixed(3) }}</span>
        </div>

        <!-- 摘录 + 命中词高亮 -->
        <p class="mt-2 border-rule pl-2.5 text-xs leading-relaxed text-ink-2">
          <template v-for="(part, index) in excerptParts(hit)" :key="index">
            <mark v-if="part.hit" class="bg-attention-wash px-0.5 text-attention">{{
              part.text
            }}</mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </p>

        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-ink-4">
          <span>定位：{{ locatorText(hit) }}</span>
          <a
            v-if="hit.locator.url"
            :href="hit.locator.url"
            target="_blank"
            rel="noreferrer noopener"
            class="text-seal-ink underline decoration-dotted hover:text-seal-ink"
          >
            打开原始链接
          </a>
          <span v-if="hit.relatedEntityIds.length > 0" class="font-mono">
            实体 {{ hit.relatedEntityIds.join('、') }}
          </span>
          <BaseButton
            class="ml-auto"
            variant="secondary"
            size="sm"
            :loading="props.detailBusy && props.detailSourceId === hit.sourceId"
            :disabled="props.detailBusy"
            @click="emit('open-detail', hit.sourceId)"
          >
            查看详情 · GET /sources/{sourceId}
          </BaseButton>
        </div>
      </article>
    </div>

    <!-- 分页：加载更多 -->
    <div
      v-if="props.hasMore && result"
      class="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3"
    >
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="props.loadMoreBusy"
        :disabled="props.isBusy"
        @click="emit('load-more')"
      >
        加载更多（第 {{ result.page + 1 }} 页）
      </BaseButton>
      <span class="text-2xs text-ink-4">
        追加式分页：新结果会接到列表末尾，状态机保持成功态，不会清空已有结果。
      </span>
    </div>
    <p v-else class="mt-3 border-t border-rule pt-3 text-2xs text-ink-4">
      已是最后一页（共 {{ result?.total ?? 0 }} 条）。
    </p>
  </PanelSection>
</template>
