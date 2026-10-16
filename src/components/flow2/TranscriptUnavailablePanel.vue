<script setup lang="ts">
/**
 * 流程 2：ASR 能力不可用时的兜底说明。
 *
 * 唯一职责：解释不可用原因，并强调「人工听录仍可继续」的三条出路
 * （改人工听录 / 仍要重试 / 重置流程）；不做任何状态判断。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  /** 不可用原因（来自状态机）。 */
  reason: string | null
  /** 主任务是否进行中（重试按钮的加载态）。 */
  isBusy: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  manual: []
  retry: []
  reset: []
}>()
</script>

<template>
  <div
    class="flex min-h-[320px] flex-col items-center justify-center gap-3 border border-vermilion bg-vermilion-wash p-10 text-center"
  >
    <span aria-hidden="true"><AppIcon name="ban" :size="26" /></span>
    <p class="text-sm font-medium text-vermilion">ASR 能力未部署</p>
    <p class="max-w-md text-xs text-vermilion">
      {{ reason || '服务未部署或已下线，重试不会成功。' }}
    </p>
    <p class="max-w-lg text-2xs leading-5 text-vermilion">
      仍可继续：用上方播放器人工听录，点击「改为人工听录」后手工建立片段并保存为草稿；
      低置信度标记、AI 建议与版本回滚在人工模式下同样可用（AI 建议会提示不可用）。
    </p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <BaseButton variant="primary" size="sm" @click="emit('manual')">改为人工听录</BaseButton>
      <BaseButton variant="secondary" size="sm" :loading="isBusy" @click="emit('retry')"
        >仍要重试一次</BaseButton
      >
      <BaseButton variant="ghost" size="sm" @click="emit('reset')">重置流程</BaseButton>
    </div>
  </div>
</template>
