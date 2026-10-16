<script setup lang="ts">
/**
 * 审核状态流转面板。
 *
 * 唯一职责：渲染审核状态步骤条、分支状态提示、当前可执行动作、流转备注、
 * 乐观锁冲突恢复区与流转检查清单，并把用户操作转交给共享上下文中的流转动作；
 * 自身不发起任何接口调用。
 */
import { PUBLISH_STATUS_META, REVIEW_ACTION_LABEL } from '@/api'
import BaseButton from '@/components/common/BaseButton.vue'
import JsonPreview from '@/components/common/JsonPreview.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { usePublishFlowContext } from '@/composables/usePublishFlow'
import { STATUS_FLOW } from '@/composables/usePublishStatusFlow'

const {
  currentStatus,
  stepIndex,
  isBranchStatus,
  allowedActions,
  transitionBusy,
  transitionState,
  transitionCanRetry,
  lastAction,
  forceStaleStatus,
  conflictDetected,
  actionComment,
  checklist,
  lastRequestBody,
  doTransition,
  retryLastAction,
  refreshStatus,
  goToFlow,
} = usePublishFlowContext()
</script>

<template>
  <PanelSection
    title="审核状态流转"
    description="可执行动作由 publishApi.actionsFor(currentStatus) 决定；提交时携带 expectedFrom 做乐观锁校验。"
  >
    <div class="space-y-3">
      <!-- 步骤条 -->
      <ol class="flex flex-wrap items-center gap-1.5">
        <li v-for="(status, index) in STATUS_FLOW" :key="status" class="flex items-center gap-1.5">
          <div
            class="flex items-center gap-1.5 border px-2.5 py-1.5"
            :class="
              currentStatus === status
                ? 'border-seal-2 bg-seal'
                : index < stepIndex
                  ? 'border-verified bg-verified-wash'
                  : 'border-rule bg-paper'
            "
          >
            <span
              class="flex size-4 items-center justify-center rounded-full text-2xs font-semibold"
              :class="index <= stepIndex ? 'bg-seal text-sheet' : 'bg-paper-3 text-ink-2'"
            >
              {{ index + 1 }}
            </span>
            <span class="text-2xs" :class="index <= stepIndex ? 'text-ink' : 'text-ink-4'">
              {{ PUBLISH_STATUS_META[status].label }}
            </span>
          </div>
          <span v-if="index < STATUS_FLOW.length - 1" class="text-ink-4">→</span>
        </li>
      </ol>

      <div
        v-if="isBranchStatus"
        class="flex flex-wrap items-center gap-2 border border-rule bg-sheet px-3 py-2 text-2xs text-ink-2"
      >
        <span>当前处于分支状态：</span>
        <StatusPill :tone="PUBLISH_STATUS_META[currentStatus].tone" dense>
          {{ PUBLISH_STATUS_META[currentStatus].label }}
        </StatusPill>
        <span v-if="currentStatus === 'rejected'">可按审核意见修订后重新提交审核。</span>
        <span v-else>已归档，仍可重新发布或回滚到历史版本。</span>
        <BaseButton
          v-if="currentStatus === 'rejected'"
          size="sm"
          variant="ghost"
          @click="goToFlow(6)"
        >
          去流程 6 修订稿件
        </BaseButton>
      </div>

      <!-- 可执行动作 -->
      <div class="border border-rule bg-paper p-3">
        <p class="text-2xs font-medium text-ink-3">可执行动作 allowedActions</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <BaseButton
            v-for="action in allowedActions"
            :key="action"
            size="sm"
            :variant="
              action === 'reject' ? 'danger' : action === 'publish' ? 'primary' : 'secondary'
            "
            :loading="transitionBusy && lastAction === action"
            :disabled="transitionBusy"
            @click="doTransition(action)"
          >
            {{ REVIEW_ACTION_LABEL[action] }}
          </BaseButton>
          <span v-if="allowedActions.length === 0" class="text-2xs text-ink-4">
            当前状态没有可执行的流转动作。
          </span>
        </div>
        <label class="mt-2 block">
          <span class="mb-1 block text-2xs text-ink-3">流转备注 comment（可选，写入版本记录）</span>
          <textarea
            v-model="actionComment"
            rows="2"
            class="w-full border border-rule bg-paper px-2.5 py-1.5 text-xs text-ink outline-none focus:border-seal-2"
            placeholder="例如：授权已核对，同意进入审核。"
          ></textarea>
        </label>
        <span class="mt-1 block text-2xs text-ink-4">
          接口：POST /contents/{contentId}/transitions
        </span>
      </div>

      <!-- 乐观锁冲突 -->
      <div v-if="conflictDetected" class="border border-vermilion bg-vermilion-wash p-3">
        <p class="text-sm font-medium text-vermilion">状态已变更，请刷新</p>
        <p class="mt-1 text-xs leading-5 text-vermilion">
          你提交时使用的起始状态已过期，服务端按乐观锁拒绝了本次流转，以免覆盖他人的操作。
        </p>
        <p v-if="transitionState.error" class="mt-1 font-mono text-2xs text-vermilion">
          {{ transitionState.error.message }}
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <BaseButton size="sm" variant="primary" @click="refreshStatus">刷新状态</BaseButton>
          <BaseButton size="sm" :loading="transitionBusy" @click="retryLastAction"
            >重试上次动作</BaseButton
          >
          <span class="text-2xs text-vermilion">
            {{ transitionCanRetry ? '该错误可自动重试' : '需先刷新状态再重试' }}
          </span>
        </div>
      </div>

      <!-- 演示用：强制过期状态 -->
      <label class="flex items-center gap-1.5 text-2xs text-ink-4">
        <input v-model="forceStaleStatus" type="checkbox" class="size-3.5 accent-vermilion" />
        用过期状态提交（演示乐观锁冲突；待确认：仅原型调试用，正式版应移除）
      </label>

      <!-- 发布前检查清单（随流转一起提交） -->
      <div>
        <p class="mb-1.5 text-2xs font-medium text-ink-3">流转检查清单 checklist</p>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="item in checklist"
            :key="item.key"
            class="flex items-center gap-1.5 border border-rule bg-paper px-2 py-1 text-2xs text-ink-2"
          >
            <input v-model="item.checked" type="checkbox" class="size-3.5 accent-seal-ink" />
            {{ item.label }}
            <span v-if="item.required" class="text-vermilion" title="必填项">*</span>
          </label>
        </div>
      </div>

      <p v-if="transitionState.error && !conflictDetected" class="text-2xs text-vermilion">
        状态流转失败：{{ transitionState.error.displayMessage }}
      </p>
      <div v-if="lastRequestBody">
        <JsonPreview :value="lastRequestBody" label="最近一次请求体" :collapsed-lines="8" />
      </div>
    </div>
  </PanelSection>
</template>
