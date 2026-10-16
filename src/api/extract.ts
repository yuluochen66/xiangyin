/**
 * 流程 3：提取地点 / 人物 / 事件 —— 接口调用层。
 */
import { request } from '@/services/api'
import type { ApiResponse } from '@/services/api/httpClient'
import { isConfirmScenario, isEmptyScenario, mockId, nowIso, similarity } from '@/mock/helpers'
import { mockStore } from '@/mock/store'
import type {
  BatchConfirmRequest,
  BatchConfirmResponse,
  DeleteEntityRequest,
  DuplicateGroup,
  GetExtractionResponse,
  MergeEntitiesRequest,
  MergeEntitiesResponse,
  StartExtractionRequest,
  StartExtractionResponse,
  UpsertEntityRequest,
  UpsertEntityResponse,
} from '@/types/api'

const EXTRACTION_ID = 'EXT-2024-0312'

/**
 * 依据实体名重新计算同义项分组（人工改动后需要刷新）。
 * @returns 重算后的重复分组统计
 */
function recomputeDuplicateGroups(): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const entities = mockStore.entities

  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const a = entities[i]
      const b = entities[j]
      if (!a || !b || a.kind !== b.kind) continue

      const nameScore = similarity(a.name, b.name)
      const sameNormalized = a.normalizedName === b.normalizedName
      const aliasHit = a.aliases.includes(b.name) || b.aliases.includes(a.name)

      if (!sameNormalized && nameScore < 0.5 && !aliasHit) continue

      groups.push({
        groupId: `DUP-${a.id}-${b.id}`,
        suggestedPrimaryId: a.evidence.length >= b.evidence.length ? a.id : b.id,
        memberIds: [a.id, b.id],
        reason: sameNormalized
          ? `「${a.name}」与「${b.name}」规范名相同，属同一实体的不同写法。`
          : `「${a.name}」与「${b.name}」字形或读音相近（相似度 ${(nameScore * 100).toFixed(0)}%），建议核对是否同一实体。`,
        similarity: sameNormalized ? 0.99 : nameScore,
      })
    }
  }

  return groups
}

