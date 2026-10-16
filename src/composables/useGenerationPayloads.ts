/**
 * 流程 6 的请求体与降级响应构造。
 *
 * 唯一职责：把生成参数与草稿内容组装成三个接口请求体（生成初稿 / 重新生成 / 保存草稿），
 * 并在「人工撰写」降级路径上合成一份可直接写进状态机的生成响应。
 * 只做数据组装，不发起接口调用，也不持有任何响应式状态。
 */
import type { GenerationDraftApi } from '@/composables/useGenerationDraft'
import type { GenerationFormApi } from '@/composables/useGenerationForm'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import { mockStore } from '@/mock/store'
import type {
  CreateGenerationRequest,
  CreateGenerationResponse,
  DraftBlock,
  OutputType,
  RegenerateRequest,
  SaveDraftRequest,
} from '@/types/api'

/**
 * 创建流程 6 的请求体与降级响应构造器。
 * @param form 生成参数表单状态
 * @param draft 草稿内容与编辑状态
 * @returns 三个请求体构造器与人工撰写降级响应构造器
 */
export function useGenerationPayloads(form: GenerationFormApi, draft: GenerationDraftApi) {
  // 生成初稿请求体：只把非空的选填项写入。
  function buildCreateBody(): CreateGenerationRequest {
    const body: CreateGenerationRequest = {
      outputType: form.outputType.value,
      tone: form.tone.value,
      length: form.lengthPreset.value,
      title: form.title.value.trim(),
      claimIds: [...form.selectedClaimIds.value],
      sourceIds: [...form.selectedSourceIds.value],
      requireCitation: form.requireCitation.value,
      allowUnverified: form.allowUnverified.value,
      creativity: form.creativity.value,
      operator: { ...CURRENT_OPERATOR },
    }
    const audienceValue = form.audience.value.trim()
    if (audienceValue) body.audience = audienceValue
    const extra = form.extraInstruction.value.trim()
    if (extra) body.extraInstruction = extra
    return body
  }

  // 重新生成请求体：只把非空的附加要求写入。
  function buildRegenerateBody(): RegenerateRequest {
    const body: RegenerateRequest = {
      draftId: draft.draftId.value,
      tone: form.tone.value,
      length: form.lengthPreset.value,
      creativity: form.creativity.value,
      keepEditedBlocks: draft.keepEditedBlocks.value,
      operator: { ...CURRENT_OPERATOR },
    }
    const extra = form.extraInstruction.value.trim()
    if (extra) body.extraInstruction = extra
    return body
  }

  // 保存请求体：只把非空的变更说明写入。
  function buildSaveBody(createVersion: boolean): SaveDraftRequest {
    const body: SaveDraftRequest = {
      draftId: draft.draftId.value,
      title: draft.draftTitle.value.trim() || '未命名草稿',
      blocks: draft.cloneBlocks(draft.editableBlocks.value),
      createVersion,
      operator: { ...CURRENT_OPERATOR },
    }
    const note = draft.saveNote.value.trim()
    if (note) body.note = note
    return body
  }

  // 人工撰写降级响应：没有任何区块时用传入的首个空白区块占位。
  function buildHumanDraftResponse(
    outputType: OutputType,
    starter: DraftBlock,
  ): CreateGenerationResponse {
    return {
      draftId: draft.draftId.value,
      outputType,
      title: draft.draftTitle.value.trim() || '人工撰写草稿',
      blocks:
        draft.editableBlocks.value.length > 0
          ? draft.cloneBlocks(draft.editableBlocks.value)
          : [starter],
      citations: draft.cloneCitations(draft.citations.value),
      usedSourceIds: [...draft.usedSourceIds.value],
      omittedSourceIds: [...draft.omittedSourceIds.value],
      riskNotes: [],
      version: mockStore.generation.version,
      aiMeta: {
        model: 'human-draft',
        modelVersion: '—',
        confidence: 1,
        needsHumanConfirm: false,
        generatedAt: new Date().toISOString(),
        tookMs: 0,
      },
    }
  }

  return { buildCreateBody, buildRegenerateBody, buildSaveBody, buildHumanDraftResponse }
}
