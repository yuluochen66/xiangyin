<script setup lang="ts">
/**
 * 版本记录与回滚面板。
 *
 * 唯一职责：以 AsyncStateBoundary 渲染版本记录列表、标记当前版本、
 * 展示版本状态与风险等级，并触发回滚目标选择；接口调用与回滚逻辑由共享上下文负责。
 */
import { PUBLISH_STATUS_META } from '@/api'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { formatTime, usePublishFlowContext } from '@/composables/usePublishFlow'
import { RISK_SCORE_LABEL } from '@/composables/usePublishRiskCheck'

const {
  versions,
  currentVersionId,
  versionState,
  versionBusy,
  versionCanRetry,
  rollbackState,
  rollbackBusy,
  refreshVersions,
  requestRollback,
} = usePublishFlowContext()
</script>

<template>
  <PanelSection
    title="版本记录与回滚"
    description="列出 ContentVersionRecord；回滚会基于目标版本生成一个新版本，不会删除历史。"
  >
    <AsyncStateBoundary
      :phase="versionState.phase"
      :error="versionState.error"
      :can-retry="versionCanRetry"
      :retry-progress="versionState.retryProgress"
      empty-title="暂无版本记录"
      :empty-reason="versionState.emptyHint?.reason"
      :empty-suggestion="versionState.emptyHint?.suggestion"
      :unavailable-reason="versionState.unavailableReason"
      loading-text="正在读取版本记录…"
      :skeleton-rows="3"
      min-height-class="min-h-[160px]"
      @retry="refreshVersions"
    >
      <template #default>
        <ul class="space-y-2">
          <li
            v-for="version in versions"
            :key="version.versionId"
            class="border p-2.5"
            :class="
              version.versionId === currentVersionId
                ? 'border-seal-2 bg-seal'
                : 'border-rule bg-paper'
            "
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-mono text-2xs text-ink">v{{ version.versionNo }}</span>
              <StatusPill :tone="PUBLISH_STATUS_META[version.status].tone" dense>
                {{ PUBLISH_STATUS_META[version.status].label }}
              </StatusPill>
              <StatusPill
                :tone="
                  version.riskLevel === 'high'
                    ? 'danger'
                    : version.riskLevel === 'medium'
                      ? 'warning'
                      : 'success'
                "
                dense
              >
                风险{{ RISK_SCORE_LABEL[version.riskLevel] }}
              </StatusPill>
              <StatusPill v-if="version.versionId === currentVersionId" tone="violet" dense>
                当前版本
              </StatusPill>
              <BaseButton
                class="ml-auto"
                size="sm"
                variant="ghost"
                :disabled="version.versionId === currentVersionId || rollbackBusy"
                @click="requestRollback(version)"
              >
                回滚到此版本
              </BaseButton>
            </div>
            <p class="mt-1 text-2xs leading-4 text-ink-2">
              {{ version.note ?? '（无说明）' }}
            </p>
            <p class="mt-0.5 text-2xs text-ink-4">
              {{ version.createdBy.name }}（{{ version.createdBy.role }}） ·
              {{ formatTime(version.createdAt) }}
              <span v-if="version.publishedUrl"> · {{ version.publishedUrl }}</span>
            </p>
          </li>
        </ul>
      </template>
      <template #idle-actions>
        <BaseButton size="sm" variant="primary" :loading="versionBusy" @click="refreshVersions">
          加载版本记录
        </BaseButton>
      </template>
      <template #empty-actions>
        <BaseButton size="sm" :loading="versionBusy" @click="refreshVersions">重新加载</BaseButton>
      </template>
    </AsyncStateBoundary>
    <p v-if="rollbackState.error" class="mt-2 text-2xs text-vermilion">
      回滚失败：{{ rollbackState.error.displayMessage }}
    </p>
  </PanelSection>
</template>
