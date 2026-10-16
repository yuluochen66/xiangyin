<script setup lang="ts">
/**
 * 流程 2：「AI 校正建议」分区。
 *
 * 唯一职责：承载建议分区的 7 态边界、按片段分组的建议列表与「已忽略」折叠区，
 * 采纳 / 忽略 / 恢复 / 撤回 / 试听全部委托给 useTranscriptSuggestions；AI 不直接改动正文。
 */
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import SuggestionCard from '@/components/flow2/SuggestionCard.vue'
import { useAppShell } from '@/composables/useAppShell'
import { SUGGESTION_CATEGORY_LABEL } from '@/composables/useTranscriptSuggestions'
import type { TranscriptSuggestionsApi } from '@/composables/useTranscriptSuggestions'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'

interface Props {
  /** AI 建议的拉取与人工介入操作。 */
  suggestions: TranscriptSuggestionsApi
  /** 逐段草稿（决定「撤回采纳」是否可用）。 */
  drafts: TranscriptDraftsApi
}

const props = defineProps<Props>()

const { notify } = useAppShell()

const {
  state,
  canRetry,
  isBusy: busy,
  pendingSuggestions,
  groupedSuggestions,
  ignoredSuggestions,
  showIgnored,
  loadSuggestions,
  retry,
  applySuggestion,
  revokeSuggestion,
  ignoreSuggestion,
  restoreSuggestion,
  seekSuggestion,
} = props.suggestions
const { drafts: draftMap } = props.drafts

/** AI 建议不可用时的替代路径说明（纯前端提示，不触发任何请求）。 */
function explainManualFallback(): void {
  notify('info', 'AI 建议不可用，改为逐段时间轴人工校正（不影响保存与版本）。')
}
</script>

<template>
  <PanelSection
    title="AI 校正建议（AI 介入点）"
    description="建议来自词表 + 校正模型，仅作参考：采纳会写入该段编辑态、忽略会记录到本地方便恢复；AI 不会自动改动正文。"
  >
    <template #actions>
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="busy"
        :disabled="busy"
        @click="loadSuggestions"
      >
        获取 AI 校正建议
      </BaseButton>
      <BaseButton
        v-if="ignoredSuggestions.length > 0"
        variant="ghost"
        size="sm"
        @click="showIgnored = !showIgnored"
      >
        {{ showIgnored ? '收起已忽略' : '已忽略 ' + String(ignoredSuggestions.length) + ' 条' }}
      </BaseButton>
    </template>

    <AsyncStateBoundary
      :phase="state.phase"
      :error="state.error"
      :can-retry="canRetry"
      :retry-progress="state.retryProgress"
      empty-title="暂无可用建议"
      :empty-reason="state.emptyHint?.reason"
      :empty-suggestion="state.emptyHint?.suggestion"
      :unavailable-reason="state.unavailableReason"
      loading-text="正在生成 AI 校正建议…"
      :skeleton-rows="3"
      min-height-class="min-h-[140px]"
      @retry="retry"
    >
      <template #idle-actions>
        <BaseButton variant="primary" size="sm" :loading="busy" @click="loadSuggestions">
          获取 AI 校正建议（POST /suggestions）
        </BaseButton>
      </template>
      <template #empty-actions>
        <BaseButton variant="ghost" size="sm" :loading="busy" @click="loadSuggestions"
          >重新获取</BaseButton
        >
      </template>
      <template #unavailable-actions>
        <BaseButton variant="secondary" size="sm" @click="explainManualFallback">
          改为纯人工校正
        </BaseButton>
      </template>

      <div
        v-if="pendingSuggestions.length === 0"
        class="border border-dashed border-rule p-4 text-center text-xs text-ink-3"
      >
        全部建议都已被忽略，或本次没有匹配到可自动纠正的写法。
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="group in groupedSuggestions"
          :key="group.segmentId"
          class="border border-rule bg-paper p-2.5"
        >
          <header class="flex flex-wrap items-center gap-2 text-2xs text-ink-3">
            <span class="font-mono text-ink-2">{{ group.timecode }}</span>
            <span
              >片段 <span class="font-mono">{{ group.segmentId }}</span></span
            >
            <span class="ml-auto">{{ group.rows.length }} 条建议</span>
          </header>
          <ul class="mt-2 space-y-2">
            <SuggestionCard
              v-for="row in group.rows"
              :key="row.key"
              :row="row"
              :draft-available="Boolean(draftMap[row.segmentId])"
              @apply="applySuggestion(row)"
              @ignore="ignoreSuggestion(row)"
              @revoke="revokeSuggestion(row)"
              @seek="seekSuggestion(row)"
            />
          </ul>
        </div>
      </div>

      <div
        v-if="showIgnored && ignoredSuggestions.length > 0"
        class="mt-3 border border-rule bg-paper p-2.5"
      >
        <p class="text-2xs text-ink-3">
          已忽略的建议（{{ ignoredSuggestions.length }} 条，保留在本地，可随时恢复）
        </p>
        <ul class="mt-1.5 space-y-1">
          <li
            v-for="row in ignoredSuggestions"
            :key="row.key"
            class="flex flex-wrap items-center gap-2 text-2xs text-ink-4"
          >
            <span class="line-through">{{ row.suggestion.suggestedText }}</span>
            <span>{{ SUGGESTION_CATEGORY_LABEL[row.suggestion.category] }}</span>
            <span class="font-mono">{{ row.segmentId }}</span>
            <BaseButton variant="ghost" size="sm" class="ml-auto" @click="restoreSuggestion(row)"
              >恢复</BaseButton
            >
          </li>
        </ul>
      </div>
    </AsyncStateBoundary>
  </PanelSection>
</template>
