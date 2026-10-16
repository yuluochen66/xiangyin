<script setup lang="ts">
/**
 * AI 抽取概览与批量确认面板。
 *
 * 唯一职责：展示模型版本 / 耗时 / 自评置信度 / 待确认数量与待确认实体名单，并提供
 * 「一键确认全部」「全部驳回」「手工新增实体」三个入口；本组件不发起任何接口调用。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import { KIND_LABEL } from '@/composables/useEntityFilters'
import type { AiMeta, ExtractedEntity, StartExtractionResponse } from '@/types/api'
import { formatPercent } from '@/utils/format'

defineProps<{
  aiMeta: AiMeta | null
  pendingCount: number
  pendingEntities: ExtractedEntity[]
  startData: StartExtractionResponse | null
  /** 批量确认任务进行中。 */
  batchBusy: boolean
}>()

const emit = defineEmits<{
  'confirm-all': []
  'reject-all': []
  create: []
}>()
</script>

<template>
  <PanelSection
    title="AI 抽取概览与批量确认"
    description="模型版本与耗时一并留痕；采纳 / 驳回都会记录操作人，未确认项不可进入检索流程。"
  >
    <template #actions>
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="batchBusy"
        :disabled="batchBusy || pendingCount === 0"
        @click="emit('confirm-all')"
      >
        一键确认全部（{{ pendingCount }}）
      </BaseButton>
      <BaseButton
        variant="ghost"
        size="sm"
        :loading="batchBusy"
        :disabled="batchBusy || pendingCount === 0"
        @click="emit('reject-all')"
      >
        全部驳回
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('create')">手工新增实体</BaseButton>
    </template>
    <div class="grid gap-2 text-2xs text-ink-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        模型：<span class="text-ink">{{ aiMeta?.model ?? '未加载' }}</span>
        <span class="ml-1 text-ink-4">{{ aiMeta?.modelVersion ?? '' }}</span>
      </div>
      <div>
        AI 耗时：<span class="text-ink">{{ aiMeta ? String(aiMeta.tookMs) + ' ms' : '-' }}</span>
      </div>
      <div>
        整体自评置信度：<span class="text-ink">{{
          aiMeta ? formatPercent(aiMeta.confidence) : '-'
        }}</span>
      </div>
      <div>
        待人工确认：
        <span :class="pendingCount > 0 ? 'text-attention' : 'text-verified'"
          >{{ pendingCount }} 条</span
        >
      </div>
    </div>
    <p class="mt-2 bg-attention px-2 py-1 text-2xs text-attention">
      AI 抽取结果仅供参考，未确认项不可进入检索流程；提示词版本
      {{ aiMeta?.promptVersion ?? '未提供' }}。
    </p>
    <p
      v-if="pendingEntities.length > 0"
      class="mt-1.5 flex flex-wrap items-center gap-1 text-2xs text-attention"
    >
      <span>待确认实体：</span>
      <span
        v-for="item in pendingEntities"
        :key="item.id"
        class="border border-attention px-1.5 py-px"
      >
        {{ KIND_LABEL[item.kind] }}·{{ item.name }}（{{ formatPercent(item.confidence) }}）
      </span>
    </p>
    <p v-if="startData" class="mt-1 text-2xs text-ink-4">
      最近一次抽取：任务 {{ startData.taskId }}（{{ startData.status }}）。
    </p>
  </PanelSection>
</template>
