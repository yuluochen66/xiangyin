<script setup lang="ts">
/**
 * 删除实体二次确认弹窗。
 *
 * 唯一职责：说明将删除的实体、其原文依据条数与删除后果，并展示删除失败原因；
 * 实际删除由视图在 confirm 事件后执行。
 */
import ModalDialog from '@/components/common/ModalDialog.vue'
import { KIND_LABEL } from '@/composables/useEntityFilters'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type { ExtractedEntity } from '@/types/api'

defineProps<{
  target: ExtractedEntity | null
  /** 删除任务进行中。 */
  busy: boolean
  /** 删除失败原因，无失败时为 null。 */
  errorMessage: string | null
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <ModalDialog
    :open="target !== null"
    title="删除实体？"
    confirm-text="删除"
    confirm-variant="danger"
    :loading="busy"
    :dismissible="!busy"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div v-if="target" class="space-y-2">
      <p class="text-xs leading-6 text-ink-2">
        将删除 {{ KIND_LABEL[target.kind] }}「<span class="text-vermilion">{{ target.name }}</span
        >」 及其 {{ target.evidence.length }} 条原文依据。
      </p>
      <ul class="list-disc space-y-1 pl-4 text-2xs text-ink-3">
        <li>操作人会记录为 {{ CURRENT_OPERATOR.name }}；当前 mock 为硬删除，前端无法撤销。</li>
        <li>删除后同义项分组会重新计算；如误删，可重新发起抽取或手工新增。</li>
      </ul>
      <p v-if="errorMessage" class="bg-vermilion px-2 py-1 text-2xs text-vermilion">
        删除失败：{{ errorMessage }}
      </p>
    </div>
  </ModalDialog>
</template>
