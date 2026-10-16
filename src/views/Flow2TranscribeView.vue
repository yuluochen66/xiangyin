<script setup lang="ts">
/**
 * 流程 2：转写并支持人工校正。
 *
 * 设计要点：
 * 1) 7 种界面状态由 useAsyncTask + AsyncStateBoundary 统一渲染，页面只实现成功态内容；
 * 2) 音频 ↔ 文本双向联动：timeupdate 驱动当前片段高亮与自动滚动，点击时间码 / 正文 seek 播放；
 *    演示音频时长可能短于片段 endMs（221s），所有 seek 都用 Math.min 夹取到音频真实时长；
 * 3) AI 只是「介入点」：校正建议必须人工采纳 / 忽略，且可撤回；采纳只写入编辑态，不直接改正文；
 * 4) 所有写操作（保存校正 / 回滚）都保留失败路径，失败时编辑内容不丢，可直接重试；
 * 5) 片段记录 editedBy / editedAt，版本列表与回滚都走接口。
 *
 * 拆分说明：界面按职责拆到 components/flow2/*，状态与操作拆到 composables/useTranscript*；
 * 本文件只保留接口调用入口、顶层布局与页面级编排。
 *
 * 待确认（TODO）：
 * - TODO-ASR-2：低置信度由后端标记（lowConfidence），前端只按 lowConfidenceThreshold 展示，不重复判断；
 * - TODO-CONFLICT-1：乐观锁冲突（conflict）当前只做提示，未做自动合并；
 * - 同一片段命中多条 AI 建议时，采纳会以上一条建议的 suggestedText 为基础，需后端确认建议是否互斥。
 */
import { computed, ref } from 'vue'

import { transcribeApi } from '@/api'
import AsyncStateBoundary from '@/components/common/AsyncStateBoundary.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import FlowHeader from '@/components/common/FlowHeader.vue'
import AudioPlayerPanel from '@/components/flow2/AudioPlayerPanel.vue'
import CorrectionOverviewPanel from '@/components/flow2/CorrectionOverviewPanel.vue'
import RollbackConfirmDialog from '@/components/flow2/RollbackConfirmDialog.vue'
import SuggestionPanel from '@/components/flow2/SuggestionPanel.vue'
import TranscribeHeaderActions from '@/components/flow2/TranscribeHeaderActions.vue'
import TranscribeMetaPanel from '@/components/flow2/TranscribeMetaPanel.vue'
import TranscriptConfirmPrompt from '@/components/flow2/TranscriptConfirmPrompt.vue'
import TranscriptContentPanel from '@/components/flow2/TranscriptContentPanel.vue'
import TranscriptIdlePanel from '@/components/flow2/TranscriptIdlePanel.vue'
import TranscriptUnavailablePanel from '@/components/flow2/TranscriptUnavailablePanel.vue'
import VersionHistoryDialog from '@/components/flow2/VersionHistoryDialog.vue'
import { useAppShell } from '@/composables/useAppShell'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { useTranscriptAudio } from '@/composables/useTranscriptAudio'
import { useTranscriptCorrections } from '@/composables/useTranscriptCorrections'
import { useTranscriptDrafts } from '@/composables/useTranscriptDrafts'
import { useTranscriptSuggestions } from '@/composables/useTranscriptSuggestions'
import { useTranscriptVersions } from '@/composables/useTranscriptVersions'
import { CURRENT_OPERATOR } from '@/mock/dataset'
import { mockStore } from '@/mock/store'
import { useRouter } from '@/router'
import type {
  GetTranscriptResponse,
  StartTranscribeResponse,
  TranscriptSegmentDTO,
  TranscriptViewMode,
} from '@/types/api'
import { formatPercent, formatTimecode } from '@/utils/format'

const TRANSCRIPT_ID = 'T-2024-0312'
const AUDIO_URL = '/demo/audio-demo.wav'

