<script setup lang="ts">
/**
 * 标注提交条。
 *
 * 唯一职责：固定在页面底部的提交区——汇总本次变更 / 未标注 / 缺原因 / 调用次数，
 * 展示提交失败的就地提示，并提供增量保存、提交整批与重新拉取三个入口。
 */
import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  /** 本次变更条数。 */
  dirtyCount: number
  /** 未标注条数。 */
  missingCount: number
  /** 判定缺少差异原因的条数。 */
  reasonIssueCount: number
  /** 已调用提交接口的次数。 */
  submitAttempts: number
  /** 提交失败的就地提示。 */
  submitError: string | undefined
  /** 是否正在提交。 */
  submitBusy: boolean
  /** 本次提交是否为整批提交。 */
  submitAllMode: boolean
  /** 已标注条数。 */
  annotatedCount: number
  /** 比对任务是否正在进行（重新拉取按钮的禁用依据）。 */
  taskBusy: boolean
  /** 比对任务 id。 */
  comparisonId: string
  /** 标注人姓名。 */
  annotatorName: string
  /** 标注人角色。 */
  annotatorRole: string
}

defineProps<Props>()

const emit = defineEmits<{
  save: []
  submitAll: []
  reload: []
}>()
</script>

<template>
  <footer class="sticky bottom-0 z-20 space-y-2 border border-rule bg-sheet p-3">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs">
      <span class="text-ink-2"
        >本次变更 <b class="text-ink">{{ dirtyCount }}</b> 条</span
      >
      <span :class="missingCount > 0 ? 'text-attention' : 'text-ink-4'">
        未标注 {{ missingCount }} 条
      </span>
      <span v-if="reasonIssueCount > 0" class="text-vermilion">
        还有 {{ reasonIssueCount }} 条判定缺少差异原因
      </span>
      <span v-if="submitAttempts > 0" class="text-ink-4">
        已调用提交接口 {{ submitAttempts }} 次
      </span>
      <span class="ml-auto font-mono text-ink-4">
        POST /comparisons/{{ comparisonId }}/annotations
      </span>
    </div>

    <p v-if="submitError" class="bg-vermilion-wash px-2.5 py-1.5 text-2xs text-vermilion">
      {{ submitError }}（已填写的内容仍保留在界面上，可稍后重试）
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <BaseButton
        variant="primary"
        size="sm"
        :loading="submitBusy && !submitAllMode"
        :disabled="submitBusy || dirtyCount === 0 || reasonIssueCount > 0"
        title="增量保存：只提交本次变更的条目（submitAll=false）"
        @click="emit('save')"
      >
        保存标注（增量 · submitAll=false）
      </BaseButton>
      <BaseButton
        variant="secondary"
        size="sm"
        :loading="submitBusy && submitAllMode"
        :disabled="submitBusy || annotatedCount === 0 || reasonIssueCount > 0"
        title="提交整批：submitAll=true，提交前校验未标注条数"
        @click="emit('submitAll')"
      >
        提交全部标注（submitAll=true）
      </BaseButton>
      <BaseButton
        variant="ghost"
        size="sm"
        :disabled="taskBusy || submitBusy"
        @click="emit('reload')"
      >
        重新拉取
      </BaseButton>
      <span class="text-2xs text-ink-4">
        标注人 <b class="text-ink-2">{{ annotatorName }}</b> （{{ annotatorRole }}）
      </span>
    </div>
  </footer>
</template>
