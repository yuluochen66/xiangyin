<script setup lang="ts">
/**
 * 流程 4 的资料详情侧栏。
 *
 * 唯一职责：渲染单条资料的详情抽屉——标题与出版信息、可信度与定位、完整摘录、
 * 引用信息一键复制、关联资料（可继续进入详情）与该资料的关联线索；
 * 内部状态由 7 态边界呈现。本组件只把关闭 / 重试 / 复制 / 跳转 / 采纳线索冒泡出去，
 * 不持有详情数据、不发起请求。
 */
import { computed } from 'vue'

import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { locatorText } from '@/composables/useSearchHighlight'
import { CREDIBILITY_META, LEAD_KIND_LABEL, sourceTypeLabel } from '@/composables/useSourceMeta'
import type { GetSourceDetailResponse, RelatedLead } from '@/types/api'
import { formatDate } from '@/utils/format'

interface Props {
  sourceId: string
  detailState: AsyncTaskState<GetSourceDetailResponse>
  detail: GetSourceDetailResponse | null
  canRetry: boolean
  /** 详情请求进行中。 */
  busy: boolean
  /** 引用信息刚复制成功。 */
  citationCopied: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  retry: []
  'copy-citation': []
  'open-detail': [sourceId: string]
  'adopt-lead': [lead: RelatedLead]
}>()

const detail = computed(() => props.detail)
</script>

<template>
  <!-- ==================== 资料详情侧栏（可继续跳转，形成链路） ==================== -->
  <div class="fixed inset-0 z-40 bg-paper" @click="emit('close')" />
  <aside
    class="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-rule bg-paper"
    aria-label="资料详情"
  >
    <header class="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-ink">资料详情</p>
        <p class="mt-0.5 font-mono text-2xs text-ink-4">
          {{ props.sourceId }} · GET /sources/{sourceId}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <StatusPill v-if="props.detailState.attempts > 0" tone="neutral" dense>
          调用 {{ props.detailState.attempts }} 次
        </StatusPill>
        <BaseButton variant="ghost" size="sm" @click="emit('close')">关闭</BaseButton>
      </div>
    </header>

    <div class="scroll-area min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <AsyncStateBoundary
        :phase="props.detailState.phase"
        :error="props.detailState.error"
        :can-retry="props.canRetry"
        :empty-reason="props.detailState.emptyHint?.reason"
        empty-title="没有取到资料详情"
        loading-text="正在读取资料全文与关联资料…"
        :skeleton-rows="5"
        min-height-class="min-h-[200px]"
        @retry="emit('retry')"
      >
        <div v-if="detail" class="space-y-3">
          <div>
            <h3 class="text-sm font-semibold text-ink">{{ detail.source.title }}</h3>
            <p class="mt-0.5 text-2xs text-ink-4">
              {{ detail.source.publisher }} · {{ formatDate(detail.source.publishedAt) }}
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <StatusPill tone="neutral" dense>
                {{ sourceTypeLabel(detail.source.sourceType) }}
              </StatusPill>
              <StatusPill :tone="CREDIBILITY_META[detail.source.credibility].tone" dense>
                可信度 {{ CREDIBILITY_META[detail.source.credibility].label }} ·
                {{ detail.source.credibilityScore.toFixed(2) }}
              </StatusPill>
              <StatusPill tone="neutral" dense>定位：{{ locatorText(detail.source) }}</StatusPill>
              <StatusPill v-if="detail.source.cited" tone="info" dense>已被草稿引用</StatusPill>
            </div>
          </div>

          <div class="border border-rule bg-sheet p-3">
            <p class="text-2xs font-medium text-ink-3">完整摘录</p>
            <p class="mt-1.5 text-xs leading-relaxed whitespace-pre-line text-ink-2">
              {{ detail.fullExcerpt }}
            </p>
          </div>

          <div class="border border-rule bg-sheet p-3">
            <div class="flex items-center justify-between gap-2">
              <p class="text-2xs font-medium text-ink-3">引用信息（GB/T 7714）</p>
              <BaseButton variant="ghost" size="sm" @click="emit('copy-citation')">
                {{ props.citationCopied ? '已复制' : '一键复制' }}
              </BaseButton>
            </div>
            <p class="mt-1.5 font-mono text-2xs leading-5 text-ink-2 select-all">
              {{ detail.citation }}
            </p>
          </div>

          <div v-if="detail.relatedSources.length > 0" class="space-y-1.5">
            <p class="text-2xs font-medium text-ink-3">
              关联资料（继续追踪：点击即进入该资料详情）
            </p>
            <ul class="space-y-1.5">
              <li v-for="related in detail.relatedSources" :key="related.sourceId">
                <button
                  type="button"
                  class="w-full border border-rule bg-paper px-2.5 py-1.5 text-left transition-colors hover:border-seal-2 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="props.busy"
                  @click="emit('open-detail', related.sourceId)"
                >
                  <span class="block truncate text-2xs font-medium text-ink">
                    {{ related.title }}
                  </span>
                  <span class="block text-2xs text-ink-4">
                    {{ related.publisher }} · {{ sourceTypeLabel(related.sourceType) }} · 可信度
                    {{ CREDIBILITY_META[related.credibility].label }}
                  </span>
                </button>
              </li>
            </ul>
          </div>

          <div v-if="detail.leads.length > 0" class="space-y-1.5">
            <p class="text-2xs font-medium text-ink-3">该资料的关联线索</p>
            <ul class="space-y-1.5">
              <li v-for="lead in detail.leads" :key="lead.id">
                <button
                  type="button"
                  class="w-full border border-rule bg-paper px-2.5 py-1.5 text-left text-2xs text-ink-2 transition-colors hover:border-seal-2"
                  @click="emit('adopt-lead', lead)"
                >
                  <span class="flex items-center gap-1.5">
                    <span class="font-medium text-ink">{{ lead.title }}</span>
                    <StatusPill tone="neutral" dense>{{ LEAD_KIND_LABEL[lead.kind] }}</StatusPill>
                  </span>
                  <span class="mt-0.5 block text-2xs leading-4 text-ink-4">{{ lead.hint }}</span>
                </button>
              </li>
            </ul>
          </div>

          <p class="border-t border-rule pt-2.5 text-2xs leading-4 text-ink-4">
            「关联资料 →
            详情」可以一直点下去，形成核证链路；每条详情都可通过「一键复制」把引用信息带回讲稿。
          </p>
        </div>
      </AsyncStateBoundary>
    </div>
  </aside>
</template>
