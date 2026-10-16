/**
 * 流程 2：音频播放与「音频 ↔ 文本」联动。
 *
 * 唯一职责：维护 <audio> 的播放状态（当前时间 / 真实时长 / 播放中 / 自动跟随），
 * 并把「片段 ↔ 时间轴」的双向联动收敛在一处：seek、上/下一段、滚动定位。
 * 不发起任何接口调用，也不持有转写数据本身（片段与段落由调用方以只读计算属性传入）。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { AppShellApi } from '@/composables/useAppShell'
import type { TranscriptParagraphDTO, TranscriptSegmentDTO } from '@/types/api'

export interface UseTranscriptAudioOptions {
  /** 当前转写片段（主任务成功态；为空数组表示尚未加载）。 */
  segments: ComputedRef<TranscriptSegmentDTO[]>
  /** 当前转写段落（段落视图高亮用）。 */
  paragraphs: ComputedRef<TranscriptParagraphDTO[]>
  /** 是否处于逐段编辑态：编辑时不自动滚动，避免打断输入。 */
  isEditing: () => boolean
  /** 全局提示（音频元素未就绪时提示）。 */
  notify: AppShellApi['notify']
}

export interface TranscriptAudioApi {
  /** <audio> 元素引用，由播放器组件写入。 */
  audioEl: Ref<HTMLAudioElement | null>
  /** 时间轴滚动容器引用，由时间轴组件写入。 */
  listEl: Ref<HTMLElement | null>
  /** 当前播放位置（毫秒）。 */
  currentMs: Ref<number>
  /** 音频真实时长（毫秒，元数据未加载时为 0）。 */
  audioDurationMs: Ref<number>
  /** 音频加载或播放失败的原因。 */
  audioError: Ref<string | null>
  /** 是否正在播放。 */
  isPlaying: Ref<boolean>
  /** 是否自动跟随当前片段滚动。 */
  followEnabled: Ref<boolean>
  /** 当前播放位置命中的片段 id。 */
  activeSegmentId: ComputedRef<string | null>
  /** 当前播放位置命中的片段。 */
  activeSegment: ComputedRef<TranscriptSegmentDTO | null>
  /** 当前播放位置命中的段落 id。 */
  activeParagraphId: ComputedRef<string | null>
  /** 转写时间轴的最后结束时间（毫秒）。 */
  timelineEndMs: ComputedRef<number>
  /** 从 <audio> 读取当前时间（timeupdate 事件）。 */
  syncTime(): void
  /** 元数据加载完成：记录真实时长（loadedmetadata / durationchange 事件）。 */
  handleLoadedMetadata(): void
  /** 音频加载失败（error 事件）。 */
  handleAudioError(): void
  /** 进入播放态（play 事件）。 */
  handlePlayState(): void
  /** 进入暂停态并同步时间（pause / ended 事件）。 */
  handlePauseState(): void
  /** 定位到指定毫秒并（默认）播放。 */
  seekToMs(ms: number, autoplay?: boolean): void
  /** 按偏移量跳到上/下一段的起点。 */
  stepSegment(offset: number): void
  /** 把时间轴容器滚动到指定片段。 */
  scrollToSegment(segmentId: string, behavior?: ScrollBehavior): void
  /** 重新定位到当前播放片段。 */
  locateCurrent(): void
  /** 清空音频错误提示（流程重置用）。 */
  clearAudioError(): void
}

