<script setup lang="ts">
/**
 * 流程 6 的草稿与版本信息面板（右栏第三块）。
 *
 * 唯一职责：填写本次变更说明，并展示草稿编号、已保存版本、修改状态与生成来源，
 * 同时把拉取草稿的失败 / 空数据提示就地呈现；不编辑正文，也不触发生成与保存。
 */
import PanelSection from '@/components/common/PanelSection.vue'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { useGenerationDraftContext } from '@/composables/useGenerationDraft'
import type { CreateGenerationResponse, GetDraftResponse } from '@/types/api'

interface Props {
  /** 拉取草稿的任务状态。 */
  fetchState: AsyncTaskState<GetDraftResponse>
  /** 生成初稿的任务状态，用于展示生成来源模型。 */
  genState: AsyncTaskState<CreateGenerationResponse>
}

const props = defineProps<Props>()

const { draftId, savedVersionNo, unsavedEdits, saveNote, humanDraftMode } =
  useGenerationDraftContext()
</script>

<template>
  <PanelSection
    title="草稿与版本"
    description="保存草稿不产生版本号；保存为版本会写入版本记录，供流程 7 回滚。"
  >
    <div class="space-y-2">
      <label class="block">
        <span class="mb-1 block text-2xs text-ink-3">变更说明 note（写入版本记录）</span>
        <input
          v-model="saveNote"
          type="text"
          class="w-full border border-rule bg-paper px-2.5 py-1.5 text-xs text-ink outline-none focus:border-seal-2"
          placeholder="例如：订正窨制次数，补充口述来源标注"
        />
      </label>
      <dl class="space-y-1 text-2xs">
        <div class="flex justify-between gap-2">
          <dt class="text-ink-4">草稿编号</dt>
          <dd class="font-mono text-ink-2">{{ draftId }}</dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-ink-4">已保存版本</dt>
          <dd class="font-mono text-ink-2">
            {{ savedVersionNo ? 'v' + savedVersionNo : '未保存' }}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-ink-4">修改状态</dt>
          <dd :class="unsavedEdits ? 'text-attention' : 'text-verified'">
            {{ unsavedEdits ? '有未保存的人工编辑' : '已保存' }}
          </dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-ink-4">生成来源</dt>
          <dd class="text-ink-2">
            {{ humanDraftMode ? '人工撰写' : (props.genState.data?.aiMeta.model ?? '—') }}
          </dd>
        </div>
      </dl>
      <p v-if="props.fetchState.error" class="text-2xs text-vermilion">
        拉取草稿失败：{{ props.fetchState.error.displayMessage }}
      </p>
      <p v-if="props.fetchState.phase === 'empty'" class="text-2xs text-attention">
        {{ props.fetchState.emptyHint?.reason }}
      </p>
    </div>
  </PanelSection>
</template>
