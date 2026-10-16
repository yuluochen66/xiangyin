/**
 * 原文溯源（实体 → 转写片段）的选中状态与引文切分。
 *
 * 唯一职责：记住当前查看的原文依据，从 mock 转写片段里取出对应 segment，并把片段
 * 文本按引文切成「命中 / 未命中」若干段交给模板渲染 <mark>（不使用 v-html）；
 * 片段不存在时返回空数组，由界面给出降级提示。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { mockStore } from '@/mock/store'
import type { EvidenceRef, ExtractedEntity, TranscriptSegmentDTO } from '@/types/api'

/** 被选中的「实体 → 原文依据」。 */
export interface ActiveEvidence {
  entity: ExtractedEntity
  evidence: EvidenceRef
}

/** 切分后的片段文本，hit 为 true 表示该段是命中引文。 */
export interface EvidencePart {
  text: string
  hit: boolean
}

export interface UseEvidenceTraceApi {
  activeEvidence: Ref<ActiveEvidence | null>
  evidenceSegment: ComputedRef<TranscriptSegmentDTO | null>
  evidenceParts: ComputedRef<EvidencePart[]>
  /** 打开某条实体的某条原文依据。 */
  openEvidence: (target: ActiveEvidence) => void
  /** 清空当前选择。 */
  clearEvidence: () => void
}

/**
 * 创建原文溯源状态。
 * @returns 选中态、命中的转写片段、切分后的片段文本，以及打开与清除选择的方法
 */
export function useEvidenceTrace(): UseEvidenceTraceApi {
  const activeEvidence = ref<ActiveEvidence | null>(null)

  const evidenceSegment = computed<TranscriptSegmentDTO | null>(() => {
    const active = activeEvidence.value
    if (!active) return null
    return mockStore.segments.find((segment) => segment.id === active.evidence.segmentId) ?? null
  })

  /** 把原文按引文切分，交给模板渲染 <mark>，避免 v-html 未转义内容。 */
  const evidenceParts = computed<EvidencePart[]>(() => {
    const active = activeEvidence.value
    const segment = evidenceSegment.value
    if (!active || !segment) return []
    const quote = active.evidence.quote
    const index = quote.length > 0 ? segment.text.indexOf(quote) : -1
    if (index === -1) return [{ text: segment.text, hit: false }]
    const parts: EvidencePart[] = []
    if (index > 0) parts.push({ text: segment.text.slice(0, index), hit: false })
    parts.push({ text: segment.text.slice(index, index + quote.length), hit: true })
    const rest = segment.text.slice(index + quote.length)
    if (rest.length > 0) parts.push({ text: rest, hit: false })
    return parts
  })

  function openEvidence(target: ActiveEvidence): void {
    activeEvidence.value = target
  }

  function clearEvidence(): void {
    activeEvidence.value = null
  }

  return { activeEvidence, evidenceSegment, evidenceParts, openEvidence, clearEvidence }
}
