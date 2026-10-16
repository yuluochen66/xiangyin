<script setup lang="ts">
/**
 * 成功态结果区（流程 3）。
 *
 * 唯一职责：编排成功态的展示布局——AI 概览与批量确认、筛选统计、实体分组卡片、原文
 * 对应关系、同义项合并与「进入检索」入口；筛选状态与所有写操作都由视图持有并传入，
 * 本组件只做展示并把操作以事件抛出。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import AiOverviewPanel from '@/components/flow3/AiOverviewPanel.vue'
import DuplicateMergePanel from '@/components/flow3/DuplicateMergePanel.vue'
import EntityFilterPanel from '@/components/flow3/EntityFilterPanel.vue'
import EntityGroupList from '@/components/flow3/EntityGroupList.vue'
import EvidencePanel from '@/components/flow3/EvidencePanel.vue'
import type {
  ConfirmFilter,
  EntityKindGroup,
  EntityKindSummary,
} from '@/composables/useEntityFilters'
import type { MergeResultSummary } from '@/composables/useEntityMerge'
import type { ActiveEvidence, EvidencePart } from '@/composables/useEvidenceTrace'
import type {
  AiMeta,
  DuplicateGroup,
  EntityKind,
  ExtractedEntity,
  StartExtractionResponse,
  TranscriptSegmentDTO,
} from '@/types/api'

defineProps<{
  entities: ExtractedEntity[]
  aiMeta: AiMeta | null
  pendingCount: number
  pendingEntities: ExtractedEntity[]
  startData: StartExtractionResponse | null
  duplicateGroups: DuplicateGroup[]
  mergeResult: MergeResultSummary | null
  activeEvidence: ActiveEvidence | null
  evidenceSegment: TranscriptSegmentDTO | null
  evidenceParts: EvidencePart[]
  /** 类别筛选统计（由视图派生）。 */
  kindSummary: EntityKindSummary[]
  /** 筛选后的实体分组（由视图派生）。 */
  groupedEntities: EntityKindGroup[]
  /** 批量确认任务进行中。 */
  batchBusy: boolean
  /** 合并任务进行中。 */
  mergeBusy: boolean
  /** 主任务进行中（用于「重新拉取分组」的加载态）。 */
  busy: boolean
}>()

const emit = defineEmits<{
  accept: [entity: ExtractedEntity]
  edit: [entity: ExtractedEntity]
  reject: [entity: ExtractedEntity]
  'find-duplicate': [entity: ExtractedEntity]
  delete: [entity: ExtractedEntity]
  'open-evidence': [target: ActiveEvidence]
  'confirm-all': []
  'reject-all': []
  create: []
  merge: [group: DuplicateGroup]
  reload: []
  'clear-evidence': []
  'go-search': []
}>()

const kindFilter = defineModel<EntityKind | 'all'>('kindFilter', { required: true })
const confirmFilter = defineModel<ConfirmFilter>('confirmFilter', { required: true })
const keyword = defineModel<string>('keyword', { required: true })
</script>

<template>
  <div class="space-y-4">
    <!-- AI 抽取概览与批量确认 -->
    <AiOverviewPanel
      :ai-meta="aiMeta"
      :pending-count="pendingCount"
      :pending-entities="pendingEntities"
      :start-data="startData"
      :batch-busy="batchBusy"
      @confirm-all="emit('confirm-all')"
      @reject-all="emit('reject-all')"
      @create="emit('create')"
    />

    <!-- 筛选与分组统计 -->
    <EntityFilterPanel
      v-model:kind-filter="kindFilter"
      v-model:confirm-filter="confirmFilter"
      v-model:keyword="keyword"
      :total="entities.length"
      :summary="kindSummary"
    />

    <!-- 实体分组 + 原文对应关系 -->
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <EntityGroupList
        :groups="groupedEntities"
        :busy="batchBusy"
        @accept="emit('accept', $event)"
        @edit="emit('edit', $event)"
        @reject="emit('reject', $event)"
        @find-duplicate="emit('find-duplicate', $event)"
        @delete="emit('delete', $event)"
        @open-evidence="emit('open-evidence', $event)"
      />

      <!-- 原文对应关系面板 -->
      <EvidencePanel
        :active="activeEvidence"
        :segment="evidenceSegment"
        :parts="evidenceParts"
        @clear="emit('clear-evidence')"
      />
    </div>

    <!-- 同义项合并 -->
    <DuplicateMergePanel
      :groups="duplicateGroups"
      :merge-result="mergeResult"
      :entities="entities"
      :merge-busy="mergeBusy"
      :busy="busy"
      @merge="emit('merge', $event)"
      @reload="emit('reload')"
    />

    <!-- 进入检索 -->
    <div class="flex flex-wrap items-center gap-2 border border-rule bg-sheet px-4 py-3">
      <p class="text-2xs text-ink-3">
        未确认的实体不会进入流程 4 检索；当前待确认
        <span :class="pendingCount > 0 ? 'text-attention' : 'text-verified'">{{
          pendingCount
        }}</span>
        条。
      </p>
      <BaseButton
        variant="primary"
        size="sm"
        class="ml-auto"
        :disabled="pendingCount > 0"
        :title="
          pendingCount > 0
            ? '还有 ' + String(pendingCount) + ' 条待人工确认'
            : '进入流程 4：检索地方资料'
        "
        @click="emit('go-search')"
      >
        进入检索（流程 4）→
      </BaseButton>
    </div>
  </div>
</template>
