<script setup lang="ts">
/**
 * 流程 4 的「关联线索」面板。
 *
 * 唯一职责：渲染由命中结果推出的关联线索卡片（标题、类别、置信度、提示语），
 * 点击即把线索冒泡给主视图追加为检索词；本组件不持有采纳状态、不发请求。
 */
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { LEAD_KIND_LABEL } from '@/composables/useSourceMeta'
import type { RelatedLead } from '@/types/api'

interface Props {
  leads: RelatedLead[]
  adoptedLeadIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{ adopt: [lead: RelatedLead] }>()
</script>

<template>
  <!-- 关联线索 -->
  <PanelSection
    v-if="props.leads.length > 0"
    title="关联线索"
    description="由命中结果的知识图谱推出。点击即把线索追加为检索词继续深挖。"
  >
    <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <li v-for="lead in props.leads" :key="lead.id">
        <button
          type="button"
          class="w-full border px-2.5 py-2 text-left transition-colors"
          :class="
            props.adoptedLeadIds.includes(lead.id)
              ? 'border-seal-2 bg-seal'
              : 'border-rule bg-paper hover:border-seal-2'
          "
          @click="emit('adopt', lead)"
        >
          <span class="flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-medium text-ink">{{ lead.title }}</span>
            <StatusPill tone="neutral" dense>{{ LEAD_KIND_LABEL[lead.kind] }}</StatusPill>
            <StatusPill :tone="lead.confidence >= 0.8 ? 'success' : 'warning'" dense>
              置信 {{ (lead.confidence * 100).toFixed(0) }}%
            </StatusPill>
            <StatusPill v-if="props.adoptedLeadIds.includes(lead.id)" tone="violet" dense>
              已加入检索
            </StatusPill>
          </span>
          <span class="mt-1 block text-2xs leading-4 text-ink-4">{{ lead.hint }}</span>
        </button>
      </li>
    </ul>
  </PanelSection>
</template>
