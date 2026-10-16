<script setup lang="ts">
/**
 * 提交整批前的二次确认框。
 *
 * 唯一职责：在还有未标注条目时，把「本次将提交哪些结论」与提交体的约定摊开给用户，
 * 只有确认后才允许以 submitAll=true 提交整批。
 */
import ModalDialog from '@/components/common/ModalDialog.vue'
import type { AnnotationStats } from '@/types/api'

interface Props {
  /** 弹窗是否打开。 */
  open: boolean
  /** 界面上的实时统计。 */
  stats: AnnotationStats
  /** 未标注条数。 */
  missingCount: number
  /** 本次将提交的条数。 */
  submitCount: number
  /** 判定缺少差异原因的条数。 */
  reasonIssueCount: number
  /** 标注人 id。 */
  annotatorId: string
  /** 是否正在提交。 */
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <ModalDialog
    :open="open"
    title="提交全部标注"
    confirm-text="确认提交整批"
    cancel-text="继续标注"
    :loading="loading"
    :confirm-disabled="reasonIssueCount > 0"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div class="space-y-3">
      <p class="text-xs leading-5 text-ink-2">
        当前还有 <b class="text-attention">{{ missingCount }}</b> 条比对项未标注（共
        {{ stats.total }}
        条）。提交整批后，未标注的条目仍保持「未标注」状态，审核时需要补充结论。
      </p>

      <ul class="grid grid-cols-2 gap-1.5 text-2xs text-ink-3">
        <li>一致：{{ stats.consistent }} 条</li>
        <li>差异：{{ stats.conflict }} 条</li>
        <li>待核实：{{ stats.needsVerification }} 条</li>
        <li>资料不足：{{ stats.insufficient }} 条</li>
        <li>与 AI 不一致：{{ stats.disagreedWithAi }} 条</li>
        <li>本次将提交：{{ submitCount }} 条</li>
      </ul>

      <p class="bg-paper-3 px-2.5 py-1.5 text-2xs leading-4 text-ink-3">
        请求体：submitAll=true、annotations=本次全部已标注条目、annotator={{ annotatorId }}。
        服务端校验失败的条目会就地标出，且不会丢失已填写的内容。
      </p>

      <p v-if="reasonIssueCount > 0" class="text-2xs text-vermilion">
        还有 {{ reasonIssueCount }} 条「差异 / 待核实」未填写原因，请先补齐后再提交整批。
      </p>
    </div>
  </ModalDialog>
</template>
