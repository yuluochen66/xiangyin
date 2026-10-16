<script setup lang="ts">
/**
 * 发布前最终确认弹窗。
 *
 * 唯一职责：以三项勾选（授权范围 / 引用标注 / 审核完成）做阻断式发布确认，
 * 并把确认 / 取消动作交回共享上下文；不参与任何校验规则的计算。
 */
import ModalDialog from '@/components/common/ModalDialog.vue'
import { usePublishFlowContext } from '@/composables/usePublishFlow'

const {
  publishConfirmOpen,
  confirmLicense,
  confirmCitation,
  confirmReviewed,
  confirmDisabled,
  publishBusy,
  doPublish,
} = usePublishFlowContext()
</script>

<template>
  <ModalDialog
    :open="publishConfirmOpen"
    title="发布前最终确认"
    :dismissible="true"
    confirm-text="确认发布"
    cancel-text="再看看"
    :confirm-disabled="confirmDisabled"
    :loading="publishBusy"
    @confirm="doPublish"
    @cancel="publishConfirmOpen = false"
  >
    <p class="text-xs leading-5 text-ink-2">请逐项确认以下内容，三项全部勾选后方可发布。</p>
    <div class="mt-3 space-y-2">
      <label
        class="flex cursor-pointer items-start gap-2 border p-2.5"
        :class="confirmLicense ? 'border-verified bg-verified-wash' : 'border-rule bg-paper'"
      >
        <input v-model="confirmLicense" type="checkbox" class="mt-0.5 size-3.5 accent-verified" />
        <span>
          <span class="block text-xs text-ink">授权范围已确认（confirmLicense）</span>
          <span class="mt-0.5 block text-2xs text-ink-4">
            本稿使用的采访与资料均在授权范围内，未超出「仅研究使用」等限制。
          </span>
        </span>
      </label>
      <label
        class="flex cursor-pointer items-start gap-2 border p-2.5"
        :class="confirmCitation ? 'border-verified bg-verified-wash' : 'border-rule bg-paper'"
      >
        <input v-model="confirmCitation" type="checkbox" class="mt-0.5 size-3.5 accent-verified" />
        <span>
          <span class="block text-xs text-ink">引用标注已确认（confirmCitation）</span>
          <span class="mt-0.5 block text-2xs text-ink-4">
            正文每条结论都有可追溯的角标，传说与个人记忆均以转述语气呈现。
          </span>
        </span>
      </label>
      <label
        class="flex cursor-pointer items-start gap-2 border p-2.5"
        :class="confirmReviewed ? 'border-verified bg-verified-wash' : 'border-rule bg-paper'"
      >
        <input v-model="confirmReviewed" type="checkbox" class="mt-0.5 size-3.5 accent-verified" />
        <span>
          <span class="block text-xs text-ink">审核已完成（confirmReviewed）</span>
          <span class="mt-0.5 block text-2xs text-ink-4">
            审核意见与风险处置已记录，风险项均已逐条确认知晓。
          </span>
        </span>
      </label>
    </div>
    <p v-if="confirmDisabled" class="mt-3 text-2xs text-attention">三项确认全部勾选后才能发布。</p>
  </ModalDialog>
</template>
