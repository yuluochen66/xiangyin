<script setup lang="ts">
/**
 * 流程 2：版本记录弹窗。
 *
 * 唯一职责：在模态框里承载版本列表的 7 态边界与版本条目（来源、作者、变更段数、备注、回滚入口），
 * 并就地展示回滚失败原因；拉取与回滚由 useTranscriptVersions 负责。
 */
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { VERSION_SOURCE_LABEL, VERSION_SOURCE_TONE } from '@/composables/useTranscriptVersions'
import type { TranscriptVersionsApi } from '@/composables/useTranscriptVersions'
import { formatDateTime } from '@/utils/format'

interface Props {
  /** 版本列表与回滚操作。 */
  versions: TranscriptVersionsApi
}

const props = defineProps<Props>()

const {
  versionOpen,
  state,
  canRetry,
  isBusy: busy,
  rollbackIsBusy,
  rollbackError,
  run,
  retry,
  closeVersions,
  askRollback,
} = props.versions
</script>

<template>
  <ModalDialog
    :open="versionOpen"
    title="版本记录（GET /transcripts/{transcriptId}/versions）"
    cancel-text="关闭"
    confirm-text="知道了"
    width-class="max-w-3xl"
    @confirm="closeVersions"
    @cancel="closeVersions"
  >
    <AsyncStateBoundary
      :phase="state.phase"
      :error="state.error"
      :can-retry="canRetry"
      :retry-progress="state.retryProgress"
      empty-title="暂无版本记录"
      :empty-reason="state.emptyHint?.reason"
      :empty-suggestion="state.emptyHint?.suggestion"
      :unavailable-reason="state.unavailableReason"
      loading-text="正在拉取版本记录…"
      :skeleton-rows="3"
      min-height-class="min-h-[180px]"
      @retry="retry"
    >
      <template #idle-actions>
        <BaseButton variant="primary" size="sm" :loading="busy" @click="run">
          拉取版本记录（GET /versions）
        </BaseButton>
      </template>
      <template #empty-actions>
        <BaseButton variant="ghost" size="sm" :loading="busy" @click="run">重新拉取</BaseButton>
      </template>

      <ul class="space-y-2">
        <li
          v-for="record in state.data?.versions ?? []"
          :key="record.versionId"
          class="border border-rule bg-sheet p-2.5"
        >
          <div class="flex flex-wrap items-center gap-2">
            <StatusPill tone="violet" dense>v{{ record.versionNo }}</StatusPill>
            <StatusPill :tone="VERSION_SOURCE_TONE[record.source]" dense>{{
              VERSION_SOURCE_LABEL[record.source]
            }}</StatusPill>
            <StatusPill
              v-if="record.versionId === state.data?.currentVersionId"
              tone="success"
              dense
              >当前版本</StatusPill
            >
            <span class="text-2xs text-ink-3">
              {{ record.createdBy.name }} · {{ formatDateTime(record.createdAt) }}
            </span>
            <span class="text-2xs text-ink-4">变更 {{ record.changedCount }} 段</span>
            <BaseButton
              v-if="record.versionId !== state.data?.currentVersionId"
              variant="secondary"
              size="sm"
              class="ml-auto"
              :disabled="rollbackIsBusy"
              @click="askRollback(record)"
            >
              回滚到此版本
            </BaseButton>
          </div>
          <p v-if="record.note" class="mt-1 text-2xs text-ink-4">{{ record.note }}</p>
        </li>
      </ul>

      <p v-if="rollbackError" class="mt-2 bg-vermilion px-2 py-1 text-2xs text-vermilion">
        回滚失败：{{ rollbackError.displayMessage }}
      </p>
    </AsyncStateBoundary>
  </ModalDialog>
</template>
