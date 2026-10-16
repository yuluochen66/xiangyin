<script setup lang="ts">
/**
 * 按实体类别分组的卡片列表。
 *
 * 唯一职责：把已分组的实体渲染成若干 PanelSection（标题带数量），并在筛选后没有任何
 * 实体时给出提示；卡片上的所有操作原样向视图转发，本组件不持有任何状态。
 */
import PanelSection from '@/components/common/PanelSection.vue'
import EntityCard from '@/components/flow3/EntityCard.vue'
import type { EntityKindGroup } from '@/composables/useEntityFilters'
import type { ActiveEvidence } from '@/composables/useEvidenceTrace'
import type { ExtractedEntity } from '@/types/api'

defineProps<{
  groups: EntityKindGroup[]
  /** 批量确认任务进行中，透传给卡片用于禁用写数据按钮。 */
  busy: boolean
}>()

const emit = defineEmits<{
  accept: [entity: ExtractedEntity]
  edit: [entity: ExtractedEntity]
  reject: [entity: ExtractedEntity]
  'find-duplicate': [entity: ExtractedEntity]
  delete: [entity: ExtractedEntity]
  'open-evidence': [target: ActiveEvidence]
}>()
</script>

<template>
  <div class="space-y-3">
    <PanelSection
      v-for="group in groups"
      :key="group.kind"
      :title="group.label + '（' + String(group.items.length) + '）'"
      dense
    >
      <div class="space-y-2">
        <EntityCard
          v-for="entity in group.items"
          :key="entity.id"
          :entity="entity"
          :busy="busy"
          @accept="emit('accept', $event)"
          @edit="emit('edit', $event)"
          @reject="emit('reject', $event)"
          @find-duplicate="emit('find-duplicate', $event)"
          @delete="emit('delete', $event)"
          @open-evidence="emit('open-evidence', $event)"
        />
      </div>
    </PanelSection>

    <p
      v-if="groups.length === 0"
      class="border border-dashed border-rule bg-sheet p-6 text-center text-xs text-ink-3"
    >
      当前筛选条件下没有实体；可清空关键词、切换「全部」类别或确认状态。
    </p>
  </div>
</template>
