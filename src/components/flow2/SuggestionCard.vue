<script setup lang="ts">
/**
 * 流程 2：单条 AI 校正建议卡片。
 *
 * 唯一职责：展示一条建议的类型、置信度、词表命中、原文 → 建议文与理由，
 * 并提供采纳 / 忽略 / 撤回采纳 / 试听四个动作；不判断建议是否可用。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { SUGGESTION_CATEGORY_LABEL } from '@/composables/useTranscriptSuggestions'
import type { SuggestionRow } from '@/composables/useTranscriptSuggestions'
import { formatPercent } from '@/utils/format'

interface Props {
  /** 建议行（含时间码与忽略状态）。 */
  row: SuggestionRow
  /** 该片段当前是否有已暂存的修改（决定「撤回采纳」是否可用）。 */
  draftAvailable: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  apply: []
  ignore: []
  revoke: []
  seek: []
}>()
</script>

<template>
  <li class="border border-rule bg-sheet p-2">
    <div class="flex flex-wrap items-center gap-1.5">
      <StatusPill tone="violet" dense>{{
        SUGGESTION_CATEGORY_LABEL[row.suggestion.category]
      }}</StatusPill>
      <StatusPill tone="info" dense
        >建议置信度 {{ formatPercent(row.suggestion.confidence) }}</StatusPill
      >
      <StatusPill
        v-if="row.suggestion.glossaryHit"
        tone="neutral"
        dense
        :title="row.suggestion.glossaryHit"
      >
        词表命中
      </StatusPill>
    </div>
    <p class="mt-1.5 text-xs leading-relaxed text-ink-2">
      <span class="text-vermilion line-through">{{ row.suggestion.originalText }}</span>
      <span class="mx-1 text-ink-4">→</span>
      <span class="text-verified">{{ row.suggestion.suggestedText }}</span>
    </p>
    <p class="mt-1 text-2xs leading-5 text-ink-4">理由：{{ row.suggestion.reason }}</p>
    <p v-if="row.suggestion.glossaryHit" class="text-2xs text-ink-4">
      词表依据：{{ row.suggestion.glossaryHit }}
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      <BaseButton variant="primary" size="sm" @click="emit('apply')">采纳</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('ignore')">忽略</BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="!draftAvailable" @click="emit('revoke')">
        撤回采纳
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('seek')">试听该段</BaseButton>
    </div>
  </li>
</template>
