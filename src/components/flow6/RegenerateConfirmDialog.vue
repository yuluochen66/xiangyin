<script setup lang="ts">
/**
 * 流程 6 的「重新生成会覆盖未保存编辑」确认框。
 *
 * 唯一职责：把 ModalDialog 包装成覆盖确认——统计被人工编辑过的区块数量，说明
 * keepEditedBlocks 开关对它们的两种后果，并给出「覆盖并重新生成 / 先保存草稿」的选择。
 * 不执行重新生成，也不修改草稿内容。
 */
import ModalDialog from '@/components/common/ModalDialog.vue'
import { useGenerationDraftContext } from '@/composables/useGenerationDraft'

interface Props {
  /** 重新生成是否进行中。 */
  regenBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 确认覆盖未保存的编辑并重新生成。 */
  confirm: []
  /** 取消覆盖，先去保存草稿。 */
  cancel: []
}>()

const { regenConfirmOpen, editableBlocks } = useGenerationDraftContext()
</script>

<template>
  <ModalDialog
    :open="regenConfirmOpen"
    title="重新生成会覆盖未保存的人工编辑"
    :dismissible="true"
    confirm-text="覆盖并重新生成"
    cancel-text="先保存草稿"
    confirm-variant="danger"
    :loading="props.regenBusy"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <p class="text-xs leading-5 text-ink-2">
      当前有
      {{ editableBlocks.filter((block) => block.edited).length }} 个区块被人工编辑过且尚未保存。
      重新生成会覆盖这些修改。
    </p>
    <ul class="mt-2 space-y-1 text-2xs text-ink-3">
      <li>
        · 已开启「保留人工编辑的内容」：这些区块会原样保留，响应里的 preservedBlockIds 会标出它们。
      </li>
      <li>· 若关闭该开关，所有区块都会被重写。</li>
    </ul>
    <p class="mt-3 text-2xs text-attention">
      建议先点「取消」，用下方「保存草稿」保留当前修改，再重新生成。
    </p>
  </ModalDialog>
</template>
