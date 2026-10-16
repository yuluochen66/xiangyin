<script setup lang="ts">
/**
 * 「需人工确认」提示块。
 *
 * 唯一职责：渲染状态机给出的 confirmPrompt（标题、说明、逐条细节、确认 / 取消按钮文案），
 * 并把两个决策原样抛出；是否渲染由视图依据 7 态状态机决定。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { ConfirmPrompt } from '@/composables/useAsyncTask'

defineProps<{ prompt: ConfirmPrompt | null }>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div v-if="prompt" class="border border-attention bg-attention p-5">
    <div class="flex items-start gap-3">
      <span aria-hidden="true"><AppIcon name="pushpin" :size="20" /></span>
      <div class="min-w-0 space-y-2">
        <p class="text-sm font-medium text-attention">{{ prompt.title }}</p>
        <p class="text-xs leading-5 text-attention">{{ prompt.message }}</p>
        <ul v-if="prompt.details" class="list-disc space-y-0.5 pl-4 text-2xs text-attention">
          <li v-for="(detail, index) in prompt.details" :key="index">
            {{ detail }}
          </li>
        </ul>
        <p class="text-2xs text-attention">
          确认后进入成功态并展示实体卡片；暂不处理则回到空状态，可重新抽取或手工录入。
        </p>
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <BaseButton variant="primary" size="sm" @click="emit('confirm')">
            {{ prompt.confirmText ?? '确认' }}
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="emit('cancel')">
            {{ prompt.cancelText ?? '暂不处理' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
