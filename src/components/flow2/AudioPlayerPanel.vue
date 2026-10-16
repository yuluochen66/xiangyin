<script setup lang="ts">
/**
 * 流程 2：音频播放与文本联动面板。
 *
 * 唯一职责：渲染 <audio> 与播放控制条（跟随开关、上/下一段、时间码、状态胶囊、音频错误）。
 * 音频状态与事件处理全部来自 useTranscriptAudio，本组件只负责把它接到 DOM 上。
 */
import type { ComponentPublicInstance } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { TranscriptAudioApi } from '@/composables/useTranscriptAudio'
import { formatTimecode } from '@/utils/format'

interface Props {
  /** 音频地址。 */
  src: string
  /** 音频联动 composable：播放状态与 <audio> 事件处理。 */
  player: TranscriptAudioApi
}

const props = defineProps<Props>()

const {
  audioEl,
  followEnabled,
  currentMs,
  audioDurationMs,
  audioError,
  isPlaying,
  activeSegment,
  timelineEndMs,
  syncTime,
  handleLoadedMetadata,
  handleAudioError,
  handlePlayState,
  handlePauseState,
  stepSegment,
} = props.player

/**
 * 把 <audio> 元素写回 composable 持有的引用，供 seek 使用。
 * @param el 模板引用回调收到的元素或组件实例
 */
function assignAudioEl(el: Element | ComponentPublicInstance | null): void {
  audioEl.value = el instanceof HTMLAudioElement ? el : null
}
</script>

<template>
  <PanelSection
    title="音频与文本联动"
    description="点击片段的时间码或正文即可跳转播放；播放位置会自动高亮当前片段并滚动到可视区。"
  >
    <template #actions>
      <label
        class="flex cursor-pointer select-none items-center gap-1 border px-2 py-1 text-2xs transition"
        :class="followEnabled ? 'border-seal-2 bg-seal text-seal-ink' : 'border-rule text-ink-4'"
      >
        <input v-model="followEnabled" type="checkbox" class="size-3 accent-seal-ink" />
        自动跟随
      </label>
    </template>
    <audio
      :ref="assignAudioEl"
      :src="src"
      controls
      preload="metadata"
      class="w-full max-w-2xl"
      @timeupdate="syncTime"
      @loadedmetadata="handleLoadedMetadata"
      @durationchange="handleLoadedMetadata"
      @play="handlePlayState"
      @pause="handlePauseState"
      @ended="handlePauseState"
      @error="handleAudioError"
    />
    <div class="mt-2 flex flex-wrap items-center gap-2 text-2xs text-ink-3">
      <BaseButton variant="ghost" size="sm" @click="stepSegment(-1)">⏮ 上一段</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="stepSegment(1)">⏭ 下一段</BaseButton>
      <span class="font-mono tabular-nums text-ink-2">
        {{ formatTimecode(currentMs) }} /
        {{ audioDurationMs > 0 ? formatTimecode(audioDurationMs, false) : '--:--' }}
      </span>
      <StatusPill :tone="isPlaying ? 'success' : 'neutral'" dense>{{
        isPlaying ? '播放中' : '已暂停'
      }}</StatusPill>
      <StatusPill v-if="activeSegment" tone="violet" dense>
        当前：{{ activeSegment.speaker }} · {{ formatTimecode(activeSegment.startMs) }}
      </StatusPill>
      <StatusPill v-else tone="neutral" dense>当前时间点未落在任何片段</StatusPill>
      <StatusPill
        v-if="audioDurationMs > 0 && timelineEndMs > 0 && audioDurationMs + 500 < timelineEndMs"
        tone="warning"
        dense
        title="演示音频短于转写时间轴，seek 时已按音频真实时长夹取，不会报错"
      >
        音频短于转写时间轴（{{ formatTimecode(audioDurationMs, false) }} &lt;
        {{ formatTimecode(timelineEndMs, false) }}）
      </StatusPill>
    </div>
    <p v-if="audioError" class="mt-2 bg-attention px-2 py-1 text-2xs text-attention">
      {{ audioError }}
    </p>
  </PanelSection>
</template>
