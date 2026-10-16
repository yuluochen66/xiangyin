<script setup lang="ts">
/**
 * 单条比对项的 AI 判定区。
 *
 * 唯一职责：展示 AI 初判结论 / 置信度 / 分类标签 / 理由与最近标注时间，提供
 * 「采纳 AI 初判」与「请求 AI 重判」，并在重判面板内就地反馈进行中、失败与结果。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { CONFLICT_REASON_LABEL, VERDICT_META } from '@/composables/useComparisonMeta'
import type { ComparisonItem, RejudgeItemResponse } from '@/types/api'
import { formatDateTime } from '@/utils/format'

interface Props {
  /** 单条比对项。 */
  item: ComparisonItem
  /** 该条的重判面板是否展开。 */
  rejudgeOpen: boolean
  /** 该条是否正在重判。 */
  rejudgeBusy: boolean
  /** 重判失败的就地提示。 */
  rejudgeErrorMessage: string | undefined
  /** 最近一次重判结果（全局唯一）。 */
  rejudgeResult: RejudgeItemResponse | null
}

defineProps<Props>()

/** 人工补充的重判上下文。 */
const rejudgeHints = defineModel<string>('rejudgeHints', { required: true })

const emit = defineEmits<{
  adopt: []
  toggleRejudge: []
  requestRejudge: []
}>()
</script>

<template>
  <div class="space-y-1.5 border border-seal-2 bg-seal p-2.5">
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-2xs font-medium text-seal-ink">AI 初判与理由</span>
      <StatusPill :tone="VERDICT_META[item.aiVerdict].tone" dense>
        {{ VERDICT_META[item.aiVerdict].label }}
      </StatusPill>
      <StatusPill tone="neutral" dense>置信度 {{ item.aiConfidence.toFixed(2) }}</StatusPill>
      <StatusPill v-for="tag in item.aiReasonTags" :key="tag" tone="warning" dense>
        {{ CONFLICT_REASON_LABEL[tag] }}
      </StatusPill>
      <span v-if="item.annotatedAt" class="ml-auto text-2xs text-ink-4">
        最近标注 {{ formatDateTime(item.annotatedAt) }}
      </span>
    </div>
    <p class="text-2xs leading-4 text-ink-2">{{ item.aiReason }}</p>

    <div class="flex flex-wrap items-center gap-1.5">
      <BaseButton variant="secondary" size="sm" @click="emit('adopt')">采纳 AI 初判</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('toggleRejudge')">
        {{ rejudgeOpen ? '收起重判面板' : '请求 AI 重判' }}
      </BaseButton>
      <span class="text-2xs text-ink-4">
        调用 <code class="font-mono">compareApi.rejudgeItem</code>
      </span>
    </div>

    <div v-if="rejudgeOpen" class="space-y-1.5 border-t border-rule pt-2">
      <textarea
        v-model="rejudgeHints"
        rows="2"
        class="w-full resize-y border border-rule bg-paper px-2 py-1.5 text-2xs text-ink outline-none placeholder:text-ink-4 focus:border-seal-2"
        placeholder="可选：补充上下文，例如「宗谱记载铺号在塔巷口，请确认地点表述是否冲突」"
      />
      <div class="flex flex-wrap items-center gap-2">
        <BaseButton
          variant="primary"
          size="sm"
          :loading="rejudgeBusy"
          :disabled="rejudgeBusy"
          @click="emit('requestRejudge')"
        >
          提交重判 · POST /comparisons/{comparisonId}/items/{itemId}:rejudge
        </BaseButton>
        <span v-if="rejudgeErrorMessage" class="text-2xs text-vermilion">
          {{ rejudgeErrorMessage }}
        </span>
        <span
          v-else-if="rejudgeResult && rejudgeResult.item.itemId === item.itemId"
          class="text-2xs text-verified"
        >
          重判完成 · {{ rejudgeResult.aiMeta.model }} · 耗时 {{ rejudgeResult.aiMeta.tookMs }} ms ·
          新置信度 {{ rejudgeResult.item.aiConfidence.toFixed(2) }}
        </span>
      </div>
      <p
        v-if="rejudgeResult && rejudgeResult.item.itemId === item.itemId"
        class="bg-paper px-2 py-1 text-2xs leading-4 text-ink-2"
      >
        重判后的理由：{{ rejudgeResult.item.aiReason }}
      </p>
    </div>
  </div>
</template>
