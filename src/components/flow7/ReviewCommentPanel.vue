<script setup lang="ts">
/**
 * 审核意见面板。
 *
 * 唯一职责：收集审核意见文本、展示审核人身份与风险确认进度，
 * 触发「审核通过 / 驳回」两个提交动作；请求体组装与接口调用由共享上下文负责。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import { usePublishFlowContext } from '@/composables/usePublishFlow'
import { REVIEWER_OPERATOR } from '@/mock/dataset'

const { reviewCommentText, commentState, commentBusy, risks, submitReviewDecision } =
  usePublishFlowContext()
</script>

<template>
  <PanelSection
    title="审核意见"
    description="对应 POST /contents/{contentId}/review-comments；风险项的确认结果会一并提交。"
  >
    <div class="space-y-3">
      <label class="block">
        <span class="mb-1 block text-2xs font-medium text-ink-3">
          审核意见 comment（驳回时必填）
        </span>
        <textarea
          v-model="reviewCommentText"
          rows="3"
          class="w-full border border-rule bg-paper px-2.5 py-1.5 text-xs text-ink outline-none focus:border-seal-2"
          placeholder="例如：第 3 段「闽王建塔得名」仍以传说作结论，请改为转述语气并补注《闽都别记》为传闻辑录。"
        ></textarea>
      </label>
      <p class="text-2xs text-ink-4">
        审核人：{{ REVIEWER_OPERATOR.name }}（{{ REVIEWER_OPERATOR.role }}） · 已勾选知晓的风险
        {{ risks.filter((risk) => risk.acknowledged).length }} / {{ risks.length }} 条
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <BaseButton
          size="sm"
          variant="primary"
          :loading="commentBusy"
          :disabled="commentBusy"
          @click="submitReviewDecision('approved')"
        >
          审核通过
        </BaseButton>
        <BaseButton
          size="sm"
          variant="danger"
          :loading="commentBusy"
          :disabled="commentBusy || reviewCommentText.trim().length === 0"
          @click="submitReviewDecision('rejected')"
        >
          驳回
        </BaseButton>
        <span class="text-2xs text-ink-4">接口：POST /contents/{contentId}/review-comments</span>
      </div>
      <p v-if="commentState.error" class="text-2xs text-vermilion">
        提交审核意见失败：{{ commentState.error.displayMessage }}
      </p>
    </div>
  </PanelSection>
</template>
