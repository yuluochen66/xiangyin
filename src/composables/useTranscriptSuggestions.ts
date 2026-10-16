/**
 * 流程 2：AI 校正建议的本地状态与操作。
 *
 * 唯一职责：拉取逐段校正建议（POST /suggestions），并把「采纳 / 忽略 / 恢复 / 撤回 / 试听」
 * 这套人工介入动作收敛在一处；建议只写入编辑态，不直接改动正文。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { transcribeApi } from '@/api'
import type { AppShellApi } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import type {
  CorrectionSuggestion,
  SuggestCorrectionsResponse,
  TranscriptSegmentDTO,
  TranscriptViewMode,
} from '@/types/api'
import { formatTimecode } from '@/utils/format'

/** 建议类型的中文名。 */
export const SUGGESTION_CATEGORY_LABEL: Record<CorrectionSuggestion['category'], string> = {
  typo: '错别字',
  dialect: '方言用字',
  proper_noun: '专有名词',
  segmentation: '断句',
  other: '其他',
}

/** AI 建议行：带上时间码与忽略状态，避免模板里做查找。 */
export interface SuggestionRow {
  key: string
  suggestion: CorrectionSuggestion
  segmentId: string
  timecode: string
  ignored: boolean
}

/** 同一片段的建议分组。 */
export interface SuggestionGroup {
  segmentId: string
  timecode: string
  rows: SuggestionRow[]
}

export interface UseTranscriptSuggestionsOptions {
  /** 转写任务 id。 */
  transcriptId: string
  /** 当前转写片段（用于定位建议所属片段）。 */
  segments: ComputedRef<TranscriptSegmentDTO[]>
  /** 视图模式：试听建议会切回时间轴（与页面顶部切换器共享同一状态）。 */
  viewMode: Ref<TranscriptViewMode>
  /** 跳转播放（来自音频联动 composable）。 */
  seekToMs: (ms: number, autoplay?: boolean) => void
  /** 逐段草稿（采纳会写入编辑态，撤回会清理草稿）。 */
  drafts: TranscriptDraftsApi
  /** 全局提示。 */
  notify: AppShellApi['notify']
}

export interface TranscriptSuggestionsApi {
  /** 建议任务的 7 态状态机快照。 */
  state: Readonly<Ref<AsyncTaskState<SuggestCorrectionsResponse>>>
  /** 建议任务失败后是否允许重试。 */
  canRetry: ComputedRef<boolean>
  /** 建议任务是否进行中。 */
  isBusy: ComputedRef<boolean>
  /** 忽略集合（key = segmentId + '-' + index）。 */
  ignoredKeys: Ref<string[]>
  /** 是否展开「已忽略」。 */
  showIgnored: Ref<boolean>
  /** 全部建议行（含忽略状态）。 */
  suggestionRows: ComputedRef<SuggestionRow[]>
  /** 未忽略的建议行。 */
  pendingSuggestions: ComputedRef<SuggestionRow[]>
  /** 已忽略的建议行。 */
  ignoredSuggestions: ComputedRef<SuggestionRow[]>
  /** 按片段分组的未忽略建议。 */
  groupedSuggestions: ComputedRef<SuggestionGroup[]>
  /** 重新拉取建议列表。 */
  run(): void
  /** 使用上次参数重试。 */
  retry(): void
  /** 获取 AI 校正建议（run 的界面入口）。 */
  loadSuggestions(): void
  /** 采纳建议：写入编辑态，等待人工提交。 */
  applySuggestion(row: SuggestionRow): void
  /** 撤回采纳：删除该片段的草稿。 */
  revokeSuggestion(row: SuggestionRow): void
  /** 忽略建议。 */
  ignoreSuggestion(row: SuggestionRow): void
  /** 恢复被忽略的建议。 */
  restoreSuggestion(row: SuggestionRow): void
  /** 试听建议所属片段。 */
  seekSuggestion(row: SuggestionRow): void
  /** 清空忽略集合并收起面板（流程重置用）。 */
  clearIgnored(): void
}