export function useTranscriptAudio(options: UseTranscriptAudioOptions): TranscriptAudioApi {
  const { segments, paragraphs, isEditing, notify } = options

  const audioEl = ref<HTMLAudioElement | null>(null)
  const listEl = ref<HTMLElement | null>(null)
  const currentMs = ref(0)
  const audioDurationMs = ref(0)
  const audioError = ref<string | null>(null)
  const isPlaying = ref(false)
  const followEnabled = ref(true)

  const timelineEndMs = computed(() =>
    segments.value.length > 0 ? segments.value[segments.value.length - 1].endMs : 0,
  )

  const activeSegmentId = computed<string | null>(() => {
    const ms = currentMs.value
    const hit = segments.value.find((item) => ms >= item.startMs && ms < item.endMs)
    return hit ? hit.id : null
  })
  const activeSegment = computed(
    () => segments.value.find((item) => item.id === activeSegmentId.value) ?? null,
  )
  const activeParagraphId = computed<string | null>(() => {
    const ms = currentMs.value
    const hit = paragraphs.value.find((item) => ms >= item.startMs && ms < item.endMs)
    return hit ? hit.id : null
  })

  function syncTime(): void {
    const el = audioEl.value
    if (!el) return
    const ms = Number.isFinite(el.currentTime) ? el.currentTime * 1000 : 0
    currentMs.value = Math.round(ms)
  }

  function handleLoadedMetadata(): void {
    const el = audioEl.value
    if (!el) return
    audioDurationMs.value = Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : 0
    audioError.value = null
    syncTime()
  }

  function handleAudioError(): void {
    audioError.value =
      '演示音频无法加载（/demo/audio-demo.wav）。文本校正、AI 建议与版本回滚不受影响，可继续操作。'
  }

  function handlePlayState(): void {
    isPlaying.value = true
  }

  function handlePauseState(): void {
    isPlaying.value = false
    syncTime()
  }

  /**
   * 跳转到指定毫秒并（默认）播放；演示音频更短时按音频真实时长夹取。
   * @param ms 目标位置（毫秒）
   * @param autoplay 跳转后是否自动播放
   */
  function seekToMs(ms: number, autoplay = true): void {
    const el = audioEl.value
    if (!el) {
      notify('info', '音频元素尚未就绪，请稍后重试或直接编辑文本。')
      return
    }
    const upper = audioDurationMs.value > 0 ? audioDurationMs.value : Number.POSITIVE_INFINITY
    const target = Math.min(Math.max(0, ms), Math.max(0, upper - 80))
    el.currentTime = target / 1000
    currentMs.value = Math.round(target)
    if (autoplay) {
      void el.play().catch(() => {
        audioError.value = '浏览器阻止了自动播放，请点击播放器上的播放按钮。'
      })
    }
  }

  function stepSegment(offset: number): void {
    const list = segments.value
    if (list.length === 0) return
    const index = list.findIndex((item) => item.id === activeSegmentId.value)
    const base = index === -1 ? (offset > 0 ? -1 : list.length) : index
    const target = Math.min(Math.max(base + offset, 0), list.length - 1)
    seekToMs(list[target].startMs)
  }

  /**
   * 把时间轴容器滚动到指定片段的中间位置。
   * @param segmentId 目标片段 id
   * @param behavior 滚动行为，默认平滑滚动
   */
  function scrollToSegment(segmentId: string, behavior: ScrollBehavior = 'smooth'): void {
    const container = listEl.value
    if (!container) return
    const target = container.querySelector<HTMLElement>('[data-seg-id="' + segmentId + '"]')
    if (!target) return
    const top = target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2
    container.scrollTo({ top: Math.max(0, top), behavior })
  }

  watch(activeSegmentId, (id) => {
    if (!id || !followEnabled.value || isEditing()) return
    scrollToSegment(id)
  })

  function locateCurrent(): void {
    const id = activeSegmentId.value
    if (id) scrollToSegment(id)
  }

  function clearAudioError(): void {
    audioError.value = null
  }

  onBeforeUnmount(() => {
    audioEl.value?.pause()
  })

  return {
    audioEl,
    listEl,
    currentMs,
    audioDurationMs,
    audioError,
    isPlaying,
    followEnabled,
    activeSegmentId,
    activeSegment,
    activeParagraphId,
    timelineEndMs,
    syncTime,
    handleLoadedMetadata,
    handleAudioError,
    handlePlayState,
    handlePauseState,
    seekToMs,
    stepSegment,
    scrollToSegment,
    locateCurrent,
    clearAudioError,
  }
}
