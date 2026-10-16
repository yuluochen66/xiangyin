<script setup lang="ts">
/**
 * AI 风险提醒面板。
 *
 * 唯一职责：触发并呈现 AI 风险检查的 7 态结果（含严重风险人工确认弹层、汇总等级、
 * 阻断原因与人工逐条核对兜底），风险项本身由 RiskItemCard 渲染；
 * 接口调用与发布前校验由共享上下文负责。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import RiskItemCard from '@/components/flow7/RiskItemCard.vue'
import { formatTime, usePublishFlowContext } from '@/composables/usePublishFlow'
import { OVERALL_LEVEL_META } from '@/composables/usePublishRiskCheck'

const {
  risks,
  overallLevel,
  publishable,
  blockers,
  riskCheckedAt,
  riskUnavailableManual,
  manualCheckAck,
  riskState,
  riskBusy,
  riskCanRetry,
  doRiskCheck,
  respondRiskConfirmDecision,
  useManualRiskReview,
  goToFlow,
} = usePublishFlowContext()
</script>

<template>
  <PanelSection
    title="AI 风险提醒"
    description="点击按钮触发 risk-check；每条风险可勾选「已确认知晓」，提交审核意见时会一并带上。"
  >
    <template #actions>
      <BaseButton size="sm" variant="primary" :loading="riskBusy" @click="doRiskCheck(false)">
        AI 风险检查
      </BaseButton>
    </template>

    <AsyncStateBoundary
      :phase="riskState.phase"
      :error="riskState.error"
      :can-retry="riskCanRetry"
      :retry-progress="riskState.retryProgress"
      empty-title="未发现风险项"
      :empty-reason="riskState.emptyHint?.reason"
      :empty-suggestion="riskState.emptyHint?.suggestion"
      :unavailable-reason="riskState.unavailableReason"
      loading-text="正在逐条核对授权、引用与敏感内容…"
      :skeleton-rows="5"
      min-height-class="min-h-[200px]"
      @retry="doRiskCheck(true)"
    >
      <template #default>
        <!-- 需人工确认 -->
        <div
          v-if="riskState.phase === 'confirm' && riskState.confirmPrompt"
          class="mb-3 border border-vermilion bg-vermilion-wash p-3"
        >
          <div class="flex items-center gap-2">
            <span aria-hidden="true"><AppIcon name="alert" :size="16" /></span>
            <p class="text-sm font-medium text-vermilion">
              {{ riskState.confirmPrompt?.title }}
            </p>
          </div>
          <p class="mt-1 text-xs leading-5 text-vermilion">
            {{ riskState.confirmPrompt?.message }}
          </p>
          <ul
            v-if="(riskState.confirmPrompt?.details?.length ?? 0) > 0"
            class="mt-2 list-disc space-y-1 pl-5 text-2xs leading-4 text-vermilion"
          >
            <li v-for="(detail, index) in riskState.confirmPrompt?.details ?? []" :key="index">
              {{ detail }}
            </li>
          </ul>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <BaseButton
              size="sm"
              variant="primary"
              @click="respondRiskConfirmDecision('confirmed')"
            >
              {{ riskState.confirmPrompt?.confirmText ?? '确认知晓' }}
            </BaseButton>
            <BaseButton size="sm" variant="ghost" @click="respondRiskConfirmDecision('rejected')">
              {{ riskState.confirmPrompt?.cancelText ?? '返回核对' }}
            </BaseButton>
          </div>
        </div>

        <!-- 汇总 -->
        <div class="flex flex-wrap items-center gap-1.5">
          <StatusPill
            :tone="overallLevel ? OVERALL_LEVEL_META[overallLevel].tone : 'neutral'"
            dense
          >
            {{ overallLevel ? OVERALL_LEVEL_META[overallLevel].label : '尚未检查' }}
          </StatusPill>
          <StatusPill
            :tone="publishable === false ? 'danger' : publishable === true ? 'success' : 'neutral'"
            dense
          >
            {{
              publishable === null
                ? '尚未判定能否发布'
                : publishable
                  ? 'AI 判定可发布'
                  : 'AI 判定不可直接发布'
            }}
          </StatusPill>
          <span class="text-2xs text-ink-4">风险 {{ risks.length }} 条</span>
          <span v-if="riskCheckedAt" class="text-2xs text-ink-4">
            · 检查于 {{ formatTime(riskCheckedAt) }}
          </span>
        </div>

        <!-- 阻断原因 -->
        <div
          v-if="blockers.length > 0"
          class="mt-2 border border-vermilion bg-vermilion-wash p-2.5"
        >
          <p class="text-2xs font-medium text-vermilion">
            发布阻断项（publishable = false，发布按钮已禁用）
          </p>
          <ul class="mt-1 list-disc space-y-0.5 pl-5 text-2xs leading-4 text-vermilion">
            <li v-for="(blocker, index) in blockers" :key="index">{{ blocker }}</li>
          </ul>
          <BaseButton class="mt-2" size="sm" variant="ghost" @click="goToFlow(5)">
            去流程 5 完成一致性标注
          </BaseButton>
        </div>

        <!-- 风险项 -->
        <ul class="mt-2 space-y-2">
          <RiskItemCard
            v-for="risk in risks"
            :key="risk.id"
            :risk="risk"
            @acknowledge="risk.acknowledged = !risk.acknowledged"
          />
        </ul>
      </template>

      <template #idle-actions>
        <BaseButton variant="primary" :loading="riskBusy" @click="doRiskCheck(false)">
          开始 AI 风险检查
        </BaseButton>
      </template>
      <template #empty-actions>
        <BaseButton size="sm" variant="primary" :loading="riskBusy" @click="doRiskCheck(false)">
          重新检查
        </BaseButton>
      </template>
      <template #unavailable-actions>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <BaseButton variant="primary" size="sm" @click="useManualRiskReview">
            转为人工逐条核对
          </BaseButton>
          <BaseButton variant="ghost" size="sm" :loading="riskBusy" @click="doRiskCheck(true)">
            重试
          </BaseButton>
        </div>
      </template>
      <template #error-actions>
        <BaseButton variant="ghost" size="sm" @click="useManualRiskReview">改走人工核对</BaseButton>
      </template>
    </AsyncStateBoundary>

    <!-- 风险检查不可用时的人工兜底 -->
    <div v-if="riskUnavailableManual" class="mt-3 border border-attention bg-attention-wash p-3">
      <p class="text-xs font-medium text-attention">人工逐条核对模式</p>
      <p class="mt-1 text-2xs leading-4 text-attention">
        风险检查服务不可用。请人工核对授权范围、引用标注与敏感内容；
        发布前的三项最终确认仍然必须全部勾选，流程不会被卡死。
      </p>
      <label class="mt-2 flex items-center gap-1.5 text-2xs text-attention">
        <input v-model="manualCheckAck" type="checkbox" class="size-3.5 accent-attention" />
        我已人工逐条核对完毕，愿承担相应审核责任
      </label>
    </div>
  </PanelSection>
</template>
