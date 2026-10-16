<script setup lang="ts">
/**
 * 发布前最终确认面板。
 *
 * 唯一职责：逐条列出当前不能发布的原因、提供发布入口，并在发布成功后展示回执字段；
 * 发布校验与接口调用由共享上下文负责。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import { formatTime, usePublishFlowContext } from '@/composables/usePublishFlow'

const {
  publishBlockReasons,
  canPublish,
  publishBusy,
  publishState,
  publishedResult,
  openPublishConfirm,
} = usePublishFlowContext()
</script>

<template>
  <PanelSection
    title="发布前最终确认"
    description="三项确认缺一不可；前置条件未满足时发布按钮禁用，并在下方逐条说明原因。"
  >
    <div class="space-y-2">
      <div
        v-if="publishBlockReasons.length > 0"
        class="border border-attention bg-attention-wash p-2.5"
      >
        <p class="text-2xs font-medium text-attention">当前不能发布的原因</p>
        <ul class="mt-1 list-disc space-y-0.5 pl-5 text-2xs leading-4 text-attention">
          <li v-for="(reason, index) in publishBlockReasons" :key="index">{{ reason }}</li>
        </ul>
      </div>
      <div v-else class="border border-verified bg-verified-wash p-2.5 text-2xs text-verified">
        前置条件已满足，可进入发布前最终确认。
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <BaseButton
          variant="primary"
          :disabled="!canPublish"
          :loading="publishBusy"
          @click="openPublishConfirm"
        >
          发布
        </BaseButton>
        <span class="text-2xs text-ink-4">接口：POST /contents/{contentId}/publish</span>
      </div>
      <p v-if="publishState.error" class="text-2xs text-vermilion">
        发布失败：{{ publishState.error.displayMessage }}
      </p>

      <div v-if="publishedResult" class="border border-verified bg-verified-wash p-3">
        <p class="text-sm font-medium text-verified">已发布到对外地址</p>
        <dl class="mt-2 space-y-1 text-2xs">
          <div class="flex items-start justify-between gap-2">
            <dt class="text-ink-3">publishedUrl</dt>
            <dd class="break-all font-mono text-verified">
              {{ publishedResult.publishedUrl }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-ink-3">visibility</dt>
            <dd class="text-ink">
              {{ publishedResult.visibility === 'public' ? '公开可见' : '仅内部可见' }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-ink-3">certificateNo</dt>
            <dd class="font-mono text-ink">{{ publishedResult.certificateNo ?? '—' }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-ink-3">publishedAt</dt>
            <dd class="text-ink">{{ formatTime(publishedResult.publishedAt) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-ink-3">versionNo</dt>
            <dd class="text-ink">v{{ publishedResult.versionNo }}</dd>
          </div>
        </dl>
      </div>

      <p class="text-2xs leading-4 text-ink-4">
        发布接口只写状态与版本；授权范围决定对外可见性（本演示中由采访授权类型推导，待确认后端字段）。
      </p>
    </div>
  </PanelSection>
</template>
