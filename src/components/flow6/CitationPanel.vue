<script setup lang="ts">
/**
 * 流程 6 的引用来源标注面板（右栏第一块）。
 *
 * 唯一职责：展示角标数 / 实际引用资料数 / 因风险排除数的概览，逐条列出角标对应的资料、
 * 定位与原文引文，并解释「为什么少用了资料」；不生成正文，也不处理风险与版本。
 */
import EmptyState from '@/components/common/EmptyState.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import {
  CREDIBILITY_LABEL,
  CREDIBILITY_TONE,
  useGenerationFormContext,
} from '@/composables/useGenerationForm'
import { useGenerationDraftContext } from '@/composables/useGenerationDraft'

const { sourceOptions } = useGenerationFormContext()
const { citations, usedSourceIds, omittedSourceIds, activeCitation, focusCitation } =
  useGenerationDraftContext()
</script>

<template>
  <PanelSection title="引用来源标注" description="角标与资料的对应关系；点击角标或序号可互相定位。">
    <div class="space-y-3">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="border border-rule bg-paper px-2 py-1.5">
          <p class="font-mono text-sm text-ink">{{ citations.length }}</p>
          <p class="text-2xs text-ink-4">角标数</p>
        </div>
        <div class="border border-rule bg-paper px-2 py-1.5">
          <p class="font-mono text-sm text-verified">{{ usedSourceIds.length }}</p>
          <p class="text-2xs text-ink-4">实际引用资料</p>
        </div>
        <div class="border border-rule bg-paper px-2 py-1.5">
          <p
            class="font-mono text-sm"
            :class="omittedSourceIds.length > 0 ? 'text-attention' : 'text-ink'"
          >
            {{ omittedSourceIds.length }}
          </p>
          <p class="text-2xs text-ink-4">因风险排除</p>
        </div>
      </div>

      <div
        v-if="omittedSourceIds.length > 0"
        class="border border-attention bg-attention-wash p-2.5"
      >
        <p class="text-2xs font-medium text-attention">为什么少用了资料？</p>
        <p class="mt-1 text-2xs leading-4 text-attention">
          后端从 usedSourceIds 中剔除了这些资料：一般为可信度不足、与本次纳入的论断无直接对应，
          或授权范围不覆盖公开发布。逐条排除原因后端暂未返回（待确认）。
        </p>
        <ul class="mt-2 space-y-1">
          <li
            v-for="sourceId in omittedSourceIds"
            :key="sourceId"
            class="flex items-center gap-1.5 text-2xs text-attention"
          >
            <span class="font-mono text-2xs text-attention">{{ sourceId }}</span>
            <span class="truncate">
              {{
                sourceOptions.find((item) => item.sourceId === sourceId)?.title ??
                '资料不在当前检索结果中'
              }}
            </span>
          </li>
        </ul>
      </div>

      <EmptyState
        v-if="citations.length === 0"
        icon="bookmark"
        title="暂无引用标注"
        description="生成初稿后，这里会列出每条角标对应的资料、定位与原文引文。"
      />
      <ul v-else class="space-y-2">
        <li
          v-for="citation in citations"
          :id="'citation-' + citation.index"
          :key="citation.index"
          class="border p-2.5 transition-colors"
          :class="
            activeCitation === citation.index ? 'border-seal-2 bg-seal' : 'border-rule bg-paper'
          "
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              class="px-1 text-2xs font-semibold ring-1 ring-inset"
              :class="
                activeCitation === citation.index
                  ? 'bg-seal text-sheet ring-seal-2'
                  : 'bg-seal text-seal-ink ring-seal-2'
              "
              @click="focusCitation(citation.index)"
            >
              [{{ citation.index }}]
            </button>
            <StatusPill :tone="CREDIBILITY_TONE[citation.credibility]" dense>
              {{ CREDIBILITY_LABEL[citation.credibility] }}
            </StatusPill>
            <span class="ml-auto font-mono text-2xs text-ink-4">{{ citation.sourceId }}</span>
          </div>
          <p class="mt-1 text-xs text-ink">{{ citation.sourceTitle }}</p>
          <p class="text-2xs text-ink-4">{{ citation.publisher }} · {{ citation.locatorText }}</p>
          <p class="mt-1.5 border-rule pl-2 text-2xs italic leading-5 text-ink-3">
            “{{ citation.quote }}”
          </p>
        </li>
      </ul>
    </div>
  </PanelSection>
</template>
