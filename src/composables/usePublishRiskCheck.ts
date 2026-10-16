/**
 * 流程 7「审核发布」的 AI 风险检查。
 *
 * 唯一职责：持有风险项列表、综合等级、是否可发布、阻断原因与「人工逐条核对」兜底状态，
 * 提交 POST /contents/{contentId}/risk-check，并集中定义风险等级 / 分类 / 评分的中文元数据。
 * 不负责状态流转、审核意见、发布与版本记录。
 */
import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { publishApi } from '@/api'
import type { PillTone } from '@/components/common/StatusPill.vue'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import type { ReviewRisk, RiskCheckResponse } from '@/types/api'

/** 风险等级到文案、色调与卡片配色的映射。 */
export const RISK_LEVEL_META: Record<
  ReviewRisk['level'],
  { label: string; tone: PillTone; cardClass: string }
> = {
  info: { label: '提示', tone: 'info', cardClass: 'border-seal-2 bg-seal' },
  warning: { label: '注意', tone: 'warning', cardClass: 'border-attention bg-attention-wash' },
  critical: { label: '严重', tone: 'danger', cardClass: 'border-vermilion bg-vermilion-wash' },
}

/** 风险分类的中文名。 */
export const RISK_CATEGORY_LABEL: Record<ReviewRisk['category'], string> = {
  unsourced_claim: '无来源结论',
  legend_as_fact: '传说当史实',
  low_credibility_source: '引用低可信来源',
  license_scope: '超出授权范围',
  sensitive_content: '敏感内容',
  citation_missing: '缺少引用标注',
  other: '其他',
}

/** 综合风险等级到文案与色调的映射。 */
export const OVERALL_LEVEL_META: Record<
  RiskCheckResponse['overallLevel'],
  { label: string; tone: PillTone }
> = {
  low: { label: '综合风险低', tone: 'success' },
  medium: { label: '综合风险中', tone: 'warning' },
  high: { label: '综合风险高', tone: 'danger' },
}

/** 单个风险等级的中文简写，用于版本记录等紧凑位置。 */
export const RISK_SCORE_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '低',
  medium: '中',
  high: '高',
}

/** AI 风险检查能力的对外接口。 */
export interface UsePublishRiskCheckApi {
  /** 风险项列表，勾选状态就地写回。 */
  risks: Ref<ReviewRisk[]>
  /** 综合风险等级；未检查时为 null。 */
  overallLevel: Ref<RiskCheckResponse['overallLevel'] | null>
  /** AI 判定能否直接发布；未判定时为 null。 */
  publishable: Ref<boolean | null>
  /** 阻止发布的硬性原因。 */
  blockers: Ref<string[]>
  /** 本次检查的生成时间。 */
  riskCheckedAt: Ref<string | null>
  /** 是否已转为人工逐条核对模式。 */
  riskUnavailableManual: Ref<boolean>
  /** 人工核对完成确认。 */
  manualCheckAck: Ref<boolean>
  /** 风险检查任务的 7 态状态快照。 */
  riskState: Readonly<Ref<AsyncTaskState<RiskCheckResponse>>>
  /** 风险检查是否进行中。 */
  riskBusy: ComputedRef<boolean>
  /** 风险检查失败是否可重试。 */
  riskCanRetry: ComputedRef<boolean>
  /** 发起风险检查，useRetry 为 true 时走重试入口。 */
  doRiskCheck: (useRetry: boolean) => Promise<void>
  /** 回应「存在未确认的严重风险」确认框。 */
  respondRiskConfirmDecision: (decision: 'confirmed' | 'rejected') => Promise<void>
  /** 风险检查不可用时改走人工核对。 */
  useManualRiskReview: () => void
}

/**
 * 组装 AI 风险检查能力。
 * @param options contentId 为被检查内容 id
 * @returns 风险数据、风险检查任务状态与触发动作
 */
export function usePublishRiskCheck(options: { contentId: string }): UsePublishRiskCheckApi {
  const { notify } = useAppShell()

  const risks = ref<ReviewRisk[]>([])
  const overallLevel = ref<RiskCheckResponse['overallLevel'] | null>(null)
  const publishable = ref<boolean | null>(null)
  const blockers = ref<string[]>([])
  const riskCheckedAt = ref<string | null>(null)
  const riskUnavailableManual = ref(false)
  const manualCheckAck = ref(false)

  const {
    state: riskState,
    isBusy: riskBusy,
    canRetry: riskCanRetry,
    run: runRiskCheck,
    retry: retryRiskCheck,
    respondConfirm: respondRiskConfirm,
  } = useAsyncTask<RiskCheckResponse, []>(() => publishApi.riskCheck(options.contentId), {
    isEmpty: (data) => data.risks.length === 0,
    emptyHint: {
      reason: '本次风险检查没有发现任何风险项。',
      suggestion: '可直接进入发布前最终确认；仍建议人工快速通读一遍。',
    },
    needsConfirm: (data) => {
      const pendingCritical = data.risks.filter(
        (risk) => risk.level === 'critical' && !risk.acknowledged,
      )
      if (pendingCritical.length === 0) return null
      return {
        title: '存在未确认的严重风险',
        message: '以下严重风险项需要逐条确认知晓后，才能继续发布流程。',
        details: pendingCritical.map(
          (risk) =>
            RISK_LEVEL_META[risk.level].label +
            ' · ' +
            RISK_CATEGORY_LABEL[risk.category] +
            '：' +
            risk.message,
        ),
        confirmText: '我已逐条确认知晓',
        cancelText: '返回逐条核对',
      }
    },
    onConfirm: (data, decision) => {
      if (decision === 'confirmed' && data) {
        risks.value = risks.value.map((risk) =>
          risk.level === 'critical' ? { ...risk, acknowledged: true } : risk,
        )
        notify('warning', '已确认知晓严重风险', 'AI 判定的阻断项仍需处理后才能发布。')
      }
    },
  })

  function applyRiskCheck(data: RiskCheckResponse): void {
    risks.value = data.risks.map((risk) => ({ ...risk }))
    overallLevel.value = data.overallLevel
    publishable.value = data.publishable
    blockers.value = [...data.blockers]
    riskCheckedAt.value = data.aiMeta.generatedAt
    riskUnavailableManual.value = false
  }

  async function doRiskCheck(useRetry: boolean): Promise<void> {
    const response = useRetry ? await retryRiskCheck() : await runRiskCheck()
    if (response) {
      applyRiskCheck(response.data)
      notify(
        'info',
        '风险检查完成',
        OVERALL_LEVEL_META[response.data.overallLevel].label +
          ' · 风险 ' +
          String(response.data.risks.length) +
          ' 条',
      )
    } else if (riskState.value.error) {
      notify('error', '风险检查失败', riskState.value.error.displayMessage)
    }
  }

  async function respondRiskConfirmDecision(decision: 'confirmed' | 'rejected'): Promise<void> {
    await respondRiskConfirm(decision)
  }

  function useManualRiskReview(): void {
    riskUnavailableManual.value = true
    notify(
      'warning',
      '已转为人工逐条核对',
      '风险检查服务不可用。请人工核对授权范围、引用标注与敏感内容；发布前三项确认仍然必须全部勾选。',
    )
  }

  return {
    risks,
    overallLevel,
    publishable,
    blockers,
    riskCheckedAt,
    riskUnavailableManual,
    manualCheckAck,
    riskState,
    riskBusy,
    riskCanRetry,
    doRiskCheck,
    respondRiskConfirmDecision,
    useManualRiskReview,
  }
}
