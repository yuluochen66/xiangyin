<script setup lang="ts">
/**
 * 流程 7：审核发布（主视图）。
 *
 * 设计要点：
 * - 审核状态机 draft → pending_review → approved → published（+ rejected / archived 分支）
 *   以步骤条可视化，可执行动作由 publishApi.actionsFor() / transition 响应决定；
 * - 流转带 expectedFrom 乐观锁，冲突时给出「状态已变更，请刷新」的可恢复失败态；
 * - AI 风险检查是独立介入点：风险项可勾选「已确认知晓」，publishable=false 时禁用发布并说明原因；
 * - 风险检查服务不可用时允许转「人工逐条核对」，不卡死流程；
 * - 审核意见、发布前三项确认、版本记录与回滚全部有成功/失败提示与防重复提交。
 *
 * 本文件只保留：接口端点清单、共享上下文的装配入口、顶层两栏布局与编排；
 * 各面板职责分散在 components/flow7/，状态机与接口调用分散在 composables/usePublish*。
 */
import { PUBLISH_STATUS_META } from '@/api'
import BaseButton from '@/components/common/BaseButton.vue'
import FlowHeader from '@/components/common/FlowHeader.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import PublishConfirmModal from '@/components/flow7/PublishConfirmModal.vue'
import PublishConfirmPanel from '@/components/flow7/PublishConfirmPanel.vue'
import ReviewCommentPanel from '@/components/flow7/ReviewCommentPanel.vue'
import RiskCheckPanel from '@/components/flow7/RiskCheckPanel.vue'
import RollbackConfirmModal from '@/components/flow7/RollbackConfirmModal.vue'
import TransitionPanel from '@/components/flow7/TransitionPanel.vue'
import VersionHistoryPanel from '@/components/flow7/VersionHistoryPanel.vue'
import ToolInvokePanel from '@/components/tools/ToolInvokePanel.vue'
import { providePublishFlow } from '@/composables/usePublishFlow'

const ENDPOINTS = [
  'POST /contents/{contentId}/transitions',
  'POST /contents/{contentId}/risk-check',
  'POST /contents/{contentId}/review-comments',
  'POST /contents/{contentId}/publish',
  'GET /contents/{contentId}/versions',
  'POST /contents/{contentId}/rollback',
]

/**
 * AI 工具契约层的默认入参。
 * 定义成模块级常量以保证引用稳定——若在模板里内联对象字面量，
 * 每次渲染都会生成新对象并覆盖用户在面板中编辑的 JSON。
 */
const TOOL_REVIEW_INPUT: Record<string, unknown> = {
  reviewId: 'REVIEW-2024-0312-07',
  reviewer: '审校 赵岚',
  decisions: [
    { unitId: 'RU-01', status: 'accepted', note: '工序描述与非遗名录一致。' },
    { unitId: 'RU-02', status: 'flagged', note: '铺号地点与宗谱不符，需讲述人复核。' },
    { unitId: 'RU-03', status: 'accepted', note: '已改为转述语气，不再把传说写成史实。' },
    { unitId: 'RU-04', status: 'accepted', note: '补入「前店后坊」的来源标注。' },
  ],
  comment: '整体可用；RU-02 的地点差异需讲述人复核后再定稿。',
}

const { flowPhase, riskState, versionBusy, currentStatus, refreshVersions } = providePublishFlow()
</script>
<template>
  <div class="space-y-4">
    <FlowHeader
      :step="7"
      title="审核发布"
      description="按状态机推进稿件：AI 先做一轮风险检查，审核人逐条确认后再走发布前最终确认；所有流转、意见与回滚都留版本记录。"
      :phase="flowPhase"
      :attempts="riskState.attempts"
      :endpoints="ENDPOINTS"
    >
      <template #actions>
        <StatusPill :tone="PUBLISH_STATUS_META[currentStatus].tone">
          当前：{{ PUBLISH_STATUS_META[currentStatus].label }}
        </StatusPill>
        <BaseButton size="sm" :loading="versionBusy" @click="refreshVersions">版本记录</BaseButton>
      </template>
    </FlowHeader>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <!-- 左栏：状态流转 / 审核意见 / 版本记录 -->
      <div class="space-y-4">
        <TransitionPanel />
        <ReviewCommentPanel />
        <VersionHistoryPanel />
      </div>

      <!-- 右栏：AI 风险提醒 + 发布 -->
      <aside class="space-y-4">
        <RiskCheckPanel />
        <PublishConfirmPanel />
      </aside>
    </div>

    <!-- 发布前最终确认 -->
    <PublishConfirmModal />

    <!-- 回滚二次确认 -->
    <RollbackConfirmModal />

    <ToolInvokePanel
      tool="submit_review"
      title="审校提交（工具契约层）"
      description="走 submit_review 工具契约：提交审校决议并返回回执（receiptId / accepted / rejected / flagged）。这是整个原型里唯一的写操作工具调用，因此调用前强制二次确认，回执结果会原样展示便于留档。"
      :input="TOOL_REVIEW_INPUT"
    />
  </div>
</template>
