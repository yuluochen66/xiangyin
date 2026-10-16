/**
 * 流程 6 草稿内容与编辑状态。
 *
 * 唯一职责：持有生成 / 拉取回来的草稿（区块、引用角标、风险项、来源使用情况、版本号）与
 * 编辑态（选中角标、选中区块、未保存标记、人工撰写模式、重新生成确认框、请求体预览），
 * 并提供区块风险分组、响应落库、区块增删改与定位等纯逻辑；正文角标解析见 useDraftBodyTokens。
 * 不发起任何接口调用，也不持有生成参数。
 */
import { computed, inject, nextTick, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'

import { useDraftBodyTokens } from '@/composables/useDraftBodyTokens'
import { mockStore } from '@/mock/store'
import type {
  Citation,
  CreateGenerationResponse,
  DraftBlock,
  GetDraftResponse,
  RegenerateResponse,
  RiskNote,
} from '@/types/api'

/**
 * 创建流程 6 的草稿内容与编辑状态。
 * @param allowUnverified 「允许收录待核实内容」开关，用于判定生成结果是否需要人工确认
 * @returns 草稿内容、编辑状态与响应落库方法
 */
export function useGenerationDraft(allowUnverified: Ref<boolean>) {
  const editableBlocks = ref<DraftBlock[]>([])
  const citations = ref<Citation[]>([])
  const riskNotes = ref<RiskNote[]>([])
  const usedSourceIds = ref<string[]>([])
  const omittedSourceIds = ref<string[]>([])
  const preservedBlockIds = ref<string[]>([])
  const draftTitle = ref('')
  const saveNote = ref('')
  const savedVersionNo = ref<number | null>(null)
  const unsavedEdits = ref(false)
  const humanDraftMode = ref(false)
  const reviewReady = ref(false)
  const activeCitation = ref<number | null>(null)
  const activeBlockId = ref<string | null>(null)
  const lastRequestBody = ref<unknown>(null)
  const regenConfirmOpen = ref(false)
  const keepEditedBlocks = ref(true)

  let manualSeq = 0

  const draftId = computed(() => mockStore.generation.draftId)

  const canRegenerate = computed(() => editableBlocks.value.length > 0)
  const canSave = computed(
    () => draftTitle.value.trim().length > 0 && editableBlocks.value.length > 0,
  )

  const { bodyTokens } = useDraftBodyTokens(editableBlocks)

  // 取出与某个区块关联的风险项。
  function risksForBlock(blockId: string): RiskNote[] {
    return riskNotes.value.filter((note) => note.relatedBlockId === blockId)
  }

  // 逐块浅拷贝，避免直接引用接口返回的对象。
  function cloneBlocks(blocks: DraftBlock[]): DraftBlock[] {
    return blocks.map((block) => ({ ...block, citationIndexes: [...block.citationIndexes] }))
  }

  // 逐条浅拷贝引用来源。
  function cloneCitations(items: Citation[]): Citation[] {
    return items.map((item) => ({ ...item }))
  }

  // 逐条浅拷贝风险提示。
  function cloneRiskNotes(items: RiskNote[]): RiskNote[] {
    return items.map((item) => ({ ...item }))
  }

  // 开启待核实收录，或存在「严重」风险时，必须先经人工确认。
  function requiresHumanConfirm(notes: RiskNote[]): boolean {
    return allowUnverified.value || notes.some((note) => note.level === 'critical')
  }

  // 把生成初稿的响应落进编辑状态。
  function applyGeneration(data: CreateGenerationResponse): void {
    draftTitle.value = data.title
    editableBlocks.value = cloneBlocks(data.blocks)
    citations.value = cloneCitations(data.citations)
    riskNotes.value = cloneRiskNotes(data.riskNotes)
    usedSourceIds.value = [...data.usedSourceIds]
    omittedSourceIds.value = [...data.omittedSourceIds]
    preservedBlockIds.value = []
    savedVersionNo.value = data.version.versionNo
    activeCitation.value = null
    activeBlockId.value = null
    unsavedEdits.value = false
    reviewReady.value = !requiresHumanConfirm(data.riskNotes)
  }

  // 把重新生成的响应落进编辑状态。
  function applyRegeneration(data: RegenerateResponse): void {
    editableBlocks.value = cloneBlocks(data.blocks)
    citations.value = cloneCitations(data.citations)
    riskNotes.value = cloneRiskNotes(data.riskNotes)
    preservedBlockIds.value = [...data.preservedBlockIds]
    savedVersionNo.value = data.version.versionNo
    activeCitation.value = null
    unsavedEdits.value = false
    reviewReady.value = !requiresHumanConfirm(data.riskNotes)
  }

  // 把拉取草稿的响应落进编辑状态。
  function applyFetchedDraft(data: GetDraftResponse): void {
    draftTitle.value = data.title
    editableBlocks.value = cloneBlocks(data.blocks)
    citations.value = cloneCitations(data.citations)
    riskNotes.value = cloneRiskNotes(data.riskNotes)
    usedSourceIds.value = []
    omittedSourceIds.value = []
    preservedBlockIds.value = []
    savedVersionNo.value = data.version.versionNo
    unsavedEdits.value = false
    reviewReady.value = false
  }

  // 标记区块被人工编辑过。
  function markEdited(block: DraftBlock): void {
    block.edited = true
    unsavedEdits.value = true
  }

  // 生成下一个人工区块 id，「新增区块」与「人工撰写」共用同一序号。
  function createHumanBlockId(): string {
    manualSeq += 1
    return 'HUMAN-' + Date.now().toString(36) + '-' + String(manualSeq)
  }

  // 在末尾追加一个空白区块。
  function addBlock(): void {
    editableBlocks.value = [
      ...editableBlocks.value,
      {
        id: createHumanBlockId(),
        heading: '新段落',
        body: '',
        citationIndexes: [],
        edited: true,
      },
    ]
    unsavedEdits.value = true
  }

  // 删除指定区块，并同步清理重新生成的保留标记。
  function removeBlock(blockId: string): void {
    editableBlocks.value = editableBlocks.value.filter((block) => block.id !== blockId)
    preservedBlockIds.value = preservedBlockIds.value.filter((item) => item !== blockId)
    unsavedEdits.value = true
  }

  // 高亮某个角标，并滚动到右栏对应的来源条目。
  async function focusCitation(index: number): Promise<void> {
    activeCitation.value = index
    await nextTick()
    document.getElementById('citation-' + String(index))?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }

  // 高亮某个区块，并滚动到它在结果区中的位置。
  async function focusBlock(blockId: string): Promise<void> {
    if (!blockId) return
    activeBlockId.value = blockId
    await nextTick()
    document.getElementById('block-' + blockId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return {
    draftId,
    editableBlocks,
    citations,
    riskNotes,
    usedSourceIds,
    omittedSourceIds,
    preservedBlockIds,
    draftTitle,
    saveNote,
    savedVersionNo,
    unsavedEdits,
    humanDraftMode,
    reviewReady,
    activeCitation,
    activeBlockId,
    lastRequestBody,
    regenConfirmOpen,
    keepEditedBlocks,
    bodyTokens,
    canRegenerate,
    canSave,
    risksForBlock,
    cloneBlocks,
    cloneCitations,
    cloneRiskNotes,
    applyGeneration,
    applyRegeneration,
    applyFetchedDraft,
    markEdited,
    createHumanBlockId,
    addBlock,
    removeBlock,
    focusCitation,
    focusBlock,
  }
}

/** 草稿内容与编辑状态的类型。 */
export type GenerationDraftApi = ReturnType<typeof useGenerationDraft>

/** 草稿内容与编辑状态的注入键。 */
export const GENERATION_DRAFT_KEY: InjectionKey<GenerationDraftApi> = Symbol('generation-draft')

/**
 * 读取流程 6 主视图提供的草稿内容与编辑状态。
 * @returns 上层 provide 的草稿内容与编辑状态
 */
export function useGenerationDraftContext(): GenerationDraftApi {
  const draft = inject(GENERATION_DRAFT_KEY)
  if (!draft) throw new Error('useGenerationDraftContext 只能在流程 6 主视图内使用。')
  return draft
}
