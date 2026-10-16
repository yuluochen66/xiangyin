<script setup lang="ts">
/**
 * 回滚二次确认弹窗。
 *
 * 唯一职责：在选定回滚目标后，展示目标版本号、状态与风险等级并做二次确认；
 * 回滚接口调用由共享上下文负责。
 */
import { PUBLISH_STATUS_META } from '@/api'
import ModalDialog from '@/components/common/ModalDialog.vue'
import { usePublishFlowContext } from '@/composables/usePublishFlow'
import { RISK_SCORE_LABEL } from '@/composables/usePublishRiskCheck'

const { rollbackTarget, rollbackBusy, doRollback } = usePublishFlowContext()
</script>

<template>
  <ModalDialog
    :open="rollbackTarget !== null"
    title="回滚到历史版本"
    :dismissible="true"
    confirm-text="确认回滚"
    cancel-text="取消"
    confirm-variant="danger"
    :loading="rollbackBusy"
    @confirm="doRollback"
    @cancel="rollbackTarget = null"
  >
    <p v-if="rollbackTarget" class="text-xs leading-5 text-ink-2">
      将把内容回滚到版本 v{{ rollbackTarget.versionNo }}（状态
      {{ PUBLISH_STATUS_META[rollbackTarget.status].label }}，风险等级
      {{ RISK_SCORE_LABEL[rollbackTarget.riskLevel] }}）。
    </p>
    <p class="mt-2 text-2xs leading-4 text-attention">
      回滚会生成一个新版本，当前版本不会被删除，可在版本记录中再次切回。
    </p>
  </ModalDialog>
</template>
