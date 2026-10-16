<script setup lang="ts">
/**
 * 疑似同义项合并面板。
 *
 * 唯一职责：列出后端返回的同义项候选分组（相似度、建议主实体、成员摘要）与最近一次合并
 * 结果，并把「合并…」与「重新拉取分组」两个动作抛出；不发起任何接口调用。
 */
import { computed } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { MergeResultSummary } from '@/composables/useEntityMerge'
import { useEntityLookup } from '@/composables/useEntityLookup'
import type { DuplicateGroup, ExtractedEntity } from '@/types/api'
import { formatPercent } from '@/utils/format'

const props = defineProps<{
  groups: DuplicateGroup[]
  mergeResult: MergeResultSummary | null
  /** 用于把成员 id 解析成名称 / 置信度 / 依据条数。 */
  entities: ExtractedEntity[]
  mergeBusy: boolean
  busy: boolean
}>()

const emit = defineEmits<{ merge: [group: DuplicateGroup]; reload: [] }>()

const { entityName, entityConfidenceText, entityEvidenceCount } = useEntityLookup(
  computed(() => props.entities),
)
</script>

<template>
  <PanelSection
    title="疑似同义项合并"
    :description="
      '后端返回 ' +
      String(groups.length) +
      ' 组候选；合并会把别名与原文依据并入主实体，并移除被合并实体。'
    "
  >
    <template #actions>
      <BaseButton variant="ghost" size="sm" :loading="busy" @click="emit('reload')">
        重新拉取分组（GET）
      </BaseButton>
    </template>

    <p v-if="groups.length === 0" class="text-2xs text-ink-4">
      后端未返回同义项候选，或已全部合并。人工新增 / 编辑实体后，分组需重新拉取才会刷新。
    </p>
    <div v-else class="space-y-2">
      <article
        v-for="group in groups"
        :key="group.groupId"
        class="border border-rule bg-sheet p-2.5"
      >
        <header class="flex flex-wrap items-center gap-2 text-2xs">
          <StatusPill tone="info" dense>相似度 {{ formatPercent(group.similarity) }}</StatusPill>
          <StatusPill tone="violet" dense
            >建议主实体：{{ entityName(group.suggestedPrimaryId) }}</StatusPill
          >
          <span class="text-ink-4">{{ group.memberIds.length }} 个成员</span>
          <BaseButton
            v-if="group.memberIds.length > 1"
            variant="secondary"
            size="sm"
            class="ml-auto"
            :disabled="mergeBusy"
            @click="emit('merge', group)"
          >
            合并…
          </BaseButton>
          <span v-else class="ml-auto text-2xs text-ink-4">
            仅 1 个成员，无需合并（多为规范名不一致的单项提示）
          </span>
        </header>
        <p class="mt-1 text-2xs leading-5 text-ink-3">{{ group.reason }}</p>
        <div class="mt-1.5 flex flex-wrap gap-1">
          <span
            v-for="id in group.memberIds"
            :key="id"
            class="border border-rule px-1.5 py-px text-2xs text-ink-2"
          >
            {{ entityName(id) }} · {{ entityConfidenceText(id) }} · 依据
            {{ entityEvidenceCount(id) }} 条
          </span>
        </div>
      </article>
    </div>

    <p v-if="mergeResult" class="mt-2 bg-verified px-2 py-1 text-2xs text-verified">
      最近一次合并结果：mergedAliases =
      {{ mergeResult.mergedAliases.join('、') || '无' }}；removedIds =
      {{ mergeResult.removedIds.join('、') || '无' }}。
    </p>
  </PanelSection>
</template>
