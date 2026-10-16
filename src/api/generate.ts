/**
 * 流程 6：生成故事卡或研学讲稿 —— 接口调用层。
 */
import { request } from '@/services/api'
import type { ApiResponse } from '@/services/api/httpClient'
import { isConfirmScenario, isEmptyScenario, mockId, nowIso } from '@/mock/helpers'
import { mockStore } from '@/mock/store'
import type {
  CreateGenerationRequest,
  CreateGenerationResponse,
  DraftBlock,
  GetDraftResponse,
  RegenerateRequest,
  RegenerateResponse,
  RiskNote,
  SaveDraftRequest,
  SaveDraftResponse,
} from '@/types/api'

/** 语气 → 文案风格提示（mock 用，真实环境由提示词模板控制）。 */
const TONE_HINT: Record<CreateGenerationRequest['tone'], string> = {
  plain: '平实叙述',
  narrative: '叙事散文',
  academic: '学术说明',
  child: '儿童友好',
  official: '官方通报',
}

const LENGTH_HINT: Record<CreateGenerationRequest['length'], string> = {
  short: '约 400 字',
  medium: '约 900 字',
  long: '约 1800 字',
}

/**
 * 依据请求参数改写草稿（mock 只做可观察的变化，不真的调用模型）。
 * @param base 模型默认参数
 * @param body 本次请求的参数覆盖
 * @returns 合并后的生成参数
 */
function applyParams(
  base: CreateGenerationResponse,
  body: Pick<CreateGenerationRequest, 'title' | 'tone' | 'length' | 'outputType'>,
): CreateGenerationResponse {
  const blocks = base.blocks.map((block) => ({ ...block }))

  // 篇幅：短稿保留前 3 段，长稿在每段后追加口述细节
  const kept =
    body.length === 'short'
      ? blocks.slice(0, 3)
      : body.length === 'long'
        ? blocks
        : blocks.slice(0, 4)

  if (body.length === 'long') {
    for (const block of kept) {
      block.body = `${block.body}（口述补充：讲述人对这一细节有更具体的描述，详见对应采访片段。）`
    }
  }

  if (body.outputType === 'study_script') {
    kept.forEach((block, index) => {
      block.heading = `第 ${index + 1} 站 · ${block.heading}`
      block.body = `${block.body}\n\n【研学提问】结合上面的材料，你能说出这一处的文化特征吗？`
    })
  }

  return {
    ...base,
    outputType: body.outputType,
    title: body.title || base.title,
    blocks: kept,
    version: {
      versionId: mockId('VER'),
      versionNo: base.version.versionNo + 1,
      createdBy: base.version.createdBy,
      createdAt: nowIso(),
      note: `${TONE_HINT[body.tone]} · ${LENGTH_HINT[body.length]}`,
    },
  }
}

