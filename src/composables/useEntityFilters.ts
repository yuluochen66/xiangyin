/**
 * 流程 3 的实体筛选与展示元数据。
 *
 * 唯一职责：集中 EntityKind / confirmStatus 的**展示元数据**（标签、图标、语义色），
 * 并基于实体列表派生出「类别 + 确认状态 + 关键词」筛选后的可见实体与分组结果。
 * 这里只做展示层计算，不发起任何接口调用，也不改写实体数据。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { IconName } from '@/components/common/AppIcon.vue'
import type { EntityKind, ExtractedEntity } from '@/types/api'

/** 界面按固定顺序呈现的六类实体。 */
export const ENTITY_KINDS: EntityKind[] = [
  'place',
  'person',
  'event',
  'organization',
  'artifact',
  'time',
]

/** 类别中文名。 */
export const KIND_LABEL: Record<EntityKind, string> = {
  place: '地点',
  person: '人物',
  event: '事件',
  organization: '机构',
  artifact: '器物',
  time: '时间',
}

/** 类别图标。 */
export const KIND_ICON: Record<EntityKind, IconName> = {
  place: 'pin',
  person: 'person',
  event: 'calendar',
  organization: 'institution',
  artifact: 'vessel',
  time: 'clock',
}

/** 确认状态中文名。 */
export const CONFIRM_LABEL: Record<ExtractedEntity['confirmStatus'], string> = {
  not_required: '无需确认',
  pending: '待人工确认',
  confirmed: '已确认',
  rejected: '已驳回',
}

/** 确认状态对应的胶囊语义色。 */
export const CONFIRM_TONE: Record<
  ExtractedEntity['confirmStatus'],
  'neutral' | 'warning' | 'success' | 'danger'
> = {
  not_required: 'neutral',
  pending: 'warning',
  confirmed: 'success',
  rejected: 'danger',
}

/** 确认状态筛选值。 */
export type ConfirmFilter = 'all' | 'pending' | 'confirmed' | 'rejected'

/** 确认状态筛选项。 */
export const CONFIRM_FILTERS: Array<{ value: ConfirmFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待确认' },
  { value: 'confirmed', label: '已确认' },
  { value: 'rejected', label: '已驳回' },
]

/** 单个类别的数量统计。 */
export interface EntityKindSummary {
  kind: EntityKind
  label: string
  icon: IconName
  count: number
  pending: number
}

/** 单个类别下通过筛选的实体。 */
export interface EntityKindGroup {
  kind: EntityKind
  label: string
  icon: IconName
  items: ExtractedEntity[]
}

export interface UseEntityFiltersApi {
  kindFilter: Ref<EntityKind | 'all'>
  confirmFilter: Ref<ConfirmFilter>
  keyword: Ref<string>
  kindSummary: ComputedRef<EntityKindSummary[]>
  visibleEntities: ComputedRef<ExtractedEntity[]>
  groupedEntities: ComputedRef<EntityKindGroup[]>
}

/**
 * 创建实体筛选状态与分组结果。
 * @param entities 当前已加载的全部实体（来自主任务的成功态数据）
 * @returns 三个筛选条件，以及类别统计、过滤后的可见实体与按类别分组的结果
 */
export function useEntityFilters(entities: ComputedRef<ExtractedEntity[]>): UseEntityFiltersApi {
  const kindFilter = ref<EntityKind | 'all'>('all')
  const confirmFilter = ref<ConfirmFilter>('all')
  const keyword = ref('')

  const kindSummary = computed<EntityKindSummary[]>(() =>
    ENTITY_KINDS.map((kind) => {
      const list = entities.value.filter((item) => item.kind === kind)
      return {
        kind,
        label: KIND_LABEL[kind],
        icon: KIND_ICON[kind],
        count: list.length,
        pending: list.filter((item) => item.confirmStatus === 'pending').length,
      }
    }),
  )

  const visibleEntities = computed(() =>
    entities.value.filter((entity) => {
      if (kindFilter.value !== 'all' && entity.kind !== kindFilter.value) return false
      if (confirmFilter.value !== 'all' && entity.confirmStatus !== confirmFilter.value)
        return false
      const kw = keyword.value.trim().toLowerCase()
      if (kw.length === 0) return true
      return (
        entity.name.toLowerCase().includes(kw) ||
        entity.normalizedName.toLowerCase().includes(kw) ||
        entity.aliases.some((alias) => alias.toLowerCase().includes(kw))
      )
    }),
  )

  const groupedEntities = computed<EntityKindGroup[]>(() =>
    ENTITY_KINDS.map((kind) => ({
      kind,
      label: KIND_LABEL[kind],
      icon: KIND_ICON[kind],
      items: visibleEntities.value.filter((item) => item.kind === kind),
    })).filter((group) => group.items.length > 0),
  )

  return { kindFilter, confirmFilter, keyword, kindSummary, visibleEntities, groupedEntities }
}
