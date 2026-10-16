<script setup lang="ts">
/**
 * 流程 4 左栏「检索条件」面板。
 *
 * 唯一职责：渲染检索条件表单——关键词输入与已选关键词、来源类型多选、可信度多选、
 * 排序与每页条数、AI 检索增强开关、清空筛选，并把用户操作以事件冒泡给主视图。
 * 本组件不持有条件状态、不拼装请求、不发起检索。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import {
  CREDIBILITY_META,
  CREDIBILITY_OPTIONS,
  PAGE_SIZE_OPTIONS,
  SORT_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  sourceTypeLabel,
} from '@/composables/useSourceMeta'
import type { CredibilityLevel, SearchSort, SourceType } from '@/types/api'

interface Props {
  keywordInput: string
  keywords: string[]
  selectedSourceTypes: SourceType[]
  selectedCredibility: CredibilityLevel[]
  /** 已选实体过滤项数量：与类型 / 可信度一并计入「已选 N 项过滤」。 */
  entityFilterCount: number
  sort: SearchSort
  pageSize: number
  enableQueryExpansion: boolean
  enableReRank: boolean
  isBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:keywordInput': [value: string]
  'update:sort': [value: SearchSort]
  'update:pageSize': [value: number]
  'update:enableQueryExpansion': [value: boolean]
  'update:enableReRank': [value: boolean]
  submit: []
  'remove-keyword': [term: string]
  'toggle-source-type': [type: SourceType]
  'toggle-credibility': [level: CredibilityLevel]
  'filter-change': []
  'clear-all': []
}>()

// 关键词输入：只把文本同步给父组件，提交由回车或「检索」按钮触发。
function onKeywordInput(event: Event): void {
  emit('update:keywordInput', (event.target as HTMLInputElement).value)
}

// 排序变化：先同步排序值，再通知父组件按新条件重查。
function onSortChange(event: Event): void {
  emit('update:sort', (event.target as HTMLSelectElement).value as SearchSort)
  emit('filter-change')
}

// 每页条数变化：先同步条数，再通知父组件按新条件重查。
function onPageSizeChange(event: Event): void {
  emit('update:pageSize', Number((event.target as HTMLSelectElement).value))
  emit('filter-change')
}

// 切换「智能扩展检索词」开关。
function onExpansionChange(event: Event): void {
  emit('update:enableQueryExpansion', (event.target as HTMLInputElement).checked)
  emit('filter-change')
}

// 切换「相关度重排」开关。
function onReRankChange(event: Event): void {
  emit('update:enableReRank', (event.target as HTMLInputElement).checked)
  emit('filter-change')
}
</script>

<template>
  <PanelSection
    title="1 · 检索条件"
    description="关键词支持空格分隔多词；类型与可信度可多选，不选表示不限。"
  >
    <div class="space-y-3">
      <div class="space-y-1.5">
        <label class="text-2xs text-ink-3" for="search-keyword">关键词</label>
        <div class="flex gap-1.5">
          <input
            id="search-keyword"
            :value="props.keywordInput"
            type="search"
            placeholder="如：脱胎漆器 推光"
            class="h-8 min-w-0 flex-1 border border-rule bg-paper px-2 text-xs text-ink outline-none placeholder:text-ink-4 focus:border-seal-2"
            @input="onKeywordInput"
            @keydown.enter.prevent="emit('submit')"
          />
          <BaseButton variant="primary" size="sm" :loading="props.isBusy" @click="emit('submit')">
            检索
          </BaseButton>
        </div>
        <p class="text-2xs text-ink-4">
          调用 <code class="font-mono">searchApi.search</code> · POST /sources/search
        </p>
      </div>

      <!-- 已生效关键词 -->
      <div v-if="props.keywords.length > 0" class="flex flex-wrap gap-1.5">
        <button
          v-for="term in props.keywords"
          :key="term"
          type="button"
          class="inline-flex items-center gap-1 bg-seal px-2 py-0.5 text-2xs text-seal-ink ring-1 ring-inset ring-seal-2 hover:bg-seal"
          :title="`移除关键词「${term}」`"
          @click="emit('remove-keyword', term)"
        >
          {{ term }} <span aria-hidden="true"><AppIcon name="close" :size="14" /></span>
        </button>
      </div>

      <!-- 来源类型 -->
      <div class="space-y-1.5">
        <p class="text-2xs text-ink-3">来源类型（可多选）</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="type in SOURCE_TYPE_OPTIONS"
            :key="type"
            type="button"
            class="px-1.5 py-0.5 text-2xs ring-1 ring-inset transition-colors"
            :class="
              props.selectedSourceTypes.includes(type)
                ? 'bg-seal text-seal-ink ring-seal-2'
                : 'bg-paper-3 text-ink-3 ring-rule hover:text-ink'
            "
            @click="emit('toggle-source-type', type)"
          >
            {{ sourceTypeLabel(type) }}
          </button>
        </div>
      </div>

      <!-- 可信度 -->
      <div class="space-y-1.5">
        <p class="text-2xs text-ink-3">可信度（可多选）</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="level in CREDIBILITY_OPTIONS"
            :key="level"
            type="button"
            class="px-1.5 py-0.5 text-2xs ring-1 ring-inset transition-colors"
            :class="
              props.selectedCredibility.includes(level)
                ? 'bg-seal text-seal-ink ring-seal-2'
                : 'bg-paper-3 text-ink-3 ring-rule hover:text-ink'
            "
            @click="emit('toggle-credibility', level)"
          >
            {{ CREDIBILITY_META[level].label }}
          </button>
        </div>
      </div>

      <!-- 排序与分页 -->
      <div class="grid grid-cols-2 gap-2">
        <label class="space-y-1">
          <span class="text-2xs text-ink-3">排序</span>
          <select
            :value="props.sort"
            class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
            @change="onSortChange"
          >
            <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-2xs text-ink-3">每页条数</span>
          <select
            :value="props.pageSize"
            class="h-8 w-full border border-rule bg-paper px-2 text-xs text-ink outline-none focus:border-seal-2"
            @change="onPageSizeChange"
          >
            <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
              {{ size }} 条
            </option>
          </select>
        </label>
      </div>

      <!-- AI 介入点 -->
      <div class="space-y-2 border border-seal-2 bg-seal px-2.5 py-2">
        <p class="text-2xs font-medium text-seal-ink">AI 检索增强（可干预）</p>
        <label class="flex items-center gap-2 text-2xs text-ink-2">
          <input
            :checked="props.enableQueryExpansion"
            type="checkbox"
            class="size-3.5 accent-seal-ink"
            @change="onExpansionChange"
          />
          智能扩展检索词（旧称、异写、专业术语）
        </label>
        <label class="flex items-center gap-2 text-2xs text-ink-2">
          <input
            :checked="props.enableReRank"
            type="checkbox"
            class="size-3.5 accent-seal-ink"
            @change="onReRankChange"
          />
          相关度重排（按可信度加权）
        </label>
        <p class="text-2xs leading-4 text-ink-4">
          扩展词会单独列出，可逐条采纳或忽略；关闭开关即完全退回纯关键词检索。
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-rule pt-2.5">
        <BaseButton variant="ghost" size="sm" :disabled="props.isBusy" @click="emit('clear-all')">
          清空筛选
        </BaseButton>
        <span class="text-2xs text-ink-4">
          已选
          {{
            props.selectedSourceTypes.length +
            props.selectedCredibility.length +
            props.entityFilterCount
          }}
          项过滤
        </span>
      </div>
    </div>
  </PanelSection>
</template>
