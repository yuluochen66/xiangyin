<script setup lang="ts">
/**
 * 流程 4 左栏「实体过滤」面板（来自流程 3）。
 *
 * 唯一职责：渲染流程 3 抽取出的实体清单，提供「全选已确认 / 清空」两个批量动作
 * 与逐条勾选，并把操作事件冒泡给主视图。本组件不持有勾选状态、不发请求。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { CONFIRM_STATUS_META, ENTITY_KIND_LABEL } from '@/composables/useSourceMeta'
import type { ExtractedEntity } from '@/types/api'

interface Props {
  entities: ExtractedEntity[]
  selectedEntityIds: string[]
  isBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select-confirmed': []
  clear: []
  'toggle-entity': [entityId: string]
}>()
</script>

<template>
  <PanelSection
    title="2 · 实体过滤（来自流程 3）"
    description="勾选抽取出的地点 / 人物 / 器物，把口述中的说法直接带到资料库里核验。"
  >
    <template #actions>
      <BaseButton
        variant="ghost"
        size="sm"
        :disabled="props.isBusy"
        @click="emit('select-confirmed')"
      >
        全选已确认
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="props.isBusy" @click="emit('clear')">
        清空
      </BaseButton>
    </template>

    <ul class="scroll-area max-h-72 space-y-1 overflow-y-auto pr-1">
      <li v-for="entity in props.entities" :key="entity.id">
        <label
          class="flex cursor-pointer items-start gap-2 border px-2 py-1.5 transition-colors"
          :class="
            props.selectedEntityIds.includes(entity.id)
              ? 'border-seal-2 bg-seal'
              : 'border-rule bg-paper hover:border-rule'
          "
        >
          <input
            type="checkbox"
            class="mt-0.5 size-3.5 accent-seal-ink"
            :checked="props.selectedEntityIds.includes(entity.id)"
            @change="emit('toggle-entity', entity.id)"
          />
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-1.5">
              <span class="truncate text-xs text-ink">{{ entity.name }}</span>
              <StatusPill tone="neutral" dense>{{ ENTITY_KIND_LABEL[entity.kind] }}</StatusPill>
              <StatusPill :tone="CONFIRM_STATUS_META[entity.confirmStatus].tone" dense>
                {{ CONFIRM_STATUS_META[entity.confirmStatus].label }}
              </StatusPill>
            </span>
            <span class="mt-0.5 block truncate text-2xs text-ink-4">
              规范名 {{ entity.normalizedName }} · 置信度 {{ entity.confidence.toFixed(2) }}
            </span>
          </span>
        </label>
      </li>
    </ul>
  </PanelSection>
</template>
