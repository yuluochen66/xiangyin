<script setup lang="ts">
/**
 * 流程 4 的「分面筛选」面板。
 *
 * 唯一职责：渲染后端返回的分面桶（来源类型 / 可信度 / 年代计数），点击非年代桶
 * 即切换对应筛选条件；年代桶只展示计数、不可点击（TODO-SEARCH-2）。
 * 本组件不持有筛选状态，选中判定由所选条件派生。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import { FACET_LABEL, isFacetActive } from '@/composables/useSourceMeta'
import type { CredibilityLevel, SearchFacet, SourceType } from '@/types/api'

interface Props {
  facets: SearchFacet[]
  selectedSourceTypes: SourceType[]
  selectedCredibility: CredibilityLevel[]
  isBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle-facet': [facet: SearchFacet, value: string]
  'clear-all': []
}>()

// 用当前已选条件判断某个分面桶是否处于选中态。
function facetActive(facet: SearchFacet, value: string): boolean {
  return isFacetActive(facet, value, props.selectedSourceTypes, props.selectedCredibility)
}
</script>

<template>
  <!-- 分面筛选 -->
  <PanelSection
    v-if="props.facets.length > 0"
    title="分面筛选"
    description="点击计数标签即切换对应筛选条件；已有结果时会立即重新检索。"
  >
    <template #actions>
      <BaseButton variant="ghost" size="sm" :disabled="props.isBusy" @click="emit('clear-all')">
        清空筛选
      </BaseButton>
    </template>

    <div class="space-y-2.5">
      <div v-for="facet in props.facets" :key="facet.field">
        <p class="mb-1 text-2xs text-ink-4">
          {{ FACET_LABEL[facet.field] }}
          <span v-if="facet.field === 'decade'" class="text-ink-4">
            （接口暂无对应请求字段，仅展示计数 · 待确认 TODO-SEARCH-2）
          </span>
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="bucket in facet.buckets"
            :key="bucket.value"
            type="button"
            :disabled="facet.field === 'decade'"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 text-2xs ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              facetActive(facet, bucket.value)
                ? 'bg-seal text-seal-ink ring-seal-2'
                : 'bg-paper-3 text-ink-3 ring-rule hover:text-ink'
            "
            @click="emit('toggle-facet', facet, bucket.value)"
          >
            {{ bucket.label }}
            <span class="font-mono text-ink-4">{{ bucket.count }}</span>
          </button>
        </div>
      </div>
    </div>
  </PanelSection>
</template>
