<script setup lang="ts">
/**
 * 流程 2：回滚二次确认弹窗。
 *
 * 唯一职责：把「将要回滚到哪个版本、会发生什么、有多少未提交修改会被清空」讲清楚，
 * 并把确认 / 取消交给 useTranscriptVersions；不执行回滚本身。
 */
import ModalDialog from '@/components/common/ModalDialog.vue'
import type { TranscriptDraftsApi } from '@/composables/useTranscriptDrafts'
import { VERSION_SOURCE_LABEL } from '@/composables/useTranscriptVersions'
import type { TranscriptVersionsApi } from '@/composables/useTranscriptVersions'
import { formatDateTime } from '@/utils/format'

interface Props {
  /** 回滚操作与待确认版本。 */
  versions: TranscriptVersionsApi
  /** 逐段草稿（读取未提交的本地修改段数）。 */
  drafts: TranscriptDraftsApi
}

const props = defineProps<Props>()

const { pendingRollback, rollbackIsBusy, rollbackError, confirmRollback, cancelRollback } =
  props.versions
const { draftCount } = props.drafts
</script>

<template>
  <ModalDialog
    :open="pendingRollback !== null"
    title="确认回滚到历史版本？"
    confirm-text="确认回滚"
    confirm-variant="danger"
    :loading="rollbackIsBusy"
    :dismissible="!rollbackIsBusy"
    @confirm="confirmRollback"
    @cancel="cancelRollback"
  >
    <div v-if="pendingRollback" class="space-y-2">
      <p class="text-xs leading-6 text-ink-2">
        将回滚到
        <span class="text-seal-ink">v{{ pendingRollback.versionNo }}</span>
        （{{ VERSION_SOURCE_LABEL[pendingRollback.source] }} ·
        {{ pendingRollback.createdBy.name }} · {{ formatDateTime(pendingRollback.createdAt) }}）。
      </p>
      <ul class="list-disc space-y-1 pl-4 text-2xs text-ink-3">
        <li>回滚会生成一个新版本，不删除历史版本，可再次回滚。</li>
        <li v-if="pendingRollback.source === 'ai'">
          回滚到 AI 初稿会恢复低置信度标记，需要重新人工校正。
        </li>
        <li>未提交的本地修改共 {{ draftCount }} 段，回滚后会被清空。</li>
      </ul>
      <p v-if="rollbackError" class="bg-vermilion px-2 py-1 text-2xs text-vermilion">
        上一次回滚失败：{{ rollbackError.displayMessage }}
      </p>
    </div>
  </ModalDialog>
</template>
