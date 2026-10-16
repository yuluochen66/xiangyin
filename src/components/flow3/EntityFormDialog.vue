<script setup lang="ts">
/**
 * 手工新增 / 编辑实体弹窗。
 *
 * 唯一职责：渲染实体表单（类别、原文形式、规范名、别名、不确定性说明），把字段改动以
 * 补丁事件回传，并展示保存入口的说明与失败原因；本组件不校验、不调用接口，保存由视图执行。
 */
import ModalDialog from '@/components/common/ModalDialog.vue'
import { ENTITY_KINDS, KIND_LABEL } from '@/composables/useEntityFilters'
import type { EntityForm } from '@/composables/useEntityForm'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import type { EntityKind } from '@/types/api'

defineProps<{
  open: boolean
  /** 当前表单内容（由视图持有，本组件只读）。 */
  form: EntityForm
  /** 保存任务进行中。 */
  busy: boolean
  /** 保存失败原因，无失败时为 null。 */
  errorMessage: string | null
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
  patch: [patch: Partial<EntityForm>]
}>()

/**
 * 读取文本输入框的当前值。
 * @param event 触发 input 事件的原生事件
 * @returns 输入框中的文本
 */
function readValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

/**
 * 读取类别下拉框的当前值。
 * @param event 触发 change 事件的原生事件
 * @returns 选中的实体类别
 */
function readKind(event: Event): EntityKind {
  return (event.target as HTMLSelectElement).value as EntityKind
}
</script>

<template>
  <ModalDialog
    :open="open"
    :title="form.entityId ? '编辑实体（保存后标记为已确认）' : '手工新增实体'"
    confirm-text="保存实体"
    :loading="busy"
    :dismissible="!busy"
    width-class="max-w-2xl"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div class="space-y-3">
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-2xs text-ink-3">
          类别（kind）
          <select
            :value="form.kind"
            class="mt-1 h-8 w-full border border-rule bg-sheet px-2 text-xs text-ink focus:border-seal-2 focus:outline-none"
            @change="emit('patch', { kind: readKind($event) })"
          >
            <option v-for="kind in ENTITY_KINDS" :key="kind" :value="kind">
              {{ KIND_LABEL[kind] }}
            </option>
          </select>
        </label>
        <label class="block text-2xs text-ink-3">
          原文形式（name）
          <input
            :value="form.name"
            type="text"
            placeholder="例如：三坊巷"
            class="mt-1 h-8 w-full border border-rule bg-sheet px-2 text-xs text-ink placeholder:text-ink-4 focus:border-seal-2 focus:outline-none"
            @input="emit('patch', { name: readValue($event) })"
          />
        </label>
        <label class="block text-2xs text-ink-3">
          规范名（normalizedName，留空则同 name）
          <input
            :value="form.normalizedName"
            type="text"
            placeholder="例如：三坊七巷"
            class="mt-1 h-8 w-full border border-rule bg-sheet px-2 text-xs text-ink placeholder:text-ink-4 focus:border-seal-2 focus:outline-none"
            @input="emit('patch', { normalizedName: readValue($event) })"
          />
        </label>
        <label class="block text-2xs text-ink-3">
          别名（逗号分隔）
          <input
            :value="form.aliases"
            type="text"
            placeholder="三坊巷，三坊七巷历史文化街区"
            class="mt-1 h-8 w-full border border-rule bg-sheet px-2 text-xs text-ink placeholder:text-ink-4 focus:border-seal-2 focus:outline-none"
            @input="emit('patch', { aliases: readValue($event) })"
          />
        </label>
      </div>
      <label class="block text-2xs text-ink-3">
        不确定性说明（uncertaintyNote）
        <textarea
          :value="form.uncertaintyNote"
          rows="2"
          placeholder="例如：讲述人发音含混，需与族谱核对"
          class="mt-1 w-full border border-rule bg-sheet px-2 py-1.5 text-xs leading-5 text-ink placeholder:text-ink-4 focus:border-seal-2 focus:outline-none"
          @input="emit('patch', { uncertaintyNote: readValue($event) })"
        />
      </label>
      <p class="text-2xs leading-5 text-ink-4">
        保存会调用 POST /extractions/{extractionId}/entities，并记录操作人
        {{ CURRENT_OPERATOR.name }}（{{
          CURRENT_OPERATOR.role
        }}）。人工新增实体不会伪造原文依据，可在后续流程补挂。
      </p>
      <p v-if="errorMessage" class="bg-vermilion px-2 py-1 text-2xs text-vermilion">
        保存失败：{{ errorMessage }}（表单内容保留，可修改后重试）
      </p>
    </div>
  </ModalDialog>
</template>
