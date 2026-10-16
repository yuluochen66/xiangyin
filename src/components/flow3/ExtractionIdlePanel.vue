<script setup lang="ts">
/**
 * 空闲态（尚未发起抽取）面板。
 *
 * 唯一职责：在状态机处于 idle 时说明将抽取什么，并提供「发起抽取」「直接拉取」「手工新增」
 * 三个入口；不持有状态、不发起接口调用。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'

defineProps<{
  /** 主任务进行中。 */
  busy: boolean
  /** 发起抽取任务进行中。 */
  startBusy: boolean
}>()

const emit = defineEmits<{ start: []; load: []; create: [] }>()
</script>

<template>
  <div
    class="flex min-h-[300px] flex-col items-center justify-center gap-3 border border-dashed border-rule bg-sheet p-10 text-center"
  >
    <span aria-hidden="true"><AppIcon name="compass" :size="26" /></span>
    <p class="text-sm font-medium text-ink">尚未发起信息抽取</p>
    <p class="max-w-xl text-xs leading-5 text-ink-3">
      按 place / person / event / organization / artifact / time 六类抽取实体，并为每条结果保留
      segmentId + 字符区间 + 时间码；低于阈值的标记为「待人工确认」，确认后才可进入检索。
    </p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <BaseButton variant="primary" size="sm" :loading="startBusy" @click="emit('start')">
        发起抽取（POST /extractions:start）
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :loading="busy" @click="emit('load')">
        直接拉取已有结果（GET）
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('create')">手工新增实体</BaseButton>
    </div>
  </div>
</template>
