<script setup lang="ts">
/**
 * 流程 4 的低可信来源提示。
 *
 * 唯一职责：在「需人工确认」态渲染确认提示（标题 / 说明 / 风险明细 / 确认与放弃按钮），
 * 并在用户确认后渲染「已人工确认」的提示条；它不发请求，只把决定冒泡给主视图。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { ConfirmPrompt, TaskPhase } from '@/composables/useAsyncTask'

interface Props {
  phase: TaskPhase
  confirmPrompt: ConfirmPrompt | null
  riskAcknowledged: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{ respond: [decision: 'confirmed' | 'rejected'] }>()
</script>

<template>
  <!-- 需人工确认：低可信来源 -->
  <div
    v-if="props.phase === 'confirm' && props.confirmPrompt"
    class="space-y-2 border border-attention bg-attention p-3.5"
  >
    <p class="flex items-center gap-1.5 text-sm font-medium text-attention">
      <span aria-hidden="true"><AppIcon name="alert" :size="14" /></span
      >{{ props.confirmPrompt?.title }}
    </p>
    <p class="text-xs leading-5 text-attention">{{ props.confirmPrompt?.message }}</p>
    <ul v-if="props.confirmPrompt?.details" class="space-y-1">
      <li
        v-for="item in props.confirmPrompt?.details"
        :key="item"
        class="bg-paper px-2.5 py-1 text-2xs text-attention"
      >
        {{ item }}
      </li>
    </ul>
    <div class="flex flex-wrap items-center gap-2 pt-0.5">
      <BaseButton variant="primary" size="sm" @click="emit('respond', 'confirmed')">
        {{ props.confirmPrompt?.confirmText ?? '确认并继续' }}
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('respond', 'rejected')">
        {{ props.confirmPrompt?.cancelText ?? '放弃本次结果' }}
      </BaseButton>
      <span class="text-2xs text-attention">
        确认只表示「已知悉来源分级」，引用时仍需逐条核对原文。
      </span>
    </div>
  </div>

  <div
    v-else-if="props.riskAcknowledged"
    class="flex items-center gap-2 border border-verified bg-verified px-3 py-1.5 text-2xs text-verified"
  >
    <span aria-hidden="true"><AppIcon name="check" :size="14" /></span>
    <span>已人工确认本次命中包含低可信来源，列表中相关条目已标记，供后续引用时区分对待。</span>
  </div>
</template>
