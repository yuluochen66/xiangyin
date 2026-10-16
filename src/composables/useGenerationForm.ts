/**
 * 流程 6「生成参数」表单状态。
 *
 * 唯一职责：持有生成参数（输出类型 / 语气 / 篇幅 / 创作自由度 / 两个开关 / 标题与读者 /
 * 附加要求）和纳入范围（论断、资料）的响应式状态，并给出可选项常量、选项文案与勾选辅助。
 * 不发起任何接口调用，也不持有生成结果与草稿内容。
 */
import { computed, inject, ref } from 'vue'
import type { InjectionKey } from 'vue'

import type { PillTone } from '@/components/common/StatusPill.vue'
import { mockStore } from '@/mock/store'
import type { Citation, LengthPreset, OutputType, Tone } from '@/types/api'

/** 可选项的通用形状。 */
interface SelectOption<T> {
  value: T
  label: string
  hint: string
}

/** 论断勾选项。 */
interface ClaimOption {
  itemId: string
  claimText: string
  verdictLabel: string
}

/** 资料勾选项。 */
interface SourceOption {
  sourceId: string
  title: string
  publisher: string
  credibilityLabel: string
  credibilityTone: PillTone
}

/** 输出类型可选项。 */
export const OUTPUT_TYPE_OPTIONS: Array<SelectOption<OutputType>> = [
  { value: 'story_card', label: '故事卡', hint: '面向公众的短篇故事，重叙事与画面感' },
  { value: 'study_script', label: '研学讲稿', hint: '面向研学团的分站讲稿，重知识点与提问' },
]

/** 语气可选项。 */
export const TONE_OPTIONS: Array<SelectOption<Tone>> = [
  { value: 'plain', label: '平实', hint: '客观陈述，少修辞' },
  { value: 'narrative', label: '叙事', hint: '散文笔法，保留口述语感' },
  { value: 'academic', label: '学术', hint: '强调出处与限定语' },
  { value: 'child', label: '儿童', hint: '短句、口语，适合中小学生' },
  { value: 'official', label: '官方', hint: '通报体，措辞审慎' },
]

/** 篇幅可选项。 */
export const LENGTH_OPTIONS: Array<SelectOption<LengthPreset>> = [
  { value: 'short', label: '短稿', hint: '约 400 字' },
  { value: 'medium', label: '中稿', hint: '约 900 字' },
  { value: 'long', label: '长稿', hint: '约 1800 字' },
]

/** 流程 5 的 AI 初判结论文案。 */
const COMPARE_VERDICT_LABEL: Record<
  'consistent' | 'conflict' | 'needs_verification' | 'insufficient',
  string
> = {
  consistent: 'AI 初判：一致',
  conflict: 'AI 初判：差异',
  needs_verification: 'AI 初判：待核实',
  insufficient: 'AI 初判：资料不足',
}

/** 资料可信度文案。 */
export const CREDIBILITY_LABEL: Record<Citation['credibility'], string> = {
  high: '高可信',
  medium: '中等可信',
  low: '低可信',
  unverified: '未经核实',
}

/** 资料可信度色调。 */
export const CREDIBILITY_TONE: Record<Citation['credibility'], PillTone> = {
  high: 'success',
  medium: 'info',
  low: 'warning',
  unverified: 'danger',
}

/**
 * 创建流程 6 的生成参数表单状态。
 * @returns 参数状态、可选项、选项文案与勾选辅助方法
 */
export function useGenerationForm() {
  const outputType = ref<OutputType>('story_card')
  const tone = ref<Tone>('narrative')
  const lengthPreset = ref<LengthPreset>('medium')
  const creativity = ref(0.3)
  const requireCitation = ref(true)
  const allowUnverified = ref(false)
  const title = ref('一双手推亮的漆器：塔巷里的脱胎往事')
  const audience = ref('小学四年级研学团')
  const extraInstruction = ref('')

  /**
   * 纳入生成的论断（来自流程 5 中判定为「一致」的条目）。
   * 待确认：ComparisonItem 契约没有 claimId 字段，这里以 itemId 代替，后端定稿后需逐条核对。
   */
  const selectedClaimIds = ref<string[]>(
    mockStore.comparisonItems
      .filter((item) => item.aiVerdict === 'consistent')
      .map((item) => item.itemId),
  )
  const selectedSourceIds = ref<string[]>(
    mockStore.sources.filter((source) => source.cited).map((source) => source.sourceId),
  )

  const claimOptions = computed<ClaimOption[]>(() =>
    mockStore.comparisonItems.map((item) => ({
      itemId: item.itemId,
      claimText: item.claimText,
      verdictLabel: COMPARE_VERDICT_LABEL[item.aiVerdict],
    })),
  )

  const sourceOptions = computed<SourceOption[]>(() =>
    mockStore.sources.map((source) => ({
      sourceId: source.sourceId,
      title: source.title,
      publisher: source.publisher,
      credibilityLabel: CREDIBILITY_LABEL[source.credibility],
      credibilityTone: CREDIBILITY_TONE[source.credibility],
    })),
  )

  const outputTypeLabel = computed(
    () => OUTPUT_TYPE_OPTIONS.find((option) => option.value === outputType.value)?.label ?? '',
  )
  const toneLabel = computed(
    () => TONE_OPTIONS.find((option) => option.value === tone.value)?.label ?? '',
  )
  const lengthLabel = computed(
    () => LENGTH_OPTIONS.find((option) => option.value === lengthPreset.value)?.label ?? '',
  )
  const canGenerate = computed(
    () => title.value.trim().length > 0 && selectedClaimIds.value.length > 0,
  )

  // 滑杆只给字符串值，这里收回成 0~1 的数值。
  function onCreativityInput(event: Event): void {
    const target = event.target as HTMLInputElement
    creativity.value = Number(target.value)
  }

  // 把流程 5 中判定为「一致」的论断一次性全选。
  function selectAllClaims(): void {
    selectedClaimIds.value = mockStore.comparisonItems
      .filter((item) => item.aiVerdict === 'consistent')
      .map((item) => item.itemId)
  }

  // 只勾选可信度为「高」的资料。
  function selectHighCredibilitySources(): void {
    selectedSourceIds.value = mockStore.sources
      .filter((source) => source.credibility === 'high')
      .map((source) => source.sourceId)
  }

  return {
    outputType,
    tone,
    lengthPreset,
    creativity,
    requireCitation,
    allowUnverified,
    title,
    audience,
    extraInstruction,
    selectedClaimIds,
    selectedSourceIds,
    claimOptions,
    sourceOptions,
    outputTypeLabel,
    toneLabel,
    lengthLabel,
    canGenerate,
    onCreativityInput,
    selectAllClaims,
    selectHighCredibilitySources,
  }
}

/** 生成参数表单状态的类型。 */
export type GenerationFormApi = ReturnType<typeof useGenerationForm>

/** 生成参数表单状态的注入键。 */
export const GENERATION_FORM_KEY: InjectionKey<GenerationFormApi> = Symbol('generation-form')

/**
 * 读取流程 6 主视图提供的生成参数表单状态。
 * @returns 上层 provide 的生成参数表单状态
 */
export function useGenerationFormContext(): GenerationFormApi {
  const form = inject(GENERATION_FORM_KEY)
  if (!form) throw new Error('useGenerationFormContext 只能在流程 6 主视图内使用。')
  return form
}
