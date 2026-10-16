<script setup lang="ts">
/**
 * 需人工确认的状态提示条。
 *
 * 唯一职责：把 7 态状态机「confirm」这一态的提示内容（标题 / 说明 / 明细）
 * 渲染成阻断式提示条，并把确认或放弃的决定原样上抛。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { ConfirmPrompt } from '@/composables/useAsyncTask'

defineProps<{ prompt: ConfirmPrompt | null }>()

const emit = defineEmits<{
  confirm: []
  reject: []
}>()
</script>

<template>
  <div class="space-y-2 border border-attention bg-attention p-3.5">
    <p class="flex items-center gap-1.5 text-sm font-medium text-attention">
      <span aria-hidden="true"><AppIcon name="alert" :size="14" /></span>{{ prompt?.title }}
    </p>
    <p class="text-xs leading-5 text-attention">{{ prompt?.message }}</p>
    <ul v-if="prompt?.details" class="space-y-1">
      <li
        v-for="detail in prompt.details"
        :key="detail"
        class="bg-paper px-2.5 py-1 text-2xs text-attention"
      >
        {{ detail }}
      </li>
    </ul>
    <div class="flex flex-wrap items-center gap-2 pt-0.5">
      <BaseButton variant="primary" size="sm" @click="emit('confirm')">
        {{ prompt?.confirmText ?? '确认并继续' }}
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('reject')">
        {{ prompt?.cancelText ?? '放弃本次结果' }}
      </BaseButton>
    </div>
  </div>
</template>
