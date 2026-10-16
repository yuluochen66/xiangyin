<script setup lang="ts">
/**
 * 筛选与分组统计面板。
 *
 * 唯一职责：渲染「全部 + 六类实体」的类别按钮、确认状态按钮与关键词输入框，并把这三项
 * 筛选条件双向同步给视图；只影响展示，不触碰数据与接口。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import { CONFIRM_FILTERS } from '@/composables/useEntityFilters'
import type { ConfirmFilter, EntityKindSummary } from '@/composables/useEntityFilters'
import type { EntityKind } from '@/types/api'

defineProps<{
  /** 未筛选的实体总数，用于「全部」按钮上的计数。 */
  total: number
  summary: EntityKindSummary[]
}>()

const kindFilter = defineModel<EntityKind | 'all'>('kindFilter', { required: true })
const confirmFilter = defineModel<ConfirmFilter>('confirmFilter', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
</script>

<template>
  <PanelSection
    title="筛选与分组统计"
    description="分组与数量来自 EntityKind；筛选只影响展示，不影响确认与写操作。"
    dense
  >
    <div class="flex flex-wrap items-center gap-2 text-2xs">
      <button
        type="button"
        class="border px-2 py-0.5 transition-colors"
        :class="
          kindFilter === 'all'
            ? 'border-seal-2 bg-seal text-seal-ink'
            : 'border-rule text-ink-3 hover:text-ink'
        "
        @click="kindFilter = 'all'"
      >
        全部 {{ total }}
      </button>
      <button
        v-for="item in summary"
        :key="item.kind"
        type="button"
        class="border px-2 py-0.5 transition-colors"
        :class="
          kindFilter === item.kind
            ? 'border-seal-2 bg-seal text-seal-ink'
            : 'border-rule text-ink-3 hover:text-ink'
        "
        @click="kindFilter = item.kind"
      >
        <AppIcon :name="item.icon" :size="12" /> {{ item.label }} {{ item.count }}
        <span v-if="item.pending > 0" class="text-attention">· 待确认 {{ item.pending }}</span>
      </button>
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-2xs">
      <span class="text-ink-4">确认状态</span>
      <button
        v-for="option in CONFIRM_FILTERS"
        :key="option.value"
        type="button"
        class="border px-2 py-0.5 transition-colors"
        :class="
          confirmFilter === option.value
            ? 'border-seal-2 bg-seal text-seal-ink'
            : 'border-rule text-ink-3 hover:text-ink'
        "
        @click="confirmFilter = option.value"
      >
        {{ option.label }}
      </button>
      <input
        v-model="keyword"
        type="search"
        placeholder="按名称 / 规范名 / 别名搜索"
        class="ml-auto h-7 w-56 border border-rule bg-sheet px-2 text-2xs text-ink placeholder:text-ink-4 focus:border-seal-2 focus:outline-none"
      />
    </div>
  </PanelSection>
</template>
