<script setup lang="ts">
/**
 * 流程 2：AI 转写元信息与低置信度阈值。
 *
 * 唯一职责：只读展示主任务返回的模型信息、调用统计与阈值口径，
 * 以及最近一次「发起转写」的结果；不承载任何修改操作。
 */
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { AsyncTaskState } from '@/composables/useAsyncTask'
import { mockStore } from '@/mock/store'
import type { GetTranscriptResponse, StartTranscribeResponse } from '@/types/api'
import { formatPercent } from '@/utils/format'

interface Props {
  /** 主任务（拉取转写结果）状态快照。 */
  state: AsyncTaskState<GetTranscriptResponse>
  /** 发起转写任务的状态快照。 */
  startState: AsyncTaskState<StartTranscribeResponse>
  /** 当前低置信度阈值（0~1）。 */
  threshold: number
}

defineProps<Props>()
</script>

<template>
  <PanelSection
    title="AI 转写元信息与低置信度阈值"
    description="阈值来自后端（GET /transcripts/{transcriptId} → lowConfidenceThreshold），前端只展示不重复判断。"
  >
    <template #actions>
      <StatusPill v-if="state.fromMock" tone="warning" dense>mock 数据</StatusPill>
      <StatusPill v-if="state.tookMs !== null" tone="neutral" dense
        >耗时 {{ state.tookMs }} ms</StatusPill
      >
      <StatusPill tone="neutral" dense>调用 {{ state.attempts }} 次</StatusPill>
    </template>
    <div class="grid gap-2 text-2xs text-ink-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        模型：<span class="text-ink">{{ state.data?.aiMeta.model ?? '未加载' }}</span>
      </div>
      <div>
        模型版本：<span class="text-ink">{{ state.data?.aiMeta.modelVersion ?? '-' }}</span>
      </div>
      <div>
        AI 耗时：<span class="text-ink">{{ state.data?.aiMeta.tookMs ?? '-' }} ms</span>
      </div>
      <div>
        整体自评置信度：<span class="text-ink">{{
          state.data ? formatPercent(state.data.aiMeta.confidence) : '-'
        }}</span>
      </div>
    </div>
    <p class="mt-2 text-2xs leading-5 text-ink-3">
      当前阈值
      <span class="font-mono text-attention">{{ formatPercent(threshold) }}</span>
      （页面取值来自 mockStore.lowConfidenceThreshold =
      <span class="font-mono text-ink-2">{{ mockStore.lowConfidenceThreshold }}</span
      >）。 阈值建议：0.70 ~ 0.75 较为合适；低于该值的片段必须人工复核后才可进入流程 3，高于 0.90
      的片段可批量通过。
    </p>
    <p v-if="startState.data" class="mt-1 text-2xs text-ink-4">
      最近一次发起转写：任务 {{ startState.data.taskId }}（{{ startState.data.status }}）。
    </p>
  </PanelSection>
</template>
