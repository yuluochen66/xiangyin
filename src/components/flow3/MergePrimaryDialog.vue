<script setup lang="ts">
/**
 * 同义项合并弹窗（选择保留哪个主实体）。
 *
 * 唯一职责：列出候选分组的全部成员及其置信度、依据条数，标注 AI 建议保留项，双向同步
 * 选中的主实体，并展示合并失败原因；实际合并由视图在 confirm 事件后执行。
 */
import { computed } from 'vue'

import ModalDialog from '@/components/common/ModalDialog.vue'
import { useEntityLookup } from '@/composables/useEntityLookup'
import type { DuplicateGroup, ExtractedEntity } from '@/types/api'
import { formatPercent } from '@/utils/format'

const props = defineProps<{
  group: DuplicateGroup | null
  /** 用于把成员 id 解析成名称 / 置信度 / 依据条数。 */
  entities: ExtractedEntity[]
  /** 合并任务进行中。 */
  busy: boolean
  /** 合并失败原因，无失败时为 null。 */
  errorMessage: string | null
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const primaryId = defineModel<string>('primaryId', { required: true })

const { entityName, entityConfidenceText, entityEvidenceCount } = useEntityLookup(
  computed(() => props.entities),
)
</script>

<template>
  <ModalDialog
    :open="group !== null"
    title="选择要保留的主实体"
    confirm-text="确认合并"
    confirm-variant="danger"
    :loading="busy"
    :confirm-disabled="primaryId === ''"
    :dismissible="!busy"
    width-class="max-w-xl"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div v-if="group" class="space-y-3">
      <p class="text-xs leading-5 text-ink-2">
        {{ group.reason }}（相似度 {{ formatPercent(group.similarity) }}）
      </p>
      <div class="space-y-2">
        <label
          v-for="id in group.memberIds"
          :key="id"
          class="flex cursor-pointer items-start gap-2 border px-2.5 py-2 transition-colors"
          :class="primaryId === id ? 'border-seal-2 bg-seal' : 'border-rule'"
        >
          <input v-model="primaryId" type="radio" :value="id" class="mt-0.5 accent-seal-ink" />
          <span class="min-w-0">
            <span class="block text-xs text-ink">
              {{ entityName(id) }}
              <span v-if="id === group.suggestedPrimaryId" class="ml-1 text-2xs text-seal-ink"
                >AI 建议保留</span
              >
            </span>
            <span class="block text-2xs text-ink-4">
              置信度 {{ entityConfidenceText(id) }} · 原文依据 {{ entityEvidenceCount(id) }} 条
            </span>
          </span>
        </label>
      </div>
      <p class="text-2xs leading-5 text-ink-3">
        被合并实体的别名与原文依据会并入主实体；确认后将调用 POST
        /extractions/{extractionId}/entities:merge，并展示 mergedAliases 与 removedIds。
      </p>
      <p v-if="errorMessage" class="bg-vermilion px-2 py-1 text-2xs text-vermilion">
        合并失败：{{ errorMessage }}
      </p>
    </div>
  </ModalDialog>
</template>
