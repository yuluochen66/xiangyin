<script setup lang="ts">
/**
 * 通用模态框。
 *
 * 用于「授权确认」「重复文件处理」「发布前最终确认」等需要阻断式决策的场景。
 * 遮罩是实心墨色（不用模糊），面板是校样纸：1px 界行、0 圆角、无阴影。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  open: boolean
  title: string
  /** 是否允许点击遮罩 / Esc 关闭。阻断式确认应传 false。 */
  dismissible?: boolean
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger'
  confirmDisabled?: boolean
  loading?: boolean
  widthClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  dismissible: true,
  confirmText: '确认',
  cancelText: '取消',
  confirmVariant: 'primary',
  confirmDisabled: false,
  loading: false,
  widthClass: 'max-w-lg',
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const panelEl = ref<HTMLElement | null>(null)

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.dismissible) emit('cancel')
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      document.addEventListener('keydown', handleKeydown)
      requestAnimationFrame(() => panelEl.value?.focus())
    } else {
      document.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (props.open) document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
        @click.self="dismissible && emit('cancel')"
      >
        <div
          ref="panelEl"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          class="sweep-in sheet plate-corner relative w-full border-rule-strong outline-none"
          :class="widthClass"
        >
          <header class="flex items-start justify-between gap-4 rule-b px-4 py-2.5">
            <h2 class="font-serif text-sm font-semibold tracking-tight text-ink">{{ title }}</h2>
            <button
              v-if="dismissible"
              type="button"
              class="-mr-1 cursor-pointer p-1 text-ink-4 transition-colors hover:text-ink"
              aria-label="关闭"
              @click="emit('cancel')"
            >
              <AppIcon name="close" :size="14" />
            </button>
          </header>

          <div class="scroll-area max-h-[65vh] overflow-y-auto px-4 py-3.5 text-sm text-ink-2">
            <slot />
          </div>

          <footer class="flex items-center justify-end gap-2 rule-t px-4 py-2.5">
            <slot name="footer-extra" />
            <BaseButton variant="ghost" :disabled="loading" @click="emit('cancel')">
              {{ cancelText }}
            </BaseButton>
            <BaseButton
              :variant="confirmVariant"
              :loading="loading"
              :disabled="confirmDisabled"
              @click="emit('confirm')"
            >
              {{ confirmText }}
            </BaseButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
