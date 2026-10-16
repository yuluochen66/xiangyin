<script setup lang="ts">
/** JSON 预览块，用于展示 mock 数据 / 响应样例。 */
import { computed, ref } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  value: unknown
  label?: string
  /** 折叠时展示的最大行数。 */
  collapsedLines?: number
  maxHeightClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: 'mock 数据样例',
  collapsedLines: 12,
  maxHeightClass: 'max-h-72',
})

const expanded = ref(false)
const copied = ref(false)

const text = computed(() => JSON.stringify(props.value, null, 2))
const lines = computed(() => text.value.split('\n'))
const visibleText = computed(() =>
  expanded.value ? text.value : lines.value.slice(0, props.collapsedLines).join('\n'),
)
const truncated = computed(() => lines.value.length > props.collapsedLines)

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div class="border border-rule bg-paper">
    <div class="flex items-center justify-between gap-2 border-b border-rule px-2.5 py-1.5">
      <span class="text-2xs text-ink-3">{{ props.label }}</span>
      <div class="flex items-center gap-1">
        <BaseButton v-if="truncated" variant="ghost" size="sm" @click="expanded = !expanded">
          {{ expanded ? '收起' : `展开（${lines.length} 行）` }}
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="copy">
          {{ copied ? '已复制' : '复制' }}
        </BaseButton>
      </div>
    </div>
    <pre
      class="scroll-area overflow-auto px-3 py-2 font-mono text-2xs leading-4 text-ink-2"
      :class="maxHeightClass"
      >{{ visibleText }}</pre>
  </div>
</template>