export function useTranscriptSuggestions(
  options: UseTranscriptSuggestionsOptions,
): TranscriptSuggestionsApi {
  const { transcriptId, segments, viewMode, seekToMs, drafts: draftsApi, notify } = options

  const {
    state,
    canRetry,
    isBusy,
    run: taskRun,
    retry: taskRetry,
  } = useAsyncTask<SuggestCorrectionsResponse, []>(
    () => transcribeApi.suggestCorrections(transcriptId),
    {
      isEmpty: (data) => data.suggestions.length === 0,
      emptyHint: {
        reason: '当前词表没有匹配到可自动纠正的写法。',
        suggestion: '可直接逐段人工校正；补充领域词表后重新获取建议。',
      },
    },
  )

  /** 被忽略的 AI 建议（key = segmentId + '-' + index），可恢复。 */
  const ignoredKeys = ref<string[]>([])
  const showIgnored = ref(false)

  const suggestionRows = computed<SuggestionRow[]>(() => {
    const data = state.value.data
    if (!data) return []
    return data.suggestions.map((suggestion, index) => {
      const segment = segments.value.find((item) => item.id === suggestion.segmentId)
      const key = suggestion.segmentId + '-' + String(index)
      return {
        key,
        suggestion,
        segmentId: suggestion.segmentId,
        timecode: segment ? formatTimecode(segment.startMs) : '--:--',
        ignored: ignoredKeys.value.includes(key),
      }
    })
  })

  const pendingSuggestions = computed(() => suggestionRows.value.filter((row) => !row.ignored))
  const ignoredSuggestions = computed(() => suggestionRows.value.filter((row) => row.ignored))

  const groupedSuggestions = computed<SuggestionGroup[]>(() => {
    const map = new Map<string, SuggestionGroup>()
    for (const row of pendingSuggestions.value) {
      const existing = map.get(row.segmentId)
      if (existing) {
        existing.rows.push(row)
        continue
      }
      map.set(row.segmentId, { segmentId: row.segmentId, timecode: row.timecode, rows: [row] })
    }
    return [...map.values()]
  })

  function run(): void {
    void taskRun()
  }

  function retry(): void {
    void taskRetry()
  }

  function loadSuggestions(): void {
    run()
  }

  function applySuggestion(row: SuggestionRow): void {
    const segment = segments.value.find((item) => item.id === row.segmentId)
    if (!segment) {
      notify('warning', '该建议对应的片段已不存在，无法采纳。')
      return
    }
    const previous = draftsApi.drafts.value[segment.id]
    const speaker = previous?.speaker ?? segment.speaker
    draftsApi.setDraft(segment.id, row.suggestion.suggestedText, speaker, true)
    draftsApi.openEditor(segment.id, row.suggestion.suggestedText, speaker)
    notify('success', '已采纳 AI 建议并填入编辑态，提交校正后才真正生效。')
  }

  function revokeSuggestion(row: SuggestionRow): void {
    draftsApi.removeDraft(row.segmentId)
    if (draftsApi.editingId.value === row.segmentId) draftsApi.cancelEdit()
    notify('info', '已撤回该条 AI 建议的采纳（片段 ' + row.segmentId + '）。')
  }

  function ignoreSuggestion(row: SuggestionRow): void {
    if (!ignoredKeys.value.includes(row.key)) {
      ignoredKeys.value = [...ignoredKeys.value, row.key]
    }
    notify('info', '已忽略该建议，可在「已忽略」中恢复。')
  }

  function restoreSuggestion(row: SuggestionRow): void {
    ignoredKeys.value = ignoredKeys.value.filter((key) => key !== row.key)
    notify('info', '已恢复该建议。')
  }

  function seekSuggestion(row: SuggestionRow): void {
    const segment = segments.value.find((item) => item.id === row.segmentId)
    if (!segment) {
      notify('warning', '该建议对应的片段已不存在。')
      return
    }
    if (viewMode.value !== 'timeline') viewMode.value = 'timeline'
    seekToMs(segment.startMs)
  }

  function clearIgnored(): void {
    ignoredKeys.value = []
    showIgnored.value = false
  }

  return {
    state,
    canRetry,
    isBusy,
    ignoredKeys,
    showIgnored,
    suggestionRows,
    pendingSuggestions,
    ignoredSuggestions,
    groupedSuggestions,
    run,
    retry,
    loadSuggestions,
    applySuggestion,
    revokeSuggestion,
    ignoreSuggestion,
    restoreSuggestion,
    seekSuggestion,
    clearIgnored,
  }
}
