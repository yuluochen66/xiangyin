<script setup lang="ts">
/**
 * 状态胶囊。
 *
 * 印刷世界里的标记是「钤印 / 批注色块」：0 圆角、1px 界行、极浅的洗色。
 * 语义色只有三个（已核实 / 存疑 / 差异），其余一律走纸与墨。
 * 所有胶囊都带文字，因此状态不依赖颜色单独传达（色觉障碍可用）。
 */
import { computed } from 'vue'

export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet' | 'custom'

interface Props {
  tone?: PillTone
  /** tone='custom' 时使用的完整 class 串。 */
  customClass?: string
  /** 紧凑模式，用于列表内的次级标记。 */
  dense?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
  customClass: undefined,
  dense: false,
  title: undefined,
})

const TONE_CLASS: Record<Exclude<PillTone, 'custom'>, string> = {
  neutral: 'bg-paper-3 text-ink-3 ring-rule',
  /* info 与 violet 都落在钤印上：钤印是唯一的非语义强调 */
  info: 'bg-seal text-seal-ink ring-seal-2',
  violet: 'bg-seal text-seal-ink ring-seal-2',
  success: 'bg-verified-wash text-verified ring-verified',
  warning: 'bg-attention-wash text-attention ring-attention',
  danger: 'bg-vermilion-wash text-vermilion ring-vermilion',
}

const classes = computed(() => [
  'inline-flex items-center ring-1 ring-inset font-medium whitespace-nowrap',
  props.dense ? 'px-1 py-px text-2xs gap-0.5' : 'px-1.5 py-0.5 text-2xs gap-1',
  props.tone === 'custom' ? (props.customClass ?? TONE_CLASS.neutral) : TONE_CLASS[props.tone],
])
</script>

<template>
  <span :class="classes" :title="title"><slot /></span>
</template>
