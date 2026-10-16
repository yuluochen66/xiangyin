/**
 * 流程 5 的草稿数据类型与标注判定规则。
 *
 * 唯一职责：定义单条标注草稿（也是已保存基线）的形状，并提供不依赖响应式状态的纯函数——
 * 已保存值快照、生效判定、与 AI 是否不一致、必填校验、脏检查与转接口提交体。
 */
import type { NoticeLevel } from '@/composables/useAppShell'
import type {
  AnnotationInput,
  CompareVerdict,
  ComparisonItem,
  ConflictReasonTag,
} from '@/types/api'

/** 单条比对项的界面草稿（与已保存基线同形状）。 */
export interface DraftAnnotation {
  verdict: CompareVerdict | null
  reason: string
  reasonTags: ConflictReasonTag[]
}

/** 全局提示函数，与 useAppShell().notify 的签名兼容。 */
export type ComparisonNotify = (level: NoticeLevel, text: string, detail?: string) => void

/**
 * 「差异 / 待核实」是否必须填写差异原因。
 * @param verdict 人工选定的结论；未标注时为 null
 * @returns 需要填写差异原因时为 true
 */
export function needsReason(verdict: CompareVerdict | null): boolean {
  return verdict === 'conflict' || verdict === 'needs_verification'
}

/**
 * 由比对项自带的已保存值生成快照，用于初始化草稿与基线。
 * @param item 单条比对项
 * @returns 该条已保存的人工标注快照
 */
export function snapshotOf(item: ComparisonItem): DraftAnnotation {
  return {
    verdict: item.humanVerdict,
    reason: item.humanReason ?? '',
    reasonTags: [...item.humanReasonTags],
  }
}

/**
 * 有草稿取草稿，没有则回落到 AI 初判（用于展示「当前结论」）。
 * @param item 单条比对项
 * @param draft 该条的界面草稿，可能尚未建立
 * @returns 最终生效的判定；人工结论优先于 AI
 */
export function effectiveVerdictOf(
  item: ComparisonItem,
  draft: DraftAnnotation | undefined,
): CompareVerdict {
  return draft?.verdict ?? item.aiVerdict
}

/**
 * 人工结论是否与 AI 初判不一致。
 * @param item 单条比对项
 * @param draft 该条的界面草稿
 * @returns 已给出人工结论且与 AI 初判不同时为 true
 */
export function disagreesWithAiOf(
  item: ComparisonItem,
  draft: DraftAnnotation | undefined,
): boolean {
  const verdict = draft?.verdict ?? null
  return verdict !== null && verdict !== item.aiVerdict
}

/**
 * 必填校验：判定为「差异 / 待核实」时原因不能为空。
 * @param draft 该条的界面草稿
 * @returns 该条的错误提示；无草稿或校验通过时为空
 */
export function reasonErrorOf(draft: DraftAnnotation | undefined): string | null {
  if (!draft) return null
  if (needsReason(draft.verdict) && draft.reason.trim().length === 0) {
    return '判定为「差异」或「待核实」时必须填写差异原因。'
  }
  return null
}

/**
 * 草稿相对已保存基线是否有未保存改动。
 * @param draft 该条的界面草稿
 * @param saved 该条的已保存基线
 * @returns 结论、原因或分类任一变化时为 true
 */
export function isDirtyOf(
  draft: DraftAnnotation | undefined,
  saved: DraftAnnotation | undefined,
): boolean {
  if (!draft || !saved) return false
  if (draft.verdict !== saved.verdict) return true
  if (draft.reason !== saved.reason) return true
  return [...draft.reasonTags].sort().join(',') !== [...saved.reasonTags].sort().join(',')
}

/**
 * 把草稿转成接口提交体。
 * @param item 单条比对项
 * @param draft 该条的界面草稿
 * @returns 接口要求的单条标注入参
 */
export function toInputOf(
  item: ComparisonItem,
  draft: DraftAnnotation | undefined,
): AnnotationInput {
  return {
    itemId: item.itemId,
    verdict: draft?.verdict ?? item.aiVerdict,
    reason: draft?.reason ?? '',
    reasonTags: [...(draft?.reasonTags ?? [])],
  }
}
