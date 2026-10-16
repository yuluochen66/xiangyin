<script setup lang="ts">
/**
 * 标注进度面板。
 *
 * 唯一职责：展示比对任务的进度——进度条、7 张统计卡、服务端统计说明与筛选按钮，
 * 并把筛选模式的切换交给父级（v-model:filter-mode）。
 */
import { computed } from 'vue'

import PanelSection from '@/components/common/PanelSection.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { annotationFilterCount, FILTER_OPTIONS, statCardsOf } from '@/composables/useComparisonMeta'
import type { AnnotationFilterMode } from '@/composables/useComparisonMeta'
import type { AiMeta, AnnotationStats } from '@/types/api'

interface Props {
  /** 比对任务 id。 */
  comparisonId: string
  /** 待比对的草稿 id。 */
  draftId: string
  /** 标注人姓名。 */
  annotatorName: string
  /** AI 元信息，未拿到结果时为空。 */
  aiMeta: AiMeta | null | undefined
  /** 服务端统计，未拿到结果时为空。 */
  serverStats: AnnotationStats | null
  /** 比对任务自身的状态（running / failed 时在标题右侧提示）。 */
  taskStatus: 'succeeded' | 'running' | 'failed' | undefined
  /** 比对失败原因。 */
  failureReason: string | undefined
  /** 界面上的实时统计（由草稿推导）。 */
  liveStats: AnnotationStats
  /** 本次变更条数。 */
  dirtyCount: number
}

const props = defineProps<Props>()

const filterMode = defineModel<AnnotationFilterMode>('filterMode', { required: true })

const statCards = computed(() => statCardsOf(props.liveStats))

/**
 * 某个筛选模式下的条数。
 * @param mode 筛选模式
 * @returns 该模式应展示的条数
 */
function filterCount(mode: AnnotationFilterMode): number {
  return annotationFilterCount(mode, props.liveStats)
}
</script>

<template>
  <PanelSection
    title="标注进度"
    :description="`比对任务 ${comparisonId} · 草稿 ${draftId} · 标注人 ${annotatorName}`"
  >
    <template #actions>
      <StatusPill v-if="aiMeta" tone="violet" dense
        >{{ aiMeta.model }} · {{ aiMeta.modelVersion }}</StatusPill
      >
      <StatusPill v-if="aiMeta" tone="neutral" dense>AI 耗时 {{ aiMeta.tookMs }} ms</StatusPill>
      <StatusPill v-if="serverStats" tone="info" dense>
        服务端已记录 {{ serverStats.annotated }} / {{ serverStats.total }}
      </StatusPill>
      <StatusPill v-if="taskStatus === 'running'" tone="warning" dense>比对进行中</StatusPill>
      <StatusPill v-else-if="taskStatus === 'failed'" tone="danger" dense>
        比对失败{{ failureReason ? `：${failureReason}` : '' }}
      </StatusPill>
    </template>

    <div class="space-y-3">
      <ProgressBar
        :progress="liveStats.progress"
        :label="`标注进度（${liveStats.annotated} / ${liveStats.total}）`"
        :tone="
          liveStats.total > 0 && liveStats.annotated === liveStats.total ? 'success' : 'normal'
        "
      />

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <div
          v-for="card in statCards"
          :key="card.label"
          class="border border-rule bg-paper px-2.5 py-1.5"
        >
          <p class="text-2xs text-ink-4">{{ card.label }}</p>
          <p class="text-sm font-semibold" :class="card.className">{{ card.value }}</p>
        </div>
      </div>

      <p class="text-2xs leading-4 text-ink-4">
        服务端统计（最近一次读取 / 提交后）：已标注 {{ serverStats?.annotated ?? 0 }} 条 · 与 AI
        初判不一致 {{ serverStats?.disagreedWithAi ?? 0 }} 条，用于评估 AI 初判质量；
        界面上的实时数字由当前草稿推导（待确认 TODO-CMP-2）。
      </p>

      <div class="flex flex-wrap items-center gap-1.5 border-t border-rule pt-2.5">
        <button
          v-for="option in FILTER_OPTIONS"
          :key="option.value"
          type="button"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-2xs ring-1 ring-inset transition-colors"
          :class="
            filterMode === option.value
              ? 'bg-seal text-seal-ink ring-seal-2'
              : 'bg-paper-3 text-ink-3 ring-rule hover:text-ink'
          "
          @click="filterMode = option.value"
        >
          {{ option.label }}
          <span class="font-mono text-ink-4">{{ filterCount(option.value) }}</span>
        </button>
        <span class="ml-auto text-2xs text-ink-4">本次变更 {{ dirtyCount }} 条</span>
      </div>
    </div>
  </PanelSection>
</template>
