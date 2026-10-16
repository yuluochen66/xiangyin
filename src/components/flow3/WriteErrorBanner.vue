<script setup lang="ts">
/**
 * 写操作失败统一提示条。
 *
 * 唯一职责：在任一写操作失败时提示「本地数据未被修改」，并在发起抽取失败时提供重试入口；
 * 是否显示、错误文案与重试动作全部由视图传入与处理。
 */
import BaseButton from '@/components/common/BaseButton.vue'

defineProps<{
  /** 错误文案；为 null 时不渲染任何内容。 */
  message: string | null
  /** 发起抽取任务是否处于失败态（决定是否展示重试入口）。 */
  startError: boolean
  /** 发起抽取任务进行中。 */
  startBusy: boolean
}>()

const emit = defineEmits<{ 'retry-start': [] }>()
</script>

<template>
  <div
    v-if="message"
    class="flex flex-wrap items-center gap-2 border border-vermilion bg-vermilion-wash px-3 py-2 text-2xs text-vermilion"
  >
    <span>写操作失败：{{ message }}（本地数据未被修改，可在原操作处重试）</span>
    <BaseButton
      v-if="startError"
      variant="ghost"
      size="sm"
      :loading="startBusy"
      @click="emit('retry-start')"
    >
      重试发起抽取
    </BaseButton>
  </div>
</template>
