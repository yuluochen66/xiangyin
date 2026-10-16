<script setup lang="ts">
/**
 * 流程 2：未开始转写时的空态引导。
 *
 * 唯一职责：说明「发起转写 → 拉取结果 → 逐段校正」的推荐顺序，
 * 并提供发起 / 直接拉取 / 改人工听录三个入口；不持有任何状态。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  /** 发起转写任务是否进行中。 */
  startBusy: boolean
  /** 拉取转写结果是否进行中。 */
  isBusy: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  start: []
  load: []
  manual: []
}>()
</script>

<template>
  <div
    class="flex min-h-[300px] flex-col items-center justify-center gap-3 border border-dashed border-rule bg-sheet p-10 text-center"
  >
    <span aria-hidden="true"><AppIcon name="mic" :size="26" /></span>
    <p class="text-sm font-medium text-ink">尚未开始转写</p>
    <p class="max-w-xl text-xs leading-5 text-ink-3">
      建议顺序：① 发起转写（POST /transcripts:start）→ ② 拉取结果（GET
      /transcripts/{transcriptId}）→ 逐段校正低置信度内容 →
      保存校正并生成版本。也可以直接拉取已有转写结果。
    </p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <BaseButton variant="primary" size="sm" :loading="startBusy" @click="emit('start')">
        发起转写（POST /transcripts:start）
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :loading="isBusy" @click="emit('load')">
        直接拉取已有转写（GET）
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('manual')">改人工听录</BaseButton>
    </div>
  </div>
</template>
