/**
 * 流程 2：逐段编辑态与「待提交校正」草稿集合。
 *
 * 唯一职责：维护每段的编辑中状态（编辑框文本 / 说话人）以及尚未提交到服务端的本地校正，
 * 并提供暂存、放弃、撤销、恢复 AI 原文与生成提交体的操作。
 * 不发任何请求，也不涉及版本与回滚。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { AppShellApi } from '@/composables/useAppShell'
import type { TranscriptSegmentDTO } from '@/types/api'

/** 提交给接口的逐段校正体（speaker 必填，便于写回本地片段）。 */
export interface LocalCorrection {
  segmentId: string
  text: string
  speaker: string
  fromAiSuggestion: boolean
}

/** 尚未提交的本地校正（key = segmentId）。保存失败时保留，确保编辑内容不丢。 */
export interface LocalDraft {
  segmentId: string
  text: string
  speaker: string
  fromAiSuggestion: boolean
}

export interface UseTranscriptDraftsOptions {
  /** 当前转写片段（用于校验被编辑的片段是否仍然存在）。 */
  segments: ComputedRef<TranscriptSegmentDTO[]>
  /** 全局提示。 */
  notify: AppShellApi['notify']
}

export interface TranscriptDraftsApi {
  /** 正在编辑的片段 id，null 表示没有片段处于编辑态。 */
  editingId: Ref<string | null>
  /** 编辑框正文。 */
  draftText: Ref<string>
  /** 编辑框说话人。 */
  draftSpeaker: Ref<string>
  /** 尚未提交的本地校正集合。 */
  drafts: Ref<Record<string, LocalDraft>>
  /** 待提交的片段数量。 */
  draftCount: ComputedRef<number>
  /** 进入某片段的编辑态（优先带出已暂存内容，否则用正文）。 */
  beginEdit(segment: TranscriptSegmentDTO): void
  /** 关闭编辑态并清空编辑框。 */
  cancelEdit(): void
  /** 把编辑框内容写入待提交集合；文本为空时拒绝并提示。 */
  commitEditor(): boolean
  /** 暂存编辑框内容（commitEditor 成功时给出提示）。 */
  stageEdit(): void
  /** 放弃当前片段的编辑，并删除其已暂存内容。 */
  discardEdit(): void
  /** 撤销某个片段的暂存修改。 */
  revokeDraft(segmentId: string): void
  /** 把编辑框正文恢复为该片段的 AI 原文。 */
  revertToOriginal(segment: TranscriptSegmentDTO): void
  /** 直接打开编辑态并填入指定文本（采纳 AI 建议 / 改人工听录用）。 */
  openEditor(segmentId: string, text: string, speaker: string): void
  /** 整体替换某片段的待提交内容（采纳 AI 建议用）。 */
  setDraft(segmentId: string, text: string, speaker: string, fromAiSuggestion: boolean): void
  /** 删除某片段的待提交内容（撤回采纳 / 回滚 / 保存成功后清理用）。 */
  removeDraft(segmentId: string): void
  /** 丢弃全部待提交内容（不关闭编辑态、不提示）。 */
  clearDrafts(): void
  /** 生成提交给接口的逐段校正体。 */
  buildCorrections(): LocalCorrection[]
}

export function useTranscriptDrafts(options: UseTranscriptDraftsOptions): TranscriptDraftsApi {
  const { segments, notify } = options

  const editingId = ref<string | null>(null)
  const draftText = ref('')
  const draftSpeaker = ref('')
  const drafts = ref<Record<string, LocalDraft>>({})

  const draftCount = computed(() => Object.keys(drafts.value).length)

  function cancelEdit(): void {
    editingId.value = null
    draftText.value = ''
    draftSpeaker.value = ''
  }

  function beginEdit(segment: TranscriptSegmentDTO): void {
    editingId.value = segment.id
    draftText.value = drafts.value[segment.id]?.text ?? segment.text
    draftSpeaker.value = drafts.value[segment.id]?.speaker ?? segment.speaker
  }

  function openEditor(segmentId: string, text: string, speaker: string): void {
    editingId.value = segmentId
    draftText.value = text
    draftSpeaker.value = speaker
  }

  /**
   * 把编辑框内容写入待提交集合；文本为空时拒绝并提示。
   * @returns 本次提交的结果对象
   */
  function commitEditor(): boolean {
    const id = editingId.value
    if (!id) return true
    const segment = segments.value.find((item) => item.id === id)
    if (!segment) {
      cancelEdit()
      return true
    }
    const text = draftText.value.trim()
    if (text.length === 0) {
      notify('warning', '片段文本不能为空，本次编辑未提交。')
      return false
    }
    const previous = drafts.value[id]
    drafts.value = {
      ...drafts.value,
      [id]: {
        segmentId: id,
        text,
        speaker: draftSpeaker.value.trim() || segment.speaker,
        fromAiSuggestion: previous?.fromAiSuggestion ?? false,
      },
    }
    cancelEdit()
    return true
  }

  function stageEdit(): void {
    if (commitEditor()) notify('info', '已暂存本段修改，尚未提交到服务端。')
  }

  function discardEdit(): void {
    const id = editingId.value
    if (id) {
      const next = { ...drafts.value }
      delete next[id]
      drafts.value = next
    }
    cancelEdit()
    notify('info', '已放弃本段未提交的修改。')
  }

  function revokeDraft(segmentId: string): void {
    const next = { ...drafts.value }
    delete next[segmentId]
    drafts.value = next
    notify('info', '已撤销该片段的暂存修改。')
  }

  function revertToOriginal(segment: TranscriptSegmentDTO): void {
    draftText.value = segment.originalText
    notify('info', '编辑框已恢复为该片段的 AI 原文，可继续修改或暂存。')
  }

  function setDraft(
    segmentId: string,
    text: string,
    speaker: string,
    fromAiSuggestion: boolean,
  ): void {
    drafts.value = {
      ...drafts.value,
      [segmentId]: { segmentId, text, speaker, fromAiSuggestion },
    }
  }

  function removeDraft(segmentId: string): void {
    const next = { ...drafts.value }
    delete next[segmentId]
    drafts.value = next
  }

  function clearDrafts(): void {
    drafts.value = {}
  }

  function buildCorrections(): LocalCorrection[] {
    return Object.values(drafts.value).map((draft) => ({
      segmentId: draft.segmentId,
      text: draft.text,
      speaker: draft.speaker,
      fromAiSuggestion: draft.fromAiSuggestion,
    }))
  }

  return {
    editingId,
    draftText,
    draftSpeaker,
    drafts,
    draftCount,
    beginEdit,
    cancelEdit,
    commitEditor,
    stageEdit,
    discardEdit,
    revokeDraft,
    revertToOriginal,
    openEditor,
    setDraft,
    removeDraft,
    clearDrafts,
    buildCorrections,
  }
}
