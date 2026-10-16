<script setup lang="ts">
/**
 * 7 态渲染边界。
 *
 * 每个流程页面都用它包住内容区：成功时渲染默认插槽，其余 6 种状态由本组件统一提供。
 * 印刷世界的占位不用转圈、不用阴影方块：加载是「界行扫过 + 几道空白界行」，
 * 其余状态是一段带图标的说明文字加可执行的下一步。
 *
 * 所有状态都给出「下一步怎么办」，而不是只报错。
 */
import { computed } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import type { TaskPhase } from '@/composables/useAsyncTask'
import type { ApiError } from '@/services/api/errors'

interface Props {
  phase: TaskPhase
  error?: ApiError | null
  emptyTitle?: string
  emptyReason?: string
  emptySuggestion?: string
  unavailableReason?: string | null
  retryProgress?: { attempt: number; max: number } | null
  canRetry?: boolean
  loadingText?: string
  skeletonRows?: number
  minHeightClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  error: null,
  emptyTitle: '暂无数据',
  emptyReason: '',
  emptySuggestion: '',
  unavailableReason: null,
  retryProgress: null,
  canRetry: false,
  loadingText: '正在加载…',
  skeletonRows: 4,
  minHeightClass: 'min-h-[180px]',
})

const emit = defineEmits<{ retry: [] }>()

const showContent = computed(() => props.phase === 'success' || props.phase === 'confirm')

const CODE_LABEL: Record<string, string> = {
  network: '网络错误',
  timeout: '请求超时',
  auth: '登录失效',
  forbidden: '无权限',
  notFound: '资源不存在',
  validation: '参数不合法',
  business: '业务规则拒绝',
  server: '服务端错误',
  unavailable: '能力不可用',
  cancelled: '已取消',
  unknown: '未知错误',
}

const errorLabel = computed(() =>
  props.error ? (CODE_LABEL[props.error.code] ?? props.error.code) : '',
)
</script>

<template>
  <!-- 成功 / 需人工确认：渲染内容 -->
  <template v-if="showContent">
    <slot />
  </template>

  <!-- 未开始 -->
  <slot v-else-if="phase === 'idle'" name="idle">
    <div class="flex items-start gap-3 py-6" :class="minHeightClass">
      <AppIcon name="sheet" :size="18" class="mt-0.5 text-ink-4" />
      <div class="measure">
        <p class="text-sm font-medium text-ink">尚未执行</p>
        <p class="mt-1 text-xs leading-5 text-ink-3">
          点击操作后，结果会在此区域就地呈现，不会跳页。
        </p>
        <div class="mt-3"><slot name="idle-actions" /></div>
      </div>
    </div>
  </slot>

  <!-- 加载中 / 重试中 -->
  <slot v-else-if="phase === 'loading' || phase === 'retrying'" name="loading">
    <div class="py-6" :class="minHeightClass">
      <p class="flex items-baseline gap-2 font-mono text-2xs text-ink-3">
        <span>{{ phase === 'retrying' ? '重试中' : loadingText }}</span>
        <span v-if="retryProgress"
          >第 {{ retryProgress.attempt }} / {{ retryProgress.max }} 次</span
        >
      </p>
      <div class="mt-4 space-y-2.5" aria-hidden="true">
        <div
          v-for="row in skeletonRows"
          :key="row"
          class="h-px bg-rule"
          :style="{ width: `${100 - (row % 3) * 16}%` }"
        />
      </div>
    </div>
  </slot>

  <!-- 空数据 -->
  <slot v-else-if="phase === 'empty'" name="empty">
    <div class="flex items-start gap-3 py-6" :class="minHeightClass">
      <AppIcon name="folder" :size="18" class="mt-0.5 text-ink-4" />
      <div class="measure">
        <p class="text-sm font-medium text-ink">{{ emptyTitle }}</p>
        <p v-if="emptyReason" class="mt-1 text-xs leading-5 text-ink-3">{{ emptyReason }}</p>
        <p v-if="emptySuggestion" class="mt-1 text-xs leading-5 text-ink-4">
          建议：{{ emptySuggestion }}
        </p>
        <div class="mt-3"><slot name="empty-actions" /></div>
      </div>
    </div>
  </slot>

  <!-- 不可用 -->
  <slot v-else-if="phase === 'unavailable'" name="unavailable">
    <div class="flex items-start gap-3 py-6" :class="minHeightClass">
      <AppIcon name="ban" :size="18" class="mt-0.5 text-vermilion" />
      <div class="measure">
        <p class="text-sm font-medium text-ink">该能力当前不可用</p>
        <p class="mt-1 text-xs leading-5 text-ink-3">
          {{ unavailableReason || '服务未部署或已下线，重试不会成功。' }}
        </p>
        <p class="mt-1 text-xs leading-5 text-ink-4">
          处理方式：确认后端能力开关，或改用人工方式继续该流程。
        </p>
        <div class="mt-3"><slot name="unavailable-actions" /></div>
      </div>
    </div>
  </slot>

  <!-- 失败 -->
  <slot v-else name="error">
    <div class="flex items-start gap-3 py-6" :class="minHeightClass">
      <AppIcon name="alert" :size="18" class="mt-0.5 text-vermilion" />
      <div class="measure">
        <p class="flex flex-wrap items-baseline gap-2">
          <span class="font-mono text-2xs tracking-wide text-vermilion">{{ errorLabel }}</span>
          <span class="text-sm font-medium text-ink">{{
            error?.displayMessage || '请求失败'
          }}</span>
        </p>
        <p class="mt-1 text-xs leading-5 text-ink-3">
          {{ canRetry ? '该错误可以重试。' : '该错误重试不会成功，请按提示处理后继续。' }}
        </p>
        <p v-if="error?.traceId" class="mt-1 font-mono text-2xs text-ink-4">
          traceId {{ error.traceId }}
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-1.5">
          <BaseButton v-if="canRetry" variant="primary" size="sm" @click="emit('retry')"
            >重试</BaseButton
          >
          <slot name="error-actions" />
        </div>
      </div>
    </div>
  </slot>
</template>
