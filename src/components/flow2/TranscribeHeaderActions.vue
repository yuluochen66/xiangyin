<script setup lang="ts">
/**
 * 流程 2：页头操作组。
 *
 * 唯一职责：提供「重置 / 取消请求 / 模拟不可用 / 发起转写 / 拉取转写结果」这排页头按钮，
 * 并按任务状态给出禁用与加载态；具体动作由页面编排。
 */
import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  /** 主任务（拉取转写结果）是否进行中。 */
  isBusy: boolean
  /** 发起转写任务是否进行中。 */
  startBusy: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  reset: []
  cancel: []
  simulate: []
  start: []
  load: []
}>()
</script>

<template>
  <BaseButton variant="ghost" size="sm" :disabled="isBusy" @click="emit('reset')">重置</BaseButton>
  <BaseButton v-if="isBusy" variant="ghost" size="sm" @click="emit('cancel')">取消请求</BaseButton>
  <BaseButton
    variant="ghost"
    size="sm"
    title="演示可用：手动标记 ASR 能力未部署"
    @click="emit('simulate')"
  >
    模拟不可用
  </BaseButton>
  <BaseButton
    variant="secondary"
    size="sm"
    :loading="startBusy"
    :disabled="isBusy"
    @click="emit('start')"
  >
    ① 发起转写
  </BaseButton>
  <BaseButton variant="primary" size="sm" :loading="isBusy" @click="emit('load')">
    ② 拉取转写结果
  </BaseButton>
</template>
