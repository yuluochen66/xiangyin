<script setup lang="ts">
/**
 * 流程页头部，按「版心」组织：道次 + 标题 + 说明构成主栏，
 * 状态条与涉及的接口构成下栏，两栏之间是一道通栏界行。
 *
 * 刻意不用 kicker/eyebrow 式的小标签压在大标题上方——那是模板化的第一征兆；
 * 道次编号是真实顺序信息（7 道工序），所以保留，并以等宽小字排在大标题之前同一行。
 */
import PhaseStrip from '@/components/common/PhaseStrip.vue'
import { useAppShell } from '@/composables/useAppShell'
import type { TaskPhase } from '@/composables/useAsyncTask'

/** 端点列表属于接口内容，只在开发者开关打开时出现。 */
const { devOpen } = useAppShell()

interface Props {
  step: number
  title: string
  description: string
  phase: TaskPhase
  attempts?: number
  /** 本流程涉及的接口（数据交互节点）。 */
  endpoints?: string[]
}

const props = withDefaults(defineProps<Props>(), { attempts: 0, endpoints: () => [] })
</script>

<template>
  <header class="rule-b pb-3">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="meta">流程 {{ props.step }} / 7</span>
          <h1 class="font-serif text-xl font-semibold tracking-tight text-ink">{{ title }}</h1>
        </div>
        <p class="measure mt-1.5 text-xs leading-5 text-ink-3">{{ description }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <PhaseStrip :phase="phase" :attempts="attempts" />
      <div
        v-if="devOpen && endpoints.length > 0"
        class="flex flex-wrap items-center gap-x-2 gap-y-1"
      >
        <span class="meta">数据交互节点</span>
        <code
          v-for="endpoint in endpoints"
          :key="endpoint"
          class="border-b border-rule font-mono text-2xs text-ink-3"
        >
          {{ endpoint }}
        </code>
      </div>
    </div>
  </header>
</template>
