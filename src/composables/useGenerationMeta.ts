/**
 * 流程 6 的展示元数据与风险确认提示。
 *
 * 唯一职责：集中定义风险等级 / 分类与草稿状态的中文文案和配色，并依据风险项与
 * 「允许收录待核实内容」开关，构造 7 态状态机需要的「需人工确认」提示。
 * 不持有任何响应式状态，也不发起接口调用。
 */
import type { PillTone } from '@/components/common/StatusPill.vue'
import type { ConfirmPrompt } from '@/composables/useAsyncTask'
import type { GetDraftResponse, RiskNote } from '@/types/api'

/** 风险等级到文案、色调与卡片配色的映射。 */
export const RISK_LEVEL_META: Record<
  RiskNote['level'],
  { label: string; tone: PillTone; cardClass: string }
> = {
  info: { label: '提示', tone: 'info', cardClass: 'border-seal-2 bg-seal' },
  warning: { label: '注意', tone: 'warning', cardClass: 'border-attention bg-attention-wash' },
  critical: { label: '严重', tone: 'danger', cardClass: 'border-vermilion bg-vermilion-wash' },
}

/** 风险分类的中文名。 */
export const RISK_CATEGORY_LABEL: Record<RiskNote['category'], string> = {
  legend_as_fact: '传说当史实',
  unsourced: '缺少来源',
  low_credibility: '来源可信度低',
  sensitive: '敏感内容',
  copyright: '版权风险',
  other: '其他',
}

/** 草稿状态的中文名。 */
export const DRAFT_STATUS_LABEL: Record<GetDraftResponse['status'], string> = {
  draft: '草稿',
  pending_review: '待审',
  approved: '已通过',
  rejected: '已驳回',
  published: '已发布',
  archived: '已归档',
}

/**
 * 依据风险项构造「需人工确认」提示。
 * @param notes 本次结果的风险提示
 * @param allowUnverified 是否开启了「允许收录待核实内容」
 * @param copy 标题、通用正文、严重风险专用正文与确认 / 取消按钮文案
 * @returns 需要确认时的提示内容；没有「严重」风险且未开启待核实收录时为 null
 */
export function buildRiskConfirmPrompt(
  notes: RiskNote[],
  allowUnverified: boolean,
  copy: {
    title: string
    message: string
    /** 存在「严重」风险时替换 message，不传则沿用 message。 */
    criticalMessage?: string
    confirmText: string
    cancelText: string
  },
): ConfirmPrompt | null {
  const critical = notes.filter((note) => note.level === 'critical')
  if (critical.length === 0 && !allowUnverified) return null
  return {
    title: copy.title,
    message: critical.length > 0 ? (copy.criticalMessage ?? copy.message) : copy.message,
    details: notes.map(
      (note) =>
        RISK_LEVEL_META[note.level].label +
        ' · ' +
        RISK_CATEGORY_LABEL[note.category] +
        '：' +
        note.message,
    ),
    confirmText: copy.confirmText,
    cancelText: copy.cancelText,
  }
}
