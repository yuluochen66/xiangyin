<script setup lang="ts">
/**
 * 流程 2：时间轴视图的片段列表。
 *
 * 唯一职责：提供可滚动的片段列表容器（音频联动据此滚动定位）并逐段渲染 SegmentCard；
 * 段落视图与视图切换由 TranscriptContentPanel 负责。
 */
import type { ComponentPublicInstance } from 'vue'

import SegmentCard from '@/components/flow2/SegmentCard.vue'
import type { TranscriptAudioApi } from '@/composables/useTranscriptAudio'
import type { TranscriptCorrectionsApi } from '@/composables/useTranscriptCorrections'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import type { TranscriptSegmentDTO } from '@/types/api'

interface Props {
  /** 片段列表。 */
  segments: TranscriptSegmentDTO[]
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

const { listEl, activeSegmentId } = props.audio
const { editingId, drafts: draftMap } = props.drafts

/**
 * 把滚动容器写回 composable 持有的引用，供「滚动到当前片段」使用。
 * @param el 模板引用回调收到的元素或组件实例
 */
function assignListEl(el: Element | ComponentPublicInstance | null): void {
  listEl.value = el instanceof HTMLElement ? el : null
}
</script>

<template>
  <div :ref="assignListEl" class="scroll-area max-h-[560px] space-y-2 overflow-y-auto pr-1">
    <SegmentCard
      v-for="segment in segments"
      :key="segment.id"
      :segment="segment"
      :is-active="activeSegmentId === segment.id"
      :is-editing="editingId === segment.id"
      :draft="draftMap[segment.id]"
      :threshold="threshold"
      :drafts="drafts"
      :audio="audio"
      :corrections="corrections"
    />
    <p
      v-if="segments.length === 0"
      class="border border-dashed border-rule p-4 text-center text-xs text-ink-3"
    >
      暂无片段。
    </p>
  </div>
</template>