/** 本页涉及的后端接口，显示在页头，便于对照「数据交互节点」。 */
const ENDPOINTS = [
  'POST /transcripts:start',
  'GET /transcripts/{transcriptId}',
  'POST /transcripts/{transcriptId}/suggestions',
  'POST /transcripts/{transcriptId}/corrections',
  'GET /transcripts/{transcriptId}/versions',
  'POST /transcripts/{transcriptId}/rollback',
]

const { notify } = useAppShell()
const router = useRouter()

/* ------------------------------------------------------------------ */
/* 主任务：拉取转写结果（GET /transcripts/{transcriptId}）              */
/* ------------------------------------------------------------------ */

const {
  state,
  canRetry,
  isBusy,
  run,
  retry,
  respondConfirm,
  markUnavailable,
  setData,
  reset,
  cancel,
} = useAsyncTask<GetTranscriptResponse, []>(() => transcribeApi.getTranscript(TRANSCRIPT_ID), {
  isEmpty: (data) => data.segments.length === 0,
  emptyHint: {
    reason: '该转写稿没有任何片段，可能是转写任务部分失败（status = partial）。',
    suggestion: '重新拉取结果；若仍为空，可改人工听录并手工建立片段。',
  },
  needsConfirm: (data) => {
    const low = data.segments.filter((item) => item.lowConfidence)
    if (!data.aiMeta.needsHumanConfirm || low.length === 0) return null
    return {
      title: 'AI 转写置信度偏低，需人工确认后才能进入流程 3',
      message:
        '检测到 ' +
        String(low.length) +
        ' 段低于阈值 ' +
        formatPercent(data.lowConfidenceThreshold) +
        '（模型自评整体置信度 ' +
        formatPercent(data.aiMeta.confidence) +
        '），请先确认结果可用，再逐段校正。',
      details: low
        .slice(0, 5)
        .map(
          (item) =>
            '第 ' +
            String(item.index + 1) +
            ' 段（' +
            formatTimecode(item.startMs) +
            '）置信度 ' +
            formatPercent(item.confidence) +
            '：' +
            item.text.slice(0, 28) +
            '…',
        ),
      confirmText: '已知悉，开始人工校正',
      cancelText: '放弃本次转写',
    }
  },
  onConfirm: (_data, decision) => {
    if (decision === 'confirmed') {
      notify('info', '已确认 AI 转写结果，请逐段核对低置信度内容后再进入流程 3。')
    } else {
      notify('warning', '已放弃本次转写结果，可重新发起，或改人工听录。')
    }
  },
})

/* ------------------------------------------------------------------ */
/* 其他任务：发起转写                                                   */
/* ------------------------------------------------------------------ */

const {
  state: startState,
  isBusy: startBusy,
  run: startRun,
} = useAsyncTask<StartTranscribeResponse, []>(() =>
  transcribeApi.start({
    interviewId: 'INT-2024-0312',
    language: 'zh-CN',
    enableDiarization: true,
    vocabularyHints: ['脱胎漆器', '三坊七巷', '茉莉花茶', '闽剧', '塔巷', '牛角梳'],
    modelHint: 'balanced',
    operator: CURRENT_OPERATOR,
  }),
)

/* ------------------------------------------------------------------ */
/* 派生数据                                                            */
/* ------------------------------------------------------------------ */

const segments = computed(() => state.value.data?.segments ?? [])
const paragraphs = computed(() => state.value.data?.paragraphs ?? [])
const threshold = computed(
  () => state.value.data?.lowConfidenceThreshold ?? mockStore.lowConfidenceThreshold,
)
const lowConfidenceCount = computed(
  () => segments.value.filter((item) => item.lowConfidence).length,
)
const editedCount = computed(() => segments.value.filter((item) => item.edited).length)

const viewMode = ref<TranscriptViewMode>('timeline')

/* ------------------------------------------------------------------ */
/* 页面状态与操作的编排                                                */
/* ------------------------------------------------------------------ */

