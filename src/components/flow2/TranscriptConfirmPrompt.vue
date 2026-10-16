<script setup lang="ts">
/**
 * 流程 2：需人工确认（confirm 态）的提示块。
 *
 * 唯一职责：展示状态机给出的确认标题、说明与低置信度明细，
 * 并把「确认 / 放弃」两个决定向上转发；不自行判断是否需要确认。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { ConfirmPrompt } from '@/composables/useAsyncTask'

interface Props {
  /** 状态机给出的确认提示内容。 */
  prompt: ConfirmPrompt
}

defineProps<Props>()

const emit = defineEmits<{
  confirm: []
  reject: []
}>()
</script>

<template>
  <div class="border border-attention bg-attention p-5">
    <div class="flex items-start gap-3">
      <span aria-hidden="true"><AppIcon name="scales" :size="20" /></span>
      <div class="min-w-0 space-y-2">
        <p class="text-sm font-medium text-attention">{{ prompt.title }}</p>
        <p class="text-xs leading-5 text-attention">{{ prompt.message }}</p>
        <ul v-if="prompt.details" class="list-disc space-y-0.5 pl-4 text-2xs text-attention">
          <li v-for="(detail, index) in prompt.details" :key="index">
            {{ detail }}
          </li>
        </ul>
        <p class="text-2xs text-attention">
          确认后进入成功态并展示校正工作台；放弃则回到空状态，可重新发起或改人工听录。
        </p>
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <BaseButton variant="primary" size="sm" @click="emit('confirm')">
            {{ prompt.confirmText ?? '确认' }}
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="emit('reject')">
            {{ prompt.cancelText ?? '放弃' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