export const extractApi = {
  /**
   * 发起抽取任务。
   * POST /extractions:start
   * @param body 抽取请求体：转写 id 与要抽取的类别
   * @returns 抽取任务：任务 id 与初始状态
   */
  start(body: StartExtractionRequest): Promise<ApiResponse<StartExtractionResponse>> {
    return request<StartExtractionRequest, StartExtractionResponse>({
      label: '发起信息抽取',
      method: 'POST',
      url: '/extractions:start',
      body,
      mock: (ctx) => ({
        taskId: mockId('TASK'),
        extractionId: EXTRACTION_ID,
        status: 'running' as const,
        estimatedMs: 8_000,
        aiMeta: {
          model: 'fuzhou-ner',
          modelVersion: '1.2.3',
          confidence: 0.86,
          needsHumanConfirm: true,
          generatedAt: nowIso(),
          tookMs: isConfirmScenario(ctx) ? 9_000 : 3_100,
        },
      }),
    })
  },

  /**
   * 拉取抽取结果。
   * GET /extractions/{extractionId}
   * @param extractionId 抽取任务 id
   * @param kinds 要筛选的实体类别；留空表示全部
   * @returns 抽取结果：实体、机构、地点与人物
   */
  getExtraction(
    extractionId: string,
    kinds?: string[],
  ): Promise<ApiResponse<GetExtractionResponse>> {
    return request<unknown, GetExtractionResponse>({
      label: '拉取抽取结果',
      method: 'GET',
      url: '/extractions/{extractionId}',
      path: { extractionId },
      query: kinds && kinds.length > 0 ? { kinds: kinds.join(',') } : undefined,
      mock: (ctx) => {
        if (isEmptyScenario(ctx)) {
          mockStore.entities.splice(0, mockStore.entities.length)
        }

        const entities = mockStore.entities
        const pendingConfirmCount = isConfirmScenario(ctx)
          ? entities.length
          : entities.filter((item) => item.confirmStatus === 'pending').length

        return {
          extractionId,
          interviewId: 'INT-2024-0312',
          transcriptId: 'T-2024-0312',
          status: entities.length === 0 ? ('partial' as const) : ('succeeded' as const),
          entities,
          pendingConfirmCount,
          duplicateGroups: isConfirmScenario(ctx)
            ? recomputeDuplicateGroups()
            : mockStore.duplicateGroups,
          aiMeta: {
            model: 'fuzhou-ner',
            modelVersion: '1.2.3',
            confidence: 0.86,
            needsHumanConfirm: pendingConfirmCount > 0,
            promptVersion: 'ner-p-2024-05',
            generatedAt: nowIso(),
            tookMs: 2_400,
          },
        }
      },
      isEmpty: (data) => data.entities.length === 0,
    })
  },

  /**
   * 新增 / 更新实体（含人工确认）。
   * POST /extractions/{extractionId}/entities
   * @param body 实体新增或修改请求体
   * @returns 保存后的实体（新建时含新 id）
   */
  upsertEntity(body: UpsertEntityRequest): Promise<ApiResponse<UpsertEntityResponse>> {
    return request<UpsertEntityRequest, UpsertEntityResponse>({
      label: '保存实体',
      method: 'POST',
      url: '/extractions/{extractionId}/entities',
      path: { extractionId: body.extractionId },
      body,
      mock: () => {
        const existing = body.entityId
          ? mockStore.entities.find((item) => item.id === body.entityId)
          : undefined

        if (existing) {
          existing.name = body.name
          existing.normalizedName = body.normalizedName
          existing.aliases = [...body.aliases]
          existing.kind = body.kind
          if (body.confirmStatus) existing.confirmStatus = body.confirmStatus
          existing.uncertaintyNote = body.uncertaintyNote
          existing.updatedBy = body.operator
          existing.updatedAt = nowIso()
          if (body.evidence) existing.evidence = [...body.evidence]
        } else {
          mockStore.entities.push({
            id: mockId('ENT'),
            kind: body.kind,
            name: body.name,
            normalizedName: body.normalizedName,
            aliases: [...body.aliases],
            confidence: 1,
            confirmStatus: body.confirmStatus ?? 'confirmed',
            uncertaintyNote: body.uncertaintyNote,
            evidence: body.evidence ? [...body.evidence] : [],
            createdByHuman: true,
            updatedBy: body.operator,
            updatedAt: nowIso(),
          })
        }

        const entity = existing ?? mockStore.entities[mockStore.entities.length - 1]
        mockStore.duplicateGroups = recomputeDuplicateGroups()

        return {
          entity: entity as UpsertEntityResponse['entity'],
          pendingConfirmCount: mockStore.entities.filter((item) => item.confirmStatus === 'pending')
            .length,
          versionNo: mockStore.transcriptVersions.length + 1,
          updatedAt: nowIso(),
        }
      },
    })
  },

  /**
   * 删除实体。
   * DELETE /extractions/{extractionId}/entities/{entityId}
   * @param body 删除请求体：目标实体 id
   * @returns 删除结果与受影响的下游引用数
   */
  deleteEntity(
    body: DeleteEntityRequest,
  ): Promise<ApiResponse<{ deletedId: string; pendingConfirmCount: number }>> {
    return request<DeleteEntityRequest, { deletedId: string; pendingConfirmCount: number }>({
      label: '删除实体',
      method: 'DELETE',
      url: '/extractions/{extractionId}/entities/{entityId}',
      path: { extractionId: body.extractionId, entityId: body.entityId },
      body,
      mock: () => {
        const index = mockStore.entities.findIndex((item) => item.id === body.entityId)
        if (index >= 0) mockStore.entities.splice(index, 1)
        mockStore.duplicateGroups = recomputeDuplicateGroups()
        return {
          deletedId: body.entityId,
          pendingConfirmCount: mockStore.entities.filter((item) => item.confirmStatus === 'pending')
            .length,
        }
      },
    })
  },

  /**
   * 同义项合并。
   * POST /extractions/{extractionId}/entities:merge
   * @param body 合并请求体：主实体 id 与待并入的实体 id
   * @returns 合并后的实体与并入的别名
   */
  mergeEntities(body: MergeEntitiesRequest): Promise<ApiResponse<MergeEntitiesResponse>> {
    return request<MergeEntitiesRequest, MergeEntitiesResponse>({
      label: '合并同义项',
      method: 'POST',
      url: '/extractions/{extractionId}/entities:merge',
      path: { extractionId: body.extractionId },
      body,
      mock: () => {
        const primary = mockStore.entities.find((item) => item.id === body.primaryId)
        if (!primary) throw new Error('合并目标实体不存在。')

        const mergedAliases = new Set(primary.aliases)
        const removedIds: string[] = []

        for (const id of body.mergedIds) {
          if (id === body.primaryId) continue
          const target = mockStore.entities.find((item) => item.id === id)
          if (!target) continue
          mergedAliases.add(target.name)
          for (const alias of target.aliases) mergedAliases.add(alias)
          // 保留证据链：把被合并实体的原文依据挂到主实体上
          for (const evidence of target.evidence) {
            if (
              !primary.evidence.some(
                (item) =>
                  item.segmentId === evidence.segmentId && item.charStart === evidence.charStart,
              )
            ) {
              primary.evidence.push(evidence)
            }
          }
          removedIds.push(id)
          const index = mockStore.entities.findIndex((item) => item.id === id)
          if (index >= 0) mockStore.entities.splice(index, 1)
        }

        primary.aliases = [...mergedAliases]
        primary.confirmStatus = 'confirmed'
        primary.updatedBy = body.operator
        primary.updatedAt = nowIso()

        mockStore.duplicateGroups = recomputeDuplicateGroups()

        return {
          entity: primary,
          removedIds,
          mergedAliases: [...mergedAliases],
          pendingConfirmCount: mockStore.entities.filter((item) => item.confirmStatus === 'pending')
            .length,
          versionNo: mockStore.transcriptVersions.length + 1,
        }
      },
    })
  },

  /**
   * 批量确认（一键采纳 AI 建议）。
   * POST /extractions/{extractionId}/entities:batchConfirm
   * @param body 批量确认请求体：实体 id 列表
   * @returns 批量确认的结果统计
   */
  batchConfirm(body: BatchConfirmRequest): Promise<ApiResponse<BatchConfirmResponse>> {
    return request<BatchConfirmRequest, BatchConfirmResponse>({
      label: '批量确认实体',
      method: 'POST',
      url: '/extractions/{extractionId}/entities:batchConfirm',
      path: { extractionId: body.extractionId },
      body,
      mock: () => {
        for (const id of body.entityIds) {
          const entity = mockStore.entities.find((item) => item.id === id)
          if (!entity) continue
          entity.confirmStatus = body.confirmStatus
          entity.updatedBy = body.operator
          entity.updatedAt = nowIso()
        }
        const affected = mockStore.entities.filter((item) => body.entityIds.includes(item.id))
        return {
          entities: affected,
          pendingConfirmCount: mockStore.entities.filter((item) => item.confirmStatus === 'pending')
            .length,
          confirmedCount: affected.filter((item) => item.confirmStatus === 'confirmed').length,
        }
      },
    })
  },
}