const drafts = useTranscriptDrafts({ segments, notify })
const audio = useTranscriptAudio({
  segments,
  paragraphs,
  isEditing: () => drafts.editingId.value !== null,
  notify,
})
const suggestions = useTranscriptSuggestions({
  transcriptId: TRANSCRIPT_ID,
  segments,
  viewMode,
  seekToMs: audio.seekToMs,
  drafts,
  notify,
})
const versions = useTranscriptVersions({
  transcriptId: TRANSCRIPT_ID,
  state,
  setData,
  drafts,
  notify,
})
const corrections = useTranscriptCorrections({
  transcriptId: TRANSCRIPT_ID,
  state,
  setData,
  drafts,
  notify,
})

/* ------------------------------------------------------------------ */
/* 发起 / 拉取 / 兜底 / 重置                                           */
/* ------------------------------------------------------------------ */

function loadTranscript(): void {
  void run()
}

async function startTranscribe(): Promise<void> {
  const response = await startRun()
  if (!response) return
  notify(
    'success',
    '转写任务已发起（' +
      response.data.taskId +
      '），预估 ' +
      String(Math.max(1, Math.round(response.data.estimatedMs / 1000))) +
      ' 秒。',
  )
  await run()
}

/** ASR 不可用时的兜底：本地建立一条空片段，让流程可以继续（改人工听录）。 */
function startManualTranscript(): void {
  const manualSegment: TranscriptSegmentDTO = {
    id: 'SEG-MANUAL-001',
    index: 0,
    startMs: 0,
    endMs: 0,
    speaker: '待标注',
    text: '（人工听录）请在此输入听到的内容。',
    originalText: '',
    confidence: 1,
    lowConfidence: false,
    edited: true,
    editedBy: CURRENT_OPERATOR,
    editedAt: new Date().toISOString(),
  }
  const data: GetTranscriptResponse = {
    transcriptId: TRANSCRIPT_ID,
    interviewId: 'INT-2024-0312',
    language: 'zh-CN',
    status: 'partial',
    segments: [manualSegment],
    paragraphs: [],
    version: {
      versionId: 'TVER-MANUAL',
      versionNo: 1,
      createdBy: CURRENT_OPERATOR,
      createdAt: new Date().toISOString(),
      note: '人工听录占位版本',
    },
    lowConfidenceThreshold: mockStore.lowConfidenceThreshold,
    lowConfidenceCount: 0,
    editedCount: 1,
    aiMeta: {
      model: 'manual',
      modelVersion: '-',
      confidence: 0,
      needsHumanConfirm: false,
      generatedAt: new Date().toISOString(),
      tookMs: 0,
      unavailableReason: 'ASR 能力未部署，已切换为人工听录。',
    },
  }
  setData(data)
  drafts.openEditor(manualSegment.id, manualSegment.text, manualSegment.speaker)
  notify('warning', '已切换为人工听录：AI 不可用时仍可手工建立片段并保存为草稿。')
}

/** 演示可用：不依赖全局 Mock 场景，也能看到「不可用」状态。 */
function simulateUnavailable(): void {
  markUnavailable('（演示）ASR 能力未部署或已下线：重试不会成功，请改人工听录或联系管理员。')
  notify('warning', '已模拟 ASR 能力不可用状态。')
}

function cancelRun(): void {
  cancel()
  notify('info', '已取消本次拉取请求。')
}

function resetFlow(): void {
  reset()
  drafts.clearDrafts()
  drafts.cancelEdit()
  suggestions.clearIgnored()
  corrections.resetRemaining()
  audio.clearAudioError()
  notify('info', '已重置流程 2 的界面状态。')
}

function confirmResult(): void {
  void respondConfirm('confirmed')
}

function rejectResult(): void {
  void respondConfirm('rejected')
}

function goToNextFlow(): void {
  router.goToStep(3)
}
</script>

