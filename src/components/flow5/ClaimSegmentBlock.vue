<script setup lang="ts">
/**
 * 论断的原文回跳片段。
 *
 * 唯一职责：就地展示某条论断关联的采访转写原句（片段 id / 讲述人 / 起点 / 正文）；
 * 未关联片段时给出缺失说明。
 */
import type { TranscriptSegmentDTO } from '@/types/api'
import { formatTimecode } from '@/utils/format'

defineProps<{ segment: TranscriptSegmentDTO | undefined }>()
</script>

<template>
  <div class="border border-rule bg-sheet p-2.5">
    <template v-if="segment">
      <p class="text-2xs text-ink-4">
        转写片段 {{ segment.id }} · 讲述人 {{ segment.speaker }} · 起点
        {{ formatTimecode(segment.startMs ?? 0, false) }}
      </p>
      <p class="mt-1 text-xs leading-relaxed text-ink">{{ segment.text }}</p>
    </template>
    <p v-else class="text-2xs text-ink-4">
      该论断未关联采访片段（claimSegmentId 缺失），无法回跳原文。
    </p>
  </div>
</template>
