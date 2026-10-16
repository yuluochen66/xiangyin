<script setup lang="ts">
/**
 * 流程 4 的空数据 / 不可用状态动作组。
 *
 * 唯一职责：为 7 态里的「空数据」与「不可用」两种状态渲染可执行的下一步按钮
 * （放宽筛选、关闭可信度限制、重新开始 / 用流程 3 实体继续、前往流程 3），
 * 并把意图冒泡给主视图。本组件不持有状态、不发请求。
 */
import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  /** empty：没有命中；unavailable：本地资料库未接入。 */
  variant: 'empty' | 'unavailable'
  isBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  relax: []
  'drop-credibility': []
  reset: []
  'browse-entities': []
  'go-step3': []
}>()
</script>

<template>
  <!-- empty：可执行动作 -->
  <div v-if="props.variant === 'empty'" class="flex flex-col items-center gap-2">
    <div class="flex flex-wrap justify-center gap-2">
      <BaseButton variant="primary" size="sm" :loading="props.isBusy" @click="emit('relax')">
        放宽筛选后重试
      </BaseButton>
      <BaseButton
        variant="secondary"
        size="sm"
        :disabled="props.isBusy"
        @click="emit('drop-credibility')"
      >
        关闭可信度限制
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="props.isBusy" @click="emit('reset')">
        重新开始
      </BaseButton>
    </div>
    <p class="text-2xs text-ink-4">
      也可以减少关键词：口述中的方言写法（如「三坊巷」）常与方志用字不同，建议先用规范名检索。
    </p>
  </div>

  <!-- unavailable：本地资料库未接入 -->
  <div v-else class="flex flex-col items-center gap-2">
    <div class="flex flex-wrap justify-center gap-2">
      <BaseButton
        variant="primary"
        size="sm"
        :loading="props.isBusy"
        @click="emit('browse-entities')"
      >
        用流程 3 的已确认实体继续
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('go-step3')">
        前往流程 3 提取实体
      </BaseButton>
    </div>
    <p class="text-2xs leading-4 text-vermilion">
      本地资料库未接入时，检索会失败；此时可以先用采访中抽取的地点 / 人物 / 器物做线下查证，
      并把结论记录到流程 5 的差异标注里。
    </p>
  </div>
</template>
