<script setup lang="ts">
/**
 * 流程 6 的生成结果面板。
 *
 * 唯一职责：承载「生成结果 / 人工撰写结果」分区——结果标题与版本 / 未保存标记、重新生成入口、
 * 区块列表、保存草稿与保存为版本，以及进入流程 7 · 审核发布的前置条件提示。
 * 区块编辑交给区块列表，接口调用与重新生成确认交给主视图。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import DraftBlockList from '@/components/flow6/DraftBlockList.vue'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { useGenerationDraftContext } from '@/composables/useGenerationDraft'
import type { RegenerateResponse, SaveDraftResponse } from '@/types/api'

interface Props {
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
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 请求重新生成（存在未保存编辑时先弹确认）。 */
  regenerate: []
  /** 重新生成失败后重试。 */
  retryRegenerate: []
  /** 保存草稿，参数为是否写成正式版本。 */
  save: [createVersion: boolean]
  /** 进入流程 7 · 审核发布。 */
  publish: []
}>()

const {
  humanDraftMode,
  preservedBlockIds,
  draftTitle,
  savedVersionNo,
  unsavedEdits,
  keepEditedBlocks,
  addBlock,
  canRegenerate,
  canSave,
  reviewReady,
} = useGenerationDraftContext()
</script>

<template>
  <PanelSection
    :title="humanDraftMode ? '人工撰写结果' : '生成结果'"
    :description="
      humanDraftMode
        ? '写稿模型不可用时的降级路径：自行起草区块，保存后仍进入审核发布。'
        : '每个区块都可直接编辑；编辑过的区块会标记「已人工编辑」，重新生成时可选择保留。'
    "
  >
    <template #actions>
      <label class="flex items-center gap-1.5 text-2xs text-ink-3">
        <input v-model="keepEditedBlocks" type="checkbox" class="size-3.5 accent-seal-ink" />
        保留人工编辑的内容
      </label>
      <BaseButton
        size="sm"
        :loading="props.regenBusy"
        :disabled="!canRegenerate"
        @click="emit('regenerate')"
      >
        重新生成
      </BaseButton>
    </template>

    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="draftTitle"
          type="text"
          class="min-w-0 flex-1 border border-rule bg-paper px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-seal-2"
          @input="unsavedEdits = true"
        />
        <StatusPill v-if="savedVersionNo" tone="violet" dense
          >版本 v{{ savedVersionNo }}</StatusPill
        >
        <StatusPill v-if="unsavedEdits" tone="warning" dense>有未保存修改</StatusPill>
        <StatusPill v-if="preservedBlockIds.length" tone="info" dense>
          重新生成保留 {{ preservedBlockIds.length }} 块
        </StatusPill>
      </div>

      <p
        v-if="props.regenState.error"
        class="border border-vermilion bg-vermilion-wash px-3 py-2 text-2xs text-vermilion"
      >
        重新生成失败：{{ props.regenState.error.displayMessage }}
        <button type="button" class="ml-2 underline" @click="emit('retryRegenerate')">重试</button>
        <span v-if="props.regenCanRetry" class="ml-2 text-vermilion">（该错误可重试）</span>
      </p>

      <DraftBlockList />

      <div class="flex flex-wrap items-center gap-2">
        <BaseButton size="sm" variant="ghost" @click="addBlock">＋ 新增区块</BaseButton>
        <BaseButton
          size="sm"
          :loading="props.saveBusy"
          :disabled="!canSave"
          @click="emit('save', false)"
        >
          保存草稿（不建版本）
        </BaseButton>
        <BaseButton
          size="sm"
          variant="primary"
          :loading="props.saveBusy"
          :disabled="!canSave"
          @click="emit('save', true)"
        >
          保存为版本
        </BaseButton>
        <span class="text-2xs text-ink-4">接口：PUT /generations/{draftId}</span>
      </div>
      <p v-if="!canSave" class="text-2xs text-attention">
        标题或区块为空，无法保存；请至少保留一个区块并填写标题。
      </p>
      <p v-if="props.saveState.error" class="text-2xs text-vermilion">
        保存失败：{{ props.saveState.error.displayMessage }}
      </p>

      <div class="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
        <BaseButton variant="primary" size="sm" :disabled="!reviewReady" @click="emit('publish')">
          进入流程 7 · 审核发布
        </BaseButton>
        <span v-if="!reviewReady" class="text-2xs text-attention">
          含「严重」风险或开启待核实收录时，需先确认风险点。
        </span>
        <span v-else class="text-2xs text-verified">已满足进入审核发布的前置条件。</span>
      </div>
    </div>
  </PanelSection>
</template>
