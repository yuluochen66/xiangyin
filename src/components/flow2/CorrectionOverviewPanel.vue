<script setup lang="ts">
/**
 * 流程 2：「校正概览与保存」分区。
 *
 * 唯一职责：汇总片段 / 段落 / 校正 / 低置信度 / 待提交等计数，提供变更说明输入、
 * 保存校正与保存草稿、放弃全部修改、查看版本记录与进入流程 3 的入口，
 * 并就地展示保存失败与版本冲突；接口调用由 corrections / versions 负责。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import type { TranscriptCorrectionsApi } from '@/composables/useTranscriptCorrections'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import type { TranscriptVersionsApi } from '@/composables/useTranscriptVersions'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type { GetTranscriptResponse } from '@/types/api'
import { formatPercent } from '@/utils/format'

interface Props {
  /** 主任务状态快照（读取当前版本与乐观锁基准）。 */
  state: AsyncTaskState<GetTranscriptResponse>
  /** 片段总数。 */
  segmentCount: number
  /** 段落总数。 */
  paragraphCount: number
  /** 已人工校正的片段数。 */
  editedCount: number
  /** 当前低置信度片段数。 */
  lowConfidenceCount: number
  /** 当前低置信度阈值。 */
  threshold: number
  /** 逐段草稿（待提交数量）。 */
  drafts: TranscriptDraftsApi
  /** 保存校正与变更说明。 */
  corrections: TranscriptCorrectionsApi
  /** 版本记录入口。 */
  versions: TranscriptVersionsApi
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'next-flow': []
}>()

const { draftCount } = props.drafts
const {
  saveNote,
  lowConfidenceRemaining,
  phase: savePhase,
  error: saveError,
  conflict: saveConflict,
  isBusy: saveBusy,
  save,
  discardAll,
} = props.corrections
const { isBusy: versionBusy, openVersions } = props.versions
</script>

<template>
  <PanelSection
    title="校正概览与保存"
    description="保存校正（POST /corrections）会生成新版本；保存为草稿不生成版本。失败时编辑内容保留在本地。"
  >
    <template #actions>
      <BaseButton variant="secondary" size="sm" :loading="versionBusy" @click="openVersions">
        <AppIcon name="clock" :size="14" /> 版本记录
      </BaseButton>
      <BaseButton
        variant="primary"
        size="sm"
        :disabled="lowConfidenceCount > 0"
        :title="
          lowConfidenceCount > 0
            ? '仍有 ' + String(lowConfidenceCount) + ' 段低置信度未复核'
            : '进入流程 3：提取地点 / 人物 / 事件'
        "
        @click="emit('next-flow')"
      >
        进入流程 3 →
      </BaseButton>
    </template>
    <div class="flex flex-wrap items-center gap-2">
      <StatusPill tone="neutral" dense>片段 {{ segmentCount }}</StatusPill>
      <StatusPill tone="neutral" dense>段落 {{ paragraphCount }}</StatusPill>
      <StatusPill tone="success" dense>已人工校正 {{ editedCount }}</StatusPill>
      <StatusPill :tone="lowConfidenceCount > 0 ? 'warning' : 'success'" dense>
        低置信度 {{ lowConfidenceCount }}（阈值 {{ formatPercent(threshold) }}）
      </StatusPill>
      <StatusPill :tone="draftCount > 0 ? 'violet' : 'neutral'" dense
        >待提交修改 {{ draftCount }} 段</StatusPill
      >
      <StatusPill tone="neutral" dense>版本 v{{ state.data?.version.versionNo ?? '-' }}</StatusPill>
      <StatusPill v-if="lowConfidenceRemaining !== null" tone="info" dense>
        服务端返回剩余低置信度 {{ lowConfidenceRemaining }}
      </StatusPill>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <input
        v-model="saveNote"
        type="text"
        placeholder="变更说明（写入版本记录，可选）"
        class="h-7 w-64 border border-rule bg-sheet px-2 text-2xs text-ink placeholder:text-ink-4 focus:border-seal-2 focus:outline-none"
      />
      <BaseButton
        variant="primary"
        size="sm"
        :loading="saveBusy"
        :disabled="saveBusy || draftCount === 0"
        @click="save(false)"
      >
        保存校正（POST /corrections）
      </BaseButton>
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="saveBusy"
        :disabled="saveBusy || draftCount === 0"
        @click="save(true)"
      >
        保存为草稿
      </BaseButton>
      <BaseButton
        variant="ghost"
        size="sm"
        :disabled="saveBusy || draftCount === 0"
        @click="discardAll"
      >
        放弃全部修改
      </BaseButton>
    </div>

    <p class="mt-2 text-2xs text-ink-4">
      保存人：{{ CURRENT_OPERATOR.name }}（{{ CURRENT_OPERATOR.role }}）· baseVersionId：
      <span class="font-mono">{{ state.data?.version.versionId ?? '-' }}</span>
      （乐观锁；冲突时后端返回 conflict，界面只做提示不做自动合并）。
    </p>

    <p
      v-if="savePhase === 'error' && saveError"
      class="mt-2 flex flex-wrap items-center gap-2 bg-vermilion px-2 py-1 text-2xs text-vermilion"
    >
      <span>
        保存失败：{{ saveError.displayMessage }}。你的 {{ draftCount }} 段编辑内容仍保留在本地，
        可直接重试或改存草稿。
      </span>
      <BaseButton variant="ghost" size="sm" :loading="saveBusy" @click="save(false)"
        >重试保存</BaseButton
      >
      <BaseButton variant="ghost" size="sm" :disabled="saveBusy" @click="save(true)"
        >改存草稿</BaseButton
      >
    </p>
    <p
      v-else-if="savePhase === 'success' && saveConflict"
      class="mt-2 bg-attention px-2 py-1 text-2xs text-attention"
    >
      版本冲突：{{ saveConflict.message }}（涉及
      {{ saveConflict.conflictSegmentIds.length }} 段，待确认冲突处理策略 TODO-CONFLICT-1）
    </p>
  </PanelSection>
</template>
