<script setup lang="ts">
/**
 * 流程 2：「转写内容」分区。
 *
 * 唯一职责：承载时间轴 / 段落两种视图的切换与「定位当前」入口，
 * 并把两个视图的下级组件按当前模式挂载；segment / paragraph 的交互各自下沉到子组件。
 */
import { nextTick } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import ParagraphList from '@/components/flow2/ParagraphList.vue'
import SegmentTimeline from '@/components/flow2/SegmentTimeline.vue'
import type { TranscriptAudioApi } from '@/composables/useTranscriptAudio'
import type { TranscriptCorrectionsApi } from '@/composables/useTranscriptCorrections'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import type { TranscriptParagraphDTO, TranscriptSegmentDTO, TranscriptViewMode } from '@/types/api'

interface Props {
  /** 当前视图模式（时间轴 / 段落）。 */
  viewMode: TranscriptViewMode
  /** 片段列表。 */
  segments: TranscriptSegmentDTO[]
  /** 段落列表。 */
  paragraphs: TranscriptParagraphDTO[]
  /** 当前低置信度阈值。 */
  threshold: number
  /** 逐段草稿与编辑操作。 */
  drafts: TranscriptDraftsApi
  /** 播放位置与滚动定位。 */
  audio: TranscriptAudioApi
  /** 保存校正。 */
  corrections: TranscriptCorrectionsApi
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:viewMode': [value: TranscriptViewMode]
}>()

const { activeSegmentId, activeParagraphId, locateCurrent, seekToMs, scrollToSegment } = props.audio

/**
 * 播放段落起点。
 * @param paragraph 目标段落
 */
function seekParagraph(paragraph: TranscriptParagraphDTO): void {
  seekToMs(paragraph.startMs)
}

/**
 * 切回时间轴并在其中定位到该段落的首个片段。
 * @param paragraph 目标段落
 */
function switchToTimelineAt(paragraph: TranscriptParagraphDTO): void {
  emit('update:viewMode', 'timeline')
  seekToMs(paragraph.startMs)
  const firstId = paragraph.segmentIds[0]
  if (firstId) {
    void nextTick(() => scrollToSegment(firstId))
  }
}
</script>

<template>
  <PanelSection
    title="转写内容"
    :description="
      viewMode === 'timeline'
        ? '时间轴视图：音频片段与文本一一对应，可逐段编辑（含 AI 原文差异对照）。'
        : '段落视图：由多个片段合并，便于通读；点击可回跳时间轴编辑。'
    "
  >
    <template #actions>
      <div class="flex items-center gap-1 border border-rule p-0.5">
        <button
          type="button"
          class="px-2 py-0.5 text-2xs transition-colors"
          :class="viewMode === 'timeline' ? 'bg-seal text-seal-ink' : 'text-ink-3 hover:text-ink'"
          @click="emit('update:viewMode', 'timeline')"
        >
          时间轴
        </button>
        <button
          type="button"
          class="px-2 py-0.5 text-2xs transition-colors"
          :class="viewMode === 'paragraph' ? 'bg-seal text-seal-ink' : 'text-ink-3 hover:text-ink'"
          @click="emit('update:viewMode', 'paragraph')"
        >
          段落
        </button>
      </div>
      <BaseButton variant="ghost" size="sm" :disabled="!activeSegmentId" @click="locateCurrent">
        ⌖ 定位当前
      </BaseButton>
    </template>

    <SegmentTimeline
      v-if="viewMode === 'timeline'"
      :segments="segments"
      :threshold="threshold"
      :drafts="drafts"
      :audio="audio"
      :corrections="corrections"
    />
    <ParagraphList
      v-else
      :paragraphs="paragraphs"
      :active-paragraph-id="activeParagraphId"
      @seek="seekParagraph"
      @switch-timeline="switchToTimelineAt"
    />
  </PanelSection>
</template>
