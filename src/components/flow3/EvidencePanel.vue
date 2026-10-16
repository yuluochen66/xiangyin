<script setup lang="ts">
/**
 * 原文对应关系面板。
 *
 * 唯一职责：展示当前选中的「实体 → 转写片段」对应关系——说话人、字符区间、命中引文、
 * 按引文高亮的片段正文；片段缺失时给出降级提示。展示数据全部由外部传入。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { ActiveEvidence, EvidencePart } from '@/composables/useEvidenceTrace'
import type { TranscriptSegmentDTO } from '@/types/api'
import { formatPercent, formatTimecode } from '@/utils/format'

defineProps<{
  active: ActiveEvidence | null
  segment: TranscriptSegmentDTO | null
  parts: EvidencePart[]
}>()

const emit = defineEmits<{ clear: [] }>()
</script>

<template>
  <PanelSection
    title="原文对应关系"
    description="点击实体卡片上的依据按钮，在此查看对应转写片段并高亮引文。"
  >
    <div v-if="!active" class="text-2xs leading-5 text-ink-4">
      尚未选择原文依据。选择后会显示片段说话人、字符区间与命中引文；若片段已被删除或回滚，会给出降级提示。
    </div>
    <div v-else class="space-y-2">
      <div class="flex flex-wrap items-center gap-1.5">
        <StatusPill tone="violet" dense>{{ active.entity.name }}</StatusPill>
        <StatusPill tone="neutral" dense>{{ active.evidence.segmentId }}</StatusPill>
        <StatusPill tone="info" dense>{{ formatTimecode(active.evidence.startMs) }}</StatusPill>
      </div>

      <template v-if="segment">
        <p class="text-2xs text-ink-4">
          说话人 {{ segment.speaker }} · 字符区间 {{ active.evidence.charStart }}–{{
            active.evidence.charEnd
          }}
          · 片段置信度 {{ formatPercent(segment.confidence) }}
        </p>
        <p class="border border-rule bg-paper px-2.5 py-2 text-xs leading-relaxed text-ink">
          <template v-for="(part, index) in parts" :key="index">
            <mark v-if="part.hit" class="bg-attention-wash px-0.5 text-attention">{{
              part.text
            }}</mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </p>
        <p class="text-2xs text-ink-4">命中引文：{{ active.evidence.quote }}</p>
      </template>

      <p v-else class="bg-attention px-2 py-1 text-2xs leading-5 text-attention">
        原文片段 {{ active.evidence.segmentId }} 不存在（可能已在流程 2 中被回滚或删除）。
        该实体的依据待人工重新补挂，确认前请谨慎使用；可切换流程 2 重新校正后再回到本页。
      </p>

      <BaseButton variant="ghost" size="sm" @click="emit('clear')">清除选择</BaseButton>
    </div>
  </PanelSection>
</template>
