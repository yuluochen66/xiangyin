<script setup lang="ts">
/**
 * 单条比对项的人工判定区。
 *
 * 唯一职责：让标注人选择最终结论、在「差异 / 待核实」时必填差异原因并可选分类标签，
 * 就地显示必填校验与服务端校验失败的提示，并提供放弃本条改动。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { needsReason } from '@/composables/useComparisonDraftRules'
import {
  CONFLICT_REASON_LABEL,
  CONFLICT_REASON_OPTIONS,
  VERDICT_ACTIVE_CLASS,
  VERDICT_META,
  VERDICT_OPTIONS,
} from '@/composables/useComparisonMeta'
import type { CompareVerdict, ConflictReasonTag } from '@/types/api'

interface Props {
  /** 该条当前的草稿结论；未标注时为 null。 */
  verdict: CompareVerdict | null
  /** 该条当前的草稿原因。 */
  reason: string
  /** 该条当前选中的差异原因分类。 */
  tags: ConflictReasonTag[]
  /** 该条是否有未保存改动。 */
  dirty: boolean
  /** 服务端返回的就地校验提示。 */
  invalidMessage: string | undefined
  /** 必填校验提示；无错误时为 null。 */
  reasonError: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  setVerdict: [verdict: CompareVerdict]
  setReason: [event: Event]
  toggleTag: [tag: ConflictReasonTag]
  clearDraft: []
}>()
</script>

<template>
  <div
    class="space-y-2 border p-2.5"
    :class="reasonError ? 'border-vermilion bg-vermilion-wash' : 'border-rule bg-sheet'"
  >
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-2xs font-medium text-ink-2">人工判定</span>
      <span class="text-2xs text-ink-4">
        选择「差异 / 待核实」必须填写差异原因，否则不允许保存
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="option in VERDICT_OPTIONS"
        :key="option"
        type="button"
        class="px-2 py-1 text-2xs ring-1 ring-inset transition-colors"
        :class="
          verdict === option
            ? VERDICT_ACTIVE_CLASS[option]
            : 'bg-paper-3 text-ink-3 ring-rule hover:text-ink'
        "
        @click="emit('setVerdict', option)"
      >
        <AppIcon :name="VERDICT_META[option].icon" :size="12" />
        {{ VERDICT_META[option].label }}
      </button>
      <BaseButton v-if="dirty" variant="ghost" size="sm" @click="emit('clearDraft')">
        放弃本条改动
      </BaseButton>
    </div>

    <template v-if="needsReason(verdict)">
      <label class="block space-y-1">
        <span class="text-2xs text-ink-3">差异原因 <span class="text-vermilion">*</span></span>
        <textarea
          :value="reason"
          rows="2"
          class="w-full resize-y border border-rule bg-paper px-2 py-1.5 text-2xs text-ink outline-none placeholder:text-ink-4 focus:border-seal-2"
          placeholder="说明创作内容与资料在哪些点上不一致，例如「资料记三至七窨，草稿写八至十次」"
          @input="emit('setReason', $event)"
        />
      </label>

      <div class="space-y-1">
        <p class="text-2xs text-ink-3">差异原因分类（可多选）</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tag in CONFLICT_REASON_OPTIONS"
            :key="tag"
            type="button"
            class="px-1.5 py-0.5 text-2xs ring-1 ring-inset transition-colors"
            :class="
              tags.includes(tag)
                ? 'bg-attention text-attention ring-attention'
                : 'bg-paper-3 text-ink-3 ring-rule hover:text-ink'
            "
            @click="emit('toggleTag', tag)"
          >
            {{ CONFLICT_REASON_LABEL[tag] }}
          </button>
        </div>
      </div>

      <p v-if="reasonError" class="text-2xs text-vermilion">
        <AppIcon name="alert" :size="14" /> {{ reasonError }}
      </p>
    </template>

    <p v-if="invalidMessage" class="bg-vermilion-wash px-2 py-1 text-2xs text-vermilion">
      提交未通过：{{ invalidMessage }}
    </p>
  </div>
</template>