<template>
  <div class="space-y-4">
    <FlowHeader
      :step="2"
      title="转写与人工校正"
      description="拉取 ASR 转写结果，逐段核对福州方言用字与专有名词；AI 校正建议仅供参考，采纳 / 忽略 / 撤回都会留痕，保存与回滚都走接口。"
      :phase="state.phase"
      :attempts="state.attempts"
      :endpoints="ENDPOINTS"
    >
      <template #actions>
        <TranscribeHeaderActions
          :is-busy="isBusy"
          :start-busy="startBusy"
          @reset="resetFlow"
          @cancel="cancelRun"
          @simulate="simulateUnavailable"
          @start="startTranscribe"
          @load="loadTranscript"
        />
      </template>
    </FlowHeader>

    <!-- 发起转写失败：就地提示 + 重试，不影响主任务状态机 -->
    <div
      v-if="startState.phase === 'error' && startState.error"
      class="flex flex-wrap items-center gap-2 border border-vermilion bg-vermilion-wash px-3 py-2 text-2xs text-vermilion"
    >
      <span>发起转写失败：{{ startState.error.displayMessage }}</span>
      <BaseButton variant="ghost" size="sm" :loading="startBusy" @click="startTranscribe"
        >重试发起</BaseButton
      >
    </div>

    <TranscribeMetaPanel :state="state" :start-state="startState" :threshold="threshold" />

    <AudioPlayerPanel :src="AUDIO_URL" :player="audio" />

    <!-- 7 态渲染边界 -->
    <AsyncStateBoundary
      :phase="state.phase"
      :error="state.error"
      :can-retry="canRetry"
      :retry-progress="state.retryProgress"
      empty-title="转写结果为空"
      :empty-reason="state.emptyHint?.reason"
      :empty-suggestion="state.emptyHint?.suggestion"
      :unavailable-reason="state.unavailableReason"
      loading-text="正在拉取转写结果（GET /transcripts/{transcriptId}）…"
      :skeleton-rows="6"
      min-height-class="min-h-[320px]"
      @retry="retry()"
    >
      <template #idle>
        <TranscriptIdlePanel
          :start-busy="startBusy"
          :is-busy="isBusy"
          @start="startTranscribe"
          @load="loadTranscript"
          @manual="startManualTranscript"
        />
      </template>

      <template #empty-actions>
        <BaseButton variant="primary" size="sm" :loading="isBusy" @click="loadTranscript"
          >重新拉取</BaseButton
        >
        <BaseButton variant="secondary" size="sm" @click="startManualTranscript"
          >改人工听录</BaseButton
        >
      </template>

      <template #unavailable>
        <TranscriptUnavailablePanel
          :reason="state.unavailableReason"
          :is-busy="isBusy"
          @manual="startManualTranscript"
          @retry="loadTranscript"
          @reset="resetFlow"
        />
      </template>

      <template #unavailable-actions>
        <BaseButton variant="primary" size="sm" @click="startManualTranscript"
          >改为人工听录（手工建立片段）</BaseButton
        >
      </template>

      <template #error-actions>
        <BaseButton
          v-if="state.error?.code === 'auth'"
          variant="secondary"
          size="sm"
          @click="notify('warning', '请先在顶栏写入演示 Token，或接入真实登录流程。')"
        >
          如何解决？
        </BaseButton>
      </template>

      <template #default>
        <!-- 需人工确认（needsConfirm） -->
        <TranscriptConfirmPrompt
          v-if="state.phase === 'confirm' && state.confirmPrompt"
          :prompt="state.confirmPrompt"
          @confirm="confirmResult"
          @reject="rejectResult"
        />

        <!-- 成功态内容 -->
        <div v-else class="space-y-4">
          <CorrectionOverviewPanel
            :state="state"
            :segment-count="segments.length"
            :paragraph-count="paragraphs.length"
            :edited-count="editedCount"
            :low-confidence-count="lowConfidenceCount"
            :threshold="threshold"
            :drafts="drafts"
            :corrections="corrections"
            :versions="versions"
            @next-flow="goToNextFlow"
          />

          <TranscriptContentPanel
            v-model:view-mode="viewMode"
            :segments="segments"
            :paragraphs="paragraphs"
            :threshold="threshold"
            :drafts="drafts"
            :audio="audio"
            :corrections="corrections"
          />

          <SuggestionPanel :suggestions="suggestions" :drafts="drafts" />
        </div>
      </template>
    </AsyncStateBoundary>

    <VersionHistoryDialog :versions="versions" />

    <RollbackConfirmDialog :versions="versions" :drafts="drafts" />
  </div>
</template>
