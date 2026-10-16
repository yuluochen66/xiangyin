<script setup lang="ts">
/**
 * 流程 2：单个转写片段卡片。
 *
 * 唯一职责：渲染一段转写（时间码 / 说话人 / 置信度 / 校正痕迹 / 正文）与它的编辑态，
 * 包含 AI 原文差异对照与暂存、放弃、恢复原文等本段操作；列表编排由 SegmentTimeline 负责。
 */
import { computed } from 'vue'

import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import ReviewDiffViewer from '@/components/review/ReviewDiffViewer.vue'
import type { TranscriptAudioApi } from '@/composables/useTranscriptAudio'
import type { TranscriptCorrectionsApi } from '@/composables/useTranscriptCorrections'
import type { LocalDraft, TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import type { TranscriptSegmentDTO } from '@/types/api'
import { formatDateTime, formatPercent, formatTimecode } from '@/utils/format'

interface Props {
  /** 片段数据。 */
  segment: TranscriptSegmentDTO
  /** 是否为当前播放命中的片段。 */
  isActive: boolean
  /** 是否处于编辑态。 */
  isEditing: boolean
  /** 该片段已暂存但未提交的修改。 */
  draft: LocalDraft | undefined
  /** 当前低置信度阈值。 */
  threshold: number
  /** 逐段草稿与编辑操作。 */
  drafts: TranscriptDraftsApi
  /** 跳转播放。 */
  audio: TranscriptAudioApi
  /** 保存校正（编辑态里的「暂存并立即提交」）。 */
  corrections: TranscriptCorrectionsApi
}

const props = defineProps<Props>()

const {
  draftText,
  draftSpeaker,
  beginEdit,
  discardEdit,
  stageEdit,
  revokeDraft,
  revertToOriginal,
} = props.drafts
const { seekToMs } = props.audio
const { isBusy: saveBusy, save } = props.corrections

/** 卡片的边框与底色：编辑态 / 播放命中态优先，其次低置信度。 */
const borderClass = computed(() => {
  if (props.isEditing) return 'border-seal-2 bg-seal'
  if (props.isActive) return 'border-seal-2 bg-seal'
  if (props.segment.lowConfidence) return 'border-attention bg-attention'
  return 'border-rule bg-sheet hover:border-rule'
})
</script>

<template>
  <article
    :data-seg-id="segment.id"
    class="scroll-mt-4 border px-3 py-2.5 transition-colors"
    :class="borderClass"
  >
    <header class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="px-1 py-px font-mono text-2xs tabular-nums transition-colors"
        :class="isActive ? 'bg-seal text-seal-ink' : 'text-ink-4 hover:bg-paper-3 hover:text-ink'"
        :title="'跳到 ' + formatTimecode(segment.startMs)"
        @click="seekToMs(segment.startMs)"
      >
        {{ formatTimecode(segment.startMs) }} – {{ formatTimecode(segment.endMs) }}
      </button>
      <span class="text-2xs font-medium text-ink-2">{{ segment.speaker }}</span>
      <StatusPill
        v-if="segment.lowConfidence"
        tone="warning"
        dense
        :title="'低于阈值 ' + formatPercent(threshold) + '，必须人工复核'"
      >
        低置信度 {{ formatPercent(segment.confidence) }}
      </StatusPill>
      <StatusPill v-else tone="success" dense
        >置信度 {{ formatPercent(segment.confidence) }}</StatusPill
      >
      <StatusPill v-if="segment.edited" tone="violet" dense>已校正</StatusPill>
      <StatusPill v-if="draft" tone="info" dense>待提交</StatusPill>
      <span v-if="segment.edited && segment.editedBy" class="text-2xs text-ink-4">
        改：{{ segment.editedBy.name }} ·
        {{ segment.editedAt ? formatDateTime(segment.editedAt) : '时间未知' }}
      </span>
      <div class="ml-auto flex items-center gap-1">
        <BaseButton v-if="!isEditing" variant="ghost" size="sm" @click="beginEdit(segment)">
          <AppIcon name="pencil" :size="14" /> 编辑
        </BaseButton>
        <BaseButton v-else variant="ghost" size="sm" @click="discardEdit">放弃修改</BaseButton>
      </div>
    </header>

    <!-- 只读态 -->
    <template v-if="!isEditing">
      <p
        class="mt-1.5 cursor-pointer text-sm leading-relaxed text-ink"
        @click="seekToMs(segment.startMs)"
      >
        {{ draft?.text ?? segment.text }}
      </p>
      <p v-if="draft" class="mt-1 flex flex-wrap items-center gap-2 text-2xs text-seal-ink">
        <span>已暂存修改（尚未提交）；AI 原文见编辑态的差异对照。</span>
        <button
          type="button"
          class="underline hover:text-seal-ink"
          @click="revokeDraft(segment.id)"
        >
          撤销暂存
        </button>
      </p>
      <p v-else-if="segment.text !== segment.originalText" class="mt-1 text-2xs text-ink-4">
        AI 原文：<span class="text-ink-3">{{ segment.originalText }}</span>
      </p>
    </template>

    <!-- 编辑态 -->
    <div v-else class="mt-2 space-y-2">
      <div class="flex flex-wrap items-center gap-3 text-2xs text-ink-3">
        <label class="flex items-center gap-1">
          说话人
          <input
            v-model="draftSpeaker"
            type="text"
            class="h-7 w-28 border border-rule bg-sheet px-2 text-2xs text-ink focus:border-seal-2 focus:outline-none"
          />
        </label>
        <span class="text-2xs text-ink-4"
          >本段 AI 原文：{{ segment.originalText || '（无，人工新增）' }}</span
        >
      </div>
      <textarea
        v-model="draftText"
        rows="3"
        class="w-full border border-rule bg-paper px-2.5 py-2 text-sm leading-relaxed text-ink focus:border-seal-2 focus:outline-none"
      />
      <ReviewDiffViewer :original="segment.originalText" :revised="draftText" />
      <div class="flex flex-wrap items-center gap-2">
        <BaseButton variant="primary" size="sm" @click="stageEdit">暂存本段修改</BaseButton>
        <BaseButton
          variant="secondary"
          size="sm"
          :loading="saveBusy"
          :disabled="saveBusy"
          @click="save(false)"
        >
          暂存并立即提交
        </BaseButton>
        <BaseButton variant="ghost" size="sm" @click="discardEdit">放弃修改</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="revertToOriginal(segment)"
          >恢复 AI 原文</BaseButton
        >
      </div>
    </div>
  </article>
</template>
