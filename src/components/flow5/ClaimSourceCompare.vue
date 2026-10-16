<script setup lang="ts">
/**
 * 单条比对项的左右对照。
 *
 * 唯一职责：左侧展示 AI 创作内容，右侧展示配对资料（标题 / 出版方 / 可信度 / 定位 /
 * 摘录）；配对为空时降级为「未匹配到资料」提示。
 */
import StatusPill from '@/components/common/StatusPill.vue'
import { CREDIBILITY_TEXT, CREDIBILITY_TONE } from '@/composables/useComparisonMeta'
import type { ComparisonItem } from '@/types/api'
import { formatDate } from '@/utils/format'

defineProps<{ item: ComparisonItem }>()
</script>

<template>
  <div class="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
    <div class="border border-rule bg-paper p-2.5">
      <p class="text-2xs font-medium text-ink-3">AI 创作内容</p>
      <p class="mt-1.5 text-xs leading-relaxed text-ink">{{ item.claimText }}</p>
    </div>

    <div v-if="item.source" class="border border-rule bg-paper p-2.5">
      <p class="text-2xs font-medium text-ink-3">检索资料</p>
      <p class="mt-1 text-xs font-medium text-ink">{{ item.source.title }}</p>
      <p class="text-2xs text-ink-4">
        {{ item.source.publisher }} · {{ formatDate(item.source.publishedAt) }}
      </p>
      <div class="mt-1 flex flex-wrap items-center gap-1.5">
        <StatusPill :tone="CREDIBILITY_TONE[item.source.credibility]" dense>
          可信度 {{ CREDIBILITY_TEXT[item.source.credibility] }}
        </StatusPill>
        <StatusPill tone="neutral" dense>
          定位
          {{ item.source.locator.page !== undefined ? `第 ${item.source.locator.page} 页` : '' }}
          {{ item.source.locator.url ? '在线资源' : '' }}
        </StatusPill>
      </div>
      <p class="mt-1.5 border-rule pl-2 text-2xs leading-relaxed text-ink-2">
        {{ item.source.excerpt }}
      </p>
    </div>

    <div v-else class="border border-dashed border-attention bg-attention-wash p-2.5">
      <p class="text-2xs font-medium text-attention">未匹配到资料（资料不足）</p>
      <p class="mt-1 text-2xs leading-4 text-attention">
        在本次检索范围内没有找到可对照的资料，AI 初判恒为「资料不足」。 建议回到流程 4
        放宽检索条件后重新发起比对，或直接判为「资料不足」并写明依据。
      </p>
    </div>
  </div>
</template>
