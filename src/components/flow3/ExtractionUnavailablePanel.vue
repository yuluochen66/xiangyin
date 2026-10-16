<script setup lang="ts">
/**
 * 不可用态（NER 未部署）面板。
 *
 * 唯一职责：说明抽取能力不可用，并提供「手工新增实体」「再试一次」「重置流程」三个出口，
 * 保证能力缺失时流程仍可继续；不持有状态、不发起接口调用。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'

defineProps<{
  /** 状态机给出的不可用原因。 */
  reason: string | null
  /** 主任务进行中。 */
  busy: boolean
}>()

const emit = defineEmits<{ create: []; reload: []; reset: [] }>()
</script>

<template>
  <div
    class="flex min-h-[320px] flex-col items-center justify-center gap-3 border border-vermilion bg-vermilion-wash p-10 text-center"
  >
    <span aria-hidden="true"><AppIcon name="ban" :size="26" /></span>
    <p class="text-sm font-medium text-vermilion">NER 抽取能力未部署</p>
    <p class="max-w-md text-xs text-vermilion">
      {{ reason || '服务未部署或已下线，重试不会成功。' }}
    </p>
    <p class="max-w-lg text-2xs leading-5 text-vermilion">
      仍可继续：手工录入实体（会带 createdByHuman 标记、置信度记为 1），或等后端恢复 NER
      能力后重新抽取。 手工录入不依赖本页状态机，随时可用。
    </p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <BaseButton variant="primary" size="sm" @click="emit('create')">手工新增实体</BaseButton>
      <BaseButton variant="secondary" size="sm" :loading="busy" @click="emit('reload')"
        >再试一次（可能已恢复）</BaseButton
      >
      <BaseButton variant="ghost" size="sm" @click="emit('reset')">重置流程</BaseButton>
    </div>
  </div>
</template>
