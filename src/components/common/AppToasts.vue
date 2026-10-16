<script setup lang="ts">
/**
 * 全局提示条。
 *
 * 形态是「勘误条」：纸面 + 1px 界行 + 一个描边图标，不用彩色整块背景、
 * 不用模糊、不用阴影。图标与文字共同承担语义，颜色只是辅助。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import type { IconName } from '@/components/common/AppIcon.vue'
import { useAppShell } from '@/composables/useAppShell'
import type { NoticeLevel } from '@/composables/useAppShell'

const { notices, dismissNotice } = useAppShell()

const LEVEL_META: Record<NoticeLevel, { icon: IconName; text: string; rule: string }> = {
  info: { icon: 'info', text: 'text-seal-ink', rule: 'border-l-seal-2' },
  success: { icon: 'check', text: 'text-verified', rule: 'border-l-verified' },
  warning: { icon: 'alert', text: 'text-attention', rule: 'border-l-attention' },
  error: { icon: 'ban', text: 'text-vermilion', rule: 'border-l-vermilion' },
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-96 flex-col gap-2">
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-for="notice in notices"
          :key="notice.id"
          class="sweep-in pointer-events-auto flex items-start gap-2.5 border border-rule bg-sheet px-3 py-2.5"
        >
          <AppIcon
            :name="LEVEL_META[notice.level].icon"
            :size="14"
            class="mt-0.5"
            :class="LEVEL_META[notice.level].text"
          />
          <div class="min-w-0 flex-1">
            <p class="text-xs leading-5 text-ink">{{ notice.text }}</p>
            <p v-if="notice.detail" class="mt-0.5 text-2xs leading-4 text-ink-3">
              {{ notice.detail }}
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 cursor-pointer p-0.5 text-ink-4 transition-colors hover:text-ink"
            aria-label="关闭提示"
            @click="dismissNotice(notice.id)"
          >
            <AppIcon name="close" :size="12" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
