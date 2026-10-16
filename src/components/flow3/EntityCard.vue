<script setup lang="ts">
/**
 * 单条抽取实体卡片。
 *
 * 唯一职责：渲染一条 ExtractedEntity 的全部展示信息（名称、规范名、确认状态、
 * 置信度、别名、不确定性、原文依据入口、最后修改），并把卡片上的操作以事件抛出；
 * 卡片自身不改写任何数据。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { CONFIRM_LABEL, CONFIRM_TONE } from '@/composables/useEntityFilters'
import type { ActiveEvidence } from '@/composables/useEvidenceTrace'
import type { ExtractedEntity } from '@/types/api'
import { formatDateTime, formatPercent, formatTimecode } from '@/utils/format'

defineProps<{
  entity: ExtractedEntity
  /** 批量确认任务进行中，用于禁用会写数据的按钮。 */
  busy: boolean
}>()

const emit = defineEmits<{
  accept: [entity: ExtractedEntity]
  edit: [entity: ExtractedEntity]
  reject: [entity: ExtractedEntity]
  'find-duplicate': [entity: ExtractedEntity]
  delete: [entity: ExtractedEntity]
  'open-evidence': [target: ActiveEvidence]
}>()
</script>

<template>
  <article
    class="border px-3 py-2.5 transition-colors"
    :class="
      entity.confirmStatus === 'pending' ? 'border-attention bg-attention' : 'border-rule bg-sheet'
    "
  >
    <header class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-ink">{{ entity.name }}</span>
      <span v-if="entity.normalizedName !== entity.name" class="text-2xs text-ink-3">
        规范名：{{ entity.normalizedName }}
      </span>
      <StatusPill :tone="CONFIRM_TONE[entity.confirmStatus]" dense>
        {{ CONFIRM_LABEL[entity.confirmStatus] }}
      </StatusPill>
      <StatusPill v-if="entity.createdByHuman" tone="violet" dense>人工新增</StatusPill>
      <span class="ml-auto font-mono text-2xs text-ink-2">{{
        formatPercent(entity.confidence)
      }}</span>
    </header>

    <div class="mt-1.5 h-1 w-full bg-paper-3">
      <div
        class="h-full"
        :class="entity.confirmStatus === 'pending' ? 'bg-attention' : 'bg-verified'"
        :style="{ width: formatPercent(entity.confidence) }"
      />
    </div>

    <p v-if="entity.aliases.length > 0" class="mt-1.5 text-2xs text-ink-3">
      别名：{{ entity.aliases.join('、') }}
    </p>
    <p v-if="entity.uncertaintyNote" class="mt-1.5 bg-attention px-2 py-1 text-2xs text-attention">
      不确定：{{ entity.uncertaintyNote }}
    </p>

    <div v-if="entity.evidence.length > 0" class="mt-1.5 flex flex-wrap items-center gap-1">
      <span class="text-2xs text-ink-4">原文依据</span>
      <button
        v-for="(evidence, index) in entity.evidence"
        :key="entity.id + '-' + String(index)"
        type="button"
        class="border border-rule px-1.5 py-px text-2xs text-ink-2 transition-colors hover:border-seal-2 hover:text-seal-ink"
        @click="emit('open-evidence', { entity, evidence })"
      >
        <AppIcon name="clip" :size="14" /> {{ formatTimecode(evidence.startMs) }} ·
        {{ evidence.quote }}
      </button>
    </div>
    <p v-else class="mt-1.5 text-2xs text-ink-4">
      无原文依据（人工新增时未补挂来源，接口已支持 evidence 字段，待前端补充交互）。
    </p>

    <footer class="mt-2 flex flex-wrap items-center gap-1.5">
      <template v-if="entity.confirmStatus === 'pending'">
        <BaseButton
          variant="primary"
          size="sm"
          :loading="busy"
          :disabled="busy"
          @click="emit('accept', entity)"
        >
          采纳 AI 建议
        </BaseButton>
        <BaseButton variant="secondary" size="sm" :disabled="busy" @click="emit('edit', entity)">
          修改后采纳
        </BaseButton>
        <BaseButton variant="ghost" size="sm" :disabled="busy" @click="emit('reject', entity)"
          >驳回</BaseButton
        >
      </template>
      <template v-else>
        <BaseButton variant="ghost" size="sm" @click="emit('edit', entity)">编辑</BaseButton>
        <BaseButton
          v-if="entity.confirmStatus !== 'confirmed'"
          variant="secondary"
          size="sm"
          :disabled="busy"
          @click="emit('accept', entity)"
        >
          重新确认
        </BaseButton>
      </template>
      <BaseButton variant="ghost" size="sm" @click="emit('find-duplicate', entity)"
        >查找同义项</BaseButton
      >
      <BaseButton variant="danger" size="sm" class="ml-auto" @click="emit('delete', entity)"
        >删除</BaseButton
      >
    </footer>
    <p class="mt-1 text-2xs text-ink-4">
      最后修改：{{ entity.updatedBy?.name ?? '—' }} ·
      {{ entity.updatedAt ? formatDateTime(entity.updatedAt) : '无记录' }}
    </p>
  </article>
</template>