export const generateApi = {
  /**
   * 生成初稿。
   * POST /generations:create
   * @param body 生成请求体：内容类型、语气、篇幅与参数
   * @returns 新建的草稿与生成结果
   */
  create(body: CreateGenerationRequest): Promise<ApiResponse<CreateGenerationResponse>> {
    return request<CreateGenerationRequest, CreateGenerationResponse>({
      label: '生成初稿',
      method: 'POST',
      url: '/generations:create',
      body,
      mock: (ctx) => {
        const base = mockStore.generation

        if (isEmptyScenario(ctx)) {
          return { ...base, blocks: [], citations: [], riskNotes: [] }
        }

        const result = applyParams(base, body)

        // 「需人工确认」场景：追加一条需要人工确认的版权风险
        if (isConfirmScenario(ctx)) {
          result.riskNotes = [
            ...result.riskNotes,
            {
              level: 'warning',
              category: 'copyright',
              message: '引用《闽都别记》段落可能超出授权范围，需人工确认。',
              suggestion: '核实点校本的引用授权，或改为间接引述。',
              relatedBlockId: result.blocks[2]?.id,
            },
          ]
        }

        mockStore.generation = result
        return result
      },
      isEmpty: (data) => data.blocks.length === 0,
    })
  },

  /**
   * 重新生成（可保留人工编辑过的区块）。
   * POST /generations/{draftId}:regenerate
   * @param body 重新生成请求体：草稿 id 与新的语气或段落范围
   * @returns 重新生成后的草稿内容
   */
  regenerate(body: RegenerateRequest): Promise<ApiResponse<RegenerateResponse>> {
    return request<RegenerateRequest, RegenerateResponse>({
      label: '重新生成',
      method: 'POST',
      url: '/generations/{draftId}:regenerate',
      path: { draftId: body.draftId },
      body,
      mock: () => {
        const current = mockStore.generation
        const preservedBlockIds: string[] = []

        const blocks: DraftBlock[] = current.blocks.map((block) => {
          if (body.keepEditedBlocks && block.edited) {
            preservedBlockIds.push(block.id)
            return block
          }
          return {
            ...block,
            body: block.body.replace(/[。！]$/, '，此为重新生成版本。'),
            edited: false,
          }
        })

        const riskNotes: RiskNote[] =
          body.creativity !== undefined && body.creativity > 0.6
            ? [
                ...current.riskNotes,
                {
                  level: 'warning',
                  category: 'unsourced',
                  message: '创作自由度较高，可能出现资料中未直接支持的表述。',
                  suggestion: '请逐句核对引用角标，必要时降低创作自由度。',
                },
              ]
            : current.riskNotes

        return {
          draftId: body.draftId,
          blocks,
          citations: current.citations,
          riskNotes,
          version: {
            versionId: mockId('VER'),
            versionNo: current.version.versionNo + 1,
            createdBy: current.version.createdBy,
            createdAt: nowIso(),
            note: '重新生成',
          },
          aiMeta: {
            model: 'fuzhou-story-writer',
            modelVersion: '2.3.1',
            confidence: 0.79,
            needsHumanConfirm: true,
            generatedAt: nowIso(),
            tookMs: 4_100,
          },
          preservedBlockIds,
        }
      },
    })
  },

  /**
   * 保存草稿。
   * PUT /generations/{draftId}
   * @param body 草稿保存体：草稿 id 与正文
   * @returns 保存后的草稿（含新的更新时间）
   */
  saveDraft(body: SaveDraftRequest): Promise<ApiResponse<SaveDraftResponse>> {
    return request<SaveDraftRequest, SaveDraftResponse>({
      label: '保存草稿',
      method: 'PUT',
      url: '/generations/{draftId}',
      path: { draftId: body.draftId },
      body,
      mock: () => {
        const current = mockStore.generation
        current.title = body.title
        current.blocks = body.blocks.map((block) => ({ ...block }))

        const versionNo = body.createVersion
          ? current.version.versionNo + 1
          : current.version.versionNo
        const version = {
          versionId: body.createVersion ? mockId('VER') : current.version.versionId,
          versionNo,
          createdBy: body.operator,
          createdAt: nowIso(),
          note: body.note ?? (body.createVersion ? '人工编辑' : '草稿自动保存'),
        }
        current.version = version

        // 编辑后重算风险：缺少引用角标的区块会产生新的风险提示
        const riskNotes: RiskNote[] = current.blocks
          .filter((block) => block.citationIndexes.length === 0 && block.body.trim().length > 0)
          .map((block) => ({
            level: 'warning' as const,
            category: 'unsourced' as const,
            message: `「${block.heading}」缺少来源标注。`,
            suggestion: '为该段补充引用角标，或标注为口述内容。',
            relatedBlockId: block.id,
          }))

        return {
          draftId: body.draftId,
          savedAt: nowIso(),
          version,
          riskNotes: [
            ...riskNotes,
            ...current.riskNotes.filter((note) => note.category !== 'unsourced'),
          ],
        }
      },
    })
  },

  /**
   * 拉取草稿。
   * GET /generations/{draftId}
   * @param draftId 草稿 id
   * @returns 草稿详情：正文、引用来源与风险项
   */
  getDraft(draftId: string): Promise<ApiResponse<GetDraftResponse>> {
    return request<unknown, GetDraftResponse>({
      label: '拉取草稿',
      method: 'GET',
      url: '/generations/{draftId}',
      path: { draftId },
      mock: (ctx) => {
        const current = mockStore.generation
        return {
          draftId,
          outputType: current.outputType,
          title: current.title,
          blocks: isEmptyScenario(ctx) ? [] : current.blocks,
          citations: isEmptyScenario(ctx) ? [] : current.citations,
          riskNotes: current.riskNotes,
          version: current.version,
          status: mockStore.publishStatus,
          updatedAt: nowIso(),
          updatedBy: current.version.createdBy,
        }
      },
      isEmpty: (data) => data.blocks.length === 0,
    })
  },
}
