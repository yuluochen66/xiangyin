<script setup lang="ts">
/**
 * 通用按钮。
 *
 * 印刷世界的控件是「印上去的矩形」：0 圆角、1px 界行、按下不加阴影。
 * 加载态用下划线扫过而不是转圈——转圈属于仪表盘，不属于校样纸。
 */
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  /** 加载中：显示下划线扫过并阻断点击，但不改变按钮宽度。 */
  loading?: boolean
  type?: 'button' | 'submit'
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button',
  title: undefined,
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  /* 主操作 = 实心墨块 */
  primary: 'bg-ink text-sheet hover:bg-ink-2',
  /* 次操作 = 纸面 + 界行 */
  secondary: 'bg-sheet text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper-3',
  ghost: 'bg-transparent text-ink-2 hover:bg-paper-3 hover:text-ink',
  /* 危险 = 朱（只用于驳回 / 删除 / 不可逆操作） */
  danger: 'bg-vermilion text-sheet hover:opacity-90',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-6 px-2 text-2xs gap-1',
  md: 'h-7 px-2.5 text-xs gap-1.5',
}

const isBlocked = computed(() => props.disabled || props.loading)

const classes = computed(() => [
  'relative inline-flex items-center justify-center font-medium',
  'cursor-pointer transition-colors duration-100',
  'disabled:cursor-not-allowed disabled:opacity-55',
  VARIANT_CLASS[props.variant],
  SIZE_CLASS[props.size],
  props.loading ? 'pending-underline' : '',
])

function handleClick(event: MouseEvent): void {
  if (isBlocked.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    :title="title"
    :disabled="disabled"
    :aria-busy="loading"
    :class="classes"
    @click="handleClick"
  >
    <slot />
  </button>
</template>
