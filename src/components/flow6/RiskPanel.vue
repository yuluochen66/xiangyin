<script setup lang="ts">
/**
 * 流程 6 的 AI 风险提示面板（右栏第二块）。
 *
 * 唯一职责：按等级配色逐条列出风险提示（等级、分类、说明与建议），并提供「定位区块」
 * 跳到对应正文；不负责正文编辑、来源标注与版本记录。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useGenerationDraftContext } from '@/composables/useGenerationDraft'
import { RISK_CATEGORY_LABEL, RISK_LEVEL_META } from '@/composables/useGenerationMeta'

const { riskNotes, humanDraftMode, focusBlock } = useGenerationDraftContext()
</script>

<template>
  <PanelSection title="AI 风险提示" description="按等级配色；点击「定位区块」跳到对应正文。">
    <EmptyState
      v-if="riskNotes.length === 0"
      icon="shield"
      title="暂无风险提示"
      :description="
        humanDraftMode
          ? '人工撰写模式下不产生 AI 风险提示，发布前仍会做一次审核风险检查。'
          : '生成或保存后，AI 会重新评估本稿风险。'
      "
    />
    <ul v-else class="space-y-2">
      <li
        v-for="(note, index) in riskNotes"
        :key="'risk-' + index"
        class="border p-2.5"
        :class="RISK_LEVEL_META[note.level].cardClass"
      >
        <div class="flex flex-wrap items-center gap-1.5">
          <StatusPill :tone="RISK_LEVEL_META[note.level].tone" dense>
            {{ RISK_LEVEL_META[note.level].label }}
          </StatusPill>
          <span class="text-2xs text-ink-3">{{ RISK_CATEGORY_LABEL[note.category] }}</span>
          <BaseButton
            v-if="note.relatedBlockId"
            class="ml-auto"
            size="sm"
            variant="ghost"
            @click="focusBlock(note.relatedBlockId ?? '')"
          >
            定位区块
          </BaseButton>
        </div>
        <p class="mt-1 text-xs leading-5 text-ink">{{ note.message }}</p>
        <p class="mt-0.5 text-2xs leading-4 text-ink-3">建议：{{ note.suggestion }}</p>
      </li>
    </ul>
  </PanelSection>
</template>
