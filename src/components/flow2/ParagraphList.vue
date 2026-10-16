<script setup lang="ts">
/**
 * 流程 2：段落视图列表。
 *
 * 唯一职责：把后端合并好的段落渲染成可通读的列表，
 * 并提供「跳到该段」与「在时间轴中编辑」两个入口；不涉及逐段编辑本身。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { TranscriptParagraphDTO } from '@/types/api'
import { formatTimecode } from '@/utils/format'

interface Props {
  /** 段落列表。 */
  paragraphs: TranscriptParagraphDTO[]
  /** 当前播放命中的段落 id。 */
  activeParagraphId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  seek: [paragraph: TranscriptParagraphDTO]
  'switch-timeline': [paragraph: TranscriptParagraphDTO]
}>()
</script>

<template>
  <div class="space-y-3">
    <article
      v-for="paragraph in paragraphs"
      :key="paragraph.id"
      class="border px-3 py-2.5 transition-colors"
      :class="activeParagraphId === paragraph.id ? 'border-seal-2 bg-seal' : 'border-rule bg-sheet'"
    >
      <header class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="px-1 py-px font-mono text-2xs tabular-nums text-ink-4 hover:bg-paper-3 hover:text-ink"
          :title="'跳到 ' + formatTimecode(paragraph.startMs)"
          @click="emit('seek', paragraph)"
        >
          {{ formatTimecode(paragraph.startMs) }} – {{ formatTimecode(paragraph.endMs) }}
        </button>
        <span class="text-2xs font-medium text-ink-2">{{ paragraph.speaker }}</span>
        <StatusPill :tone="paragraph.lowConfidenceCount > 0 ? 'warning' : 'success'" dense>
          低置信度片段 {{ paragraph.lowConfidenceCount }}
        </StatusPill>
        <span class="text-2xs text-ink-4">由 {{ paragraph.segmentIds.length }} 个片段合并</span>
        <BaseButton
          variant="ghost"
          size="sm"
          class="ml-auto"
          @click="emit('switch-timeline', paragraph)"
        >
          在时间轴中编辑
        </BaseButton>
      </header>
      <p class="mt-1.5 text-sm leading-relaxed text-ink">{{ paragraph.text }}</p>
    </article>
    <p
      v-if="paragraphs.length === 0"
      class="border border-dashed border-rule p-4 text-center text-xs text-ink-3"
    >
      后端未返回段落数据，可切换到时间轴视图逐段校正。
    </p>
  </div>
</template>
