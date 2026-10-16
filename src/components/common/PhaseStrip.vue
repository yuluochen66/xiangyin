<script setup lang="ts">
/**
 * 状态条：把 7 种界面状态列为可核验的清单，高亮当前状态。
 *
 * 作用有两个：
 * 1. 开发与联调时一眼看出当前处于哪个状态；
 * 2. 验收时可直接对照「每个流程必须区分 7 种状态」逐项核验。
 *
 * 它是核验工具，不是装饰，所以用最小的排版手段表达：等宽小标签 +
 * 当前项的一道实心下划线。颜色只做辅助，形状与文字承担区分。
 */
import { computed } from 'vue'

import type { TaskPhase } from '@/composables/useAsyncTask'

interface Props {
  phase: TaskPhase
  attempts?: number
}

const props = withDefaults(defineProps<Props>(), { attempts: 0 })

const PHASES: ReadonlyArray<{ value: TaskPhase; label: string }> = [
  { value: 'idle', label: '未开始' },
  { value: 'loading', label: '加载中' },
  { value: 'retrying', label: '重试中' },
  { value: 'success', label: '成功' },
  { value: 'empty', label: '空数据' },
  { value: 'confirm', label: '需确认' },
  { value: 'unavailable', label: '不可用' },
  { value: 'error', label: '失败' },
]

const activeIndex = computed(() => PHASES.findIndex((item) => item.value === props.phase))
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-2.5 gap-y-1"
    role="status"
    :aria-label="`当前状态：${phase}`"
  >
    <span class="meta">状态机</span>
    <span
      v-for="(item, index) in PHASES"
      :key="item.value"
      class="inline-flex items-baseline gap-1 border-b pb-px font-mono text-2xs"
      :class="index === activeIndex ? 'border-ink text-ink' : 'border-transparent text-ink-4'"
    >
      {{ item.label }}
      <span v-if="item.value === 'retrying' && attempts > 0" class="text-ink-4"
        >×{{ attempts }}</span
      >
    </span>
  </div>
</template>
