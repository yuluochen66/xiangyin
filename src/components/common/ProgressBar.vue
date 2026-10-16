<script setup lang="ts">
/** 进度条。印刷世界的进度就是一道界行的填充，不用圆角与阴影。 */
import { computed } from 'vue'

import { formatDurationText } from '@/utils/format'

interface Props {
  progress: number
  remainingMs?: number | null
  label?: string
  tone?: 'normal' | 'success' | 'danger' | 'warning'
  showPercent?: boolean
  indeterminate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  remainingMs: null,
  label: '',
  tone: 'normal',
  showPercent: true,
  indeterminate: false,
})

const percent = computed(() => Math.min(100, Math.max(0, props.progress * 100)))

const TONE_CLASS: Record<NonNullable<Props['tone']>, string> = {
  normal: 'bg-ink',
  success: 'bg-verified',
  danger: 'bg-vermilion',
  warning: 'bg-attention',
}

const remainingText = computed(() => {
  if (props.progress >= 1) return '已完成'
  if (props.remainingMs === null || props.remainingMs === undefined) return '剩余时间估算中'
  return `剩余约 ${formatDurationText(props.remainingMs)}`
})
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-baseline justify-between gap-3">
      <span class="text-2xs text-ink-3">{{ label }}</span>
      <span class="flex items-baseline gap-3">
        <span class="meta">{{ remainingText }}</span>
        <span v-if="showPercent" class="font-mono text-xs tabular-nums text-ink">
          {{ percent.toFixed(1) }}%
        </span>
      </span>
    </div>
    <div
      class="h-px w-full bg-rule"
      role="progressbar"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <!-- 不确定进度用静止斜纹表达「在进行」，不用脉冲：脉冲是第二处动效 -->
      <div v-if="indeterminate" class="pending-line w-full" aria-hidden="true" />
      <div
        v-else
        class="h-px transition-[width] duration-300 ease-out"
        :class="TONE_CLASS[tone]"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>
