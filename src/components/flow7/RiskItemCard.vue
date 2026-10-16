<script setup lang="ts">
/**
 * 单条 AI 风险项卡片。
 *
 * 唯一职责：渲染一条风险项的等级、分类、说明、处理建议与「已确认知晓」勾选，
 * 并把勾选动作与区块跳转交给父级/共享上下文处理，不持有任何状态。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { usePublishFlowContext } from '@/composables/usePublishFlow'
import { RISK_CATEGORY_LABEL, RISK_LEVEL_META } from '@/composables/usePublishRiskCheck'
import type { ReviewRisk } from '@/types/api'

defineProps<{ risk: ReviewRisk }>()

const emit = defineEmits<{ acknowledge: [] }>()

const { goToFlow } = usePublishFlowContext()
</script>

<template>
  <li class="border p-2.5" :class="RISK_LEVEL_META[risk.level].cardClass">
    <div class="flex flex-wrap items-center gap-1.5">
      <StatusPill :tone="RISK_LEVEL_META[risk.level].tone" dense>
        {{ RISK_LEVEL_META[risk.level].label }}
      </StatusPill>
      <span class="text-2xs text-ink-3">{{ RISK_CATEGORY_LABEL[risk.category] }}</span>
      <span class="ml-auto font-mono text-2xs text-ink-4">{{ risk.id }}</span>
    </div>
    <p class="mt-1 text-xs leading-5 text-ink">{{ risk.message }}</p>
    <p class="mt-0.5 text-2xs leading-4 text-ink-3">建议：{{ risk.suggestion }}</p>
    <div class="mt-1.5 flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-1.5 text-2xs text-ink-2">
        <input
          :checked="risk.acknowledged"
          type="checkbox"
          class="size-3.5 accent-seal-ink"
          @change="emit('acknowledge')"
        />
        已确认知晓
      </label>
      <BaseButton v-if="risk.relatedBlockId" size="sm" variant="ghost" @click="goToFlow(6)">
        去流程 6 查看区块 {{ risk.relatedBlockId }}
      </BaseButton>
    </div>
  </li>
</template>
