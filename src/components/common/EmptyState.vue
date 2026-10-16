<script setup lang="ts">
/** 空状态占位。统一「无数据 / 无搜索结果 / 未执行」三类空场景。 */
import AppIcon from '@/components/common/AppIcon.vue'
import type { IconName } from '@/components/common/AppIcon.vue'

interface Props {
  icon?: IconName
  title: string
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'sheet',
  description: undefined,
})
</script>

<template>
  <div class="measure flex items-start gap-3 py-6">
    <AppIcon :name="props.icon" :size="18" class="mt-0.5 text-ink-4" />
    <div class="min-w-0">
      <p class="text-sm font-medium text-ink">{{ props.title }}</p>
      <p v-if="props.description" class="mt-1 text-xs leading-5 text-ink-3">
        {{ props.description }}
      </p>
      <slot />
    </div>
  </div>
</template>
