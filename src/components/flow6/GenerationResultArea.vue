<script setup lang="ts">
/**
 * 流程 6 的结果区。
 *
 * 唯一职责：用 AsyncStateBoundary 组织结果区的 7 态——成功或需人工确认时渲染确认横幅与结果面板，
 * 未开始 / 空数据 / 不可用 / 失败时给出对应的下一步入口与加载占位。
 * 自身不持有状态、不调用接口，状态机与动作全部由主视图通过 props 与事件提供。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import GenerationResultPanel from '@/components/flow6/GenerationResultPanel.vue'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { useGenerationFormContext } from '@/composables/useGenerationForm'
import type { CreateGenerationResponse, RegenerateResponse, SaveDraftResponse } from '@/types/api'

interface Props {
  /** 生成初稿的任务状态。 */
  genState: AsyncTaskState<CreateGenerationResponse>
  /** 生成失败是否可重试。 */
  genCanRetry: boolean
  /** 重新生成的任务状态。 */
  regenState: AsyncTaskState<RegenerateResponse>
  /** 重新生成是否进行中。 */
  regenBusy: boolean
  /** 重新生成失败是否可重试。 */
  regenCanRetry: boolean
  /** 保存草稿 / 版本的任务状态。 */
  saveState: AsyncTaskState<SaveDraftResponse>
  /** 保存是否进行中。 */
  saveBusy: boolean
  /** 拉取草稿是否进行中。 */
  fetchBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 发起生成初稿。 */
  generate: []
  /** 生成失败后重试。 */
  retry: []
  /** 切换到人工撰写模式。 */
  humanDraft: []
  /** 拉取已有草稿。 */
  loadDraft: []
  /** 放宽条件后重试。 */
  relax: []
  /** 回应风险点确认。 */
  respondConfirm: [decision: 'confirmed' | 'rejected']
  /** 请求重新生成。 */
  regenerate: []
  /** 重新生成失败后重试。 */
  retryRegenerate: []
  /** 保存草稿或版本。 */
  save: [createVersion: boolean]
  /** 进入流程 7 · 审核发布。 */
  publish: []
}>()

const {
  outputTypeLabel,
  toneLabel,
  lengthLabel,
  creativity,
  selectedClaimIds,
  selectedSourceIds,
  requireCitation,
  canGenerate,
} = useGenerationFormContext()
</script>

<template>
  <AsyncStateBoundary
    :phase="props.genState.phase"
    :error="props.genState.error"
    :can-retry="props.genCanRetry"
    :retry-progress="props.genState.retryProgress"
    empty-title="本次生成没有产出区块"
    :empty-reason="props.genState.emptyHint?.reason"
    :empty-suggestion="props.genState.emptyHint?.suggestion"
    :unavailable-reason="props.genState.unavailableReason"
    loading-text="正在撰写初稿…"
    :skeleton-rows="6"
    min-height-class="min-h-[280px]"
    @retry="emit('retry')"
  >
    <template #default>
      <div
        v-if="props.genState.phase === 'confirm' && props.genState.confirmPrompt"
        class="mb-4 border border-attention bg-attention-wash p-3.5"
      >
        <div class="flex items-center gap-2">
          <span aria-hidden="true"><AppIcon name="alert" :size="16" /></span>
          <p class="text-sm font-medium text-attention">
            {{ props.genState.confirmPrompt?.title }}
          </p>
        </div>
        <p class="mt-1.5 text-xs leading-5 text-attention">
          {{ props.genState.confirmPrompt?.message }}
        </p>
        <ul
          v-if="(props.genState.confirmPrompt?.details?.length ?? 0) > 0"
          class="mt-2 list-disc space-y-1 pl-5 text-2xs leading-4 text-attention"
        >
          <li v-for="(detail, index) in props.genState.confirmPrompt?.details ?? []" :key="index">
            {{ detail }}
          </li>
        </ul>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <BaseButton size="sm" variant="primary" @click="emit('respondConfirm', 'confirmed')">
            {{ props.genState.confirmPrompt?.confirmText ?? '确认知晓' }}
          </BaseButton>
          <BaseButton size="sm" variant="ghost" @click="emit('respondConfirm', 'rejected')">
            {{ props.genState.confirmPrompt?.cancelText ?? '放弃本次结果' }}
          </BaseButton>
          <span class="text-2xs text-attention">确认前可先在下方逐块修订正文。</span>
        </div>
      </div>

      <GenerationResultPanel
        :regen-state="props.regenState"
        :regen-busy="props.regenBusy"
        :regen-can-retry="props.regenCanRetry"
        :save-state="props.saveState"
        :save-busy="props.saveBusy"
        @regenerate="emit('regenerate')"
        @retry-regenerate="emit('retryRegenerate')"
        @save="emit('save', $event)"
        @publish="emit('publish')"
      />
    </template>

    <template #idle-actions>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <BaseButton variant="primary" :disabled="!canGenerate" @click="emit('generate')">
          生成初稿
        </BaseButton>
        <BaseButton variant="ghost" :loading="props.fetchBusy" @click="emit('loadDraft')"
          >拉取已有草稿</BaseButton
        >
        <BaseButton variant="ghost" @click="emit('humanDraft')">直接人工撰写</BaseButton>
      </div>
    </template>

    <template #loading>
      <div class="border border-rule bg-sheet p-6" style="min-height: 280px">
        <ProgressBar
          :progress="0.45"
          :remaining-ms="null"
          :label="
            '正在撰写' +
            outputTypeLabel +
            '…（语气：' +
            toneLabel +
            ' · 篇幅：' +
            lengthLabel +
            '）'
          "
          :show-percent="false"
          indeterminate
        />
        <p class="mt-4 text-xs leading-6 text-ink-3">
          AI 正在把勾选的论断与资料编排成稿，并按可信度自动生成引用角标。
          这一步通常需要数秒；完成后若判定含风险点，会先请你逐条确认。
        </p>
        <ul class="mt-3 space-y-1 text-2xs text-ink-4">
          <li>· 创作自由度 {{ Math.round(creativity * 100) }}%</li>
          <li>
            · 纳入论断 {{ selectedClaimIds.length }} 条，允许引用资料 {{ selectedSourceIds.length }}
            条
          </li>
          <li>· 强制标注来源：{{ requireCitation ? '是' : '否' }}</li>
        </ul>
      </div>
    </template>

    <template #empty-actions>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <BaseButton variant="primary" size="sm" @click="emit('relax')">放宽条件后重试</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="emit('humanDraft')"
          >切换到人工撰写</BaseButton
        >
        <BaseButton variant="ghost" size="sm" :loading="props.fetchBusy" @click="emit('loadDraft')"
          >拉取已有草稿</BaseButton
        >
      </div>
    </template>

    <template #unavailable-actions>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <BaseButton variant="primary" size="sm" @click="emit('humanDraft')"
          >切换到人工撰写</BaseButton
        >
        <BaseButton variant="ghost" size="sm" :loading="props.fetchBusy" @click="emit('loadDraft')"
          >拉取已有草稿</BaseButton
        >
      </div>
    </template>

    <template #error-actions>
      <BaseButton variant="ghost" size="sm" @click="emit('humanDraft')">改用人工撰写</BaseButton>
    </template>
  </AsyncStateBoundary>
</template>
