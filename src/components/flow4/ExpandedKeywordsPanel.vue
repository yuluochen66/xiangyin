<script setup lang="ts">
/**
 * 流程 4 的「AI 检索增强 · 扩展检索词」面板。
 *
 * 唯一职责：展示 AI 扩展出的检索词（词 / 权重 / 命中数 / 理由）与 aiMeta
 * （模型、版本、耗时、置信度），提供逐条「加入关键词」「忽略该扩展词」，
 * 并把两个动作冒泡给主视图。本组件不持有忽略状态、不发请求。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { AiMeta, ExpandedKeyword, SearchSourcesResponse } from '@/types/api'

interface Props {
  result: SearchSourcesResponse | null
  visibleExpandedKeywords: ExpandedKeyword[]
  aiMeta: AiMeta | undefined
  enableQueryExpansion: boolean
  isBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{ adopt: [term: string]; ignore: [term: string] }>()
</script>

<template>
  <!-- AI 扩展检索词（AI 介入点） -->
  <PanelSection
    v-if="props.result"
    title="AI 检索增强 · 扩展检索词"
    description="每个扩展词都给出权重与理由，采纳后会重新检索，忽略只影响展示。"
  >
    <template #actions>
      <StatusPill v-if="props.aiMeta" tone="violet" dense>
        {{ props.aiMeta?.model }} · {{ props.aiMeta?.modelVersion }}
      </StatusPill>
      <StatusPill v-if="props.aiMeta" tone="neutral" dense
        >模型耗时 {{ props.aiMeta?.tookMs }} ms</StatusPill
      >
      <StatusPill v-if="props.aiMeta" tone="info" dense>
        置信度 {{ ((props.aiMeta?.confidence ?? 0) * 100).toFixed(0) }}%
      </StatusPill>
    </template>

    <p v-if="props.visibleExpandedKeywords.length === 0" class="text-2xs leading-4 text-ink-4">
      {{
        props.enableQueryExpansion
          ? '本次没有扩展出新的检索词（关键词已覆盖，或后端未返回扩展）。'
          : '「智能扩展检索词」已关闭，未调用扩展模型；打开开关后重新检索即可看到候选词。'
      }}
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="item in props.visibleExpandedKeywords"
        :key="item.term"
        class="flex flex-wrap items-center gap-2 border border-rule bg-paper px-2.5 py-2"
      >
        <span class="text-xs font-medium text-ink">{{ item.term }}</span>
        <StatusPill tone="violet" dense>权重 {{ item.weight.toFixed(2) }}</StatusPill>
        <StatusPill tone="neutral" dense>命中 {{ item.hitCount }} 条</StatusPill>
        <p class="w-full text-2xs leading-4 text-ink-3">理由：{{ item.reason }}</p>
        <div class="flex flex-wrap gap-1.5">
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="props.isBusy"
            @click="emit('adopt', item.term)"
          >
            加入关键词
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="emit('ignore', item.term)">
            忽略该扩展词
          </BaseButton>
        </div>
      </li>
    </ul>
  </PanelSection>
</template>
