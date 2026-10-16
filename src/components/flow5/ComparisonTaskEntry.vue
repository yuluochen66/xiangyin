<script setup lang="ts">
/**
 * 比对任务非成功态的操作入口。
 *
 * 唯一职责：按当前界面状态（idle / empty / unavailable / error）渲染对应的
 * 说明与可执行下一步——拉取结果、重新发起初判、切换人工模式或前往其它流程。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'

interface Props {
  /** 需要渲染的状态分支。 */
  kind: 'idle' | 'empty' | 'unavailable' | 'error'
  /** 比对任务是否正在进行。 */
  busy: boolean
  /** 比对任务 id。 */
  comparisonId: string
  /** 待比对的草稿 id。 */
  draftId: string
}

defineProps<Props>()

/** 是否启用 AI 自动初判（只在 idle 分支出现）。 */
const enableAutoJudge = defineModel<boolean>('enableAutoJudge', { required: true })

const emit = defineEmits<{
  load: []
  start: []
  manual: []
  goStep: [step: number]
}>()
</script>

<template>
  <!-- idle -->
  <div v-if="kind === 'idle'" class="space-y-3 border border-dashed border-rule bg-sheet p-6">
    <div class="flex items-start gap-2.5">
      <span aria-hidden="true"><AppIcon name="scales" :size="20" /></span>
      <div>
        <p class="text-sm font-medium text-ink">尚未拉取比对结果</p>
        <p class="mt-0.5 text-xs leading-5 text-ink-4">
          「拉取比对结果」用于恢复上次的标注进度；「重新发起 AI 初判」会按当前草稿
          <code class="mx-1 font-mono text-ink-3">{{ draftId }}</code>
          重新配对资料。重新发起不会清除已保存的人工标注，但会刷新 AI 初判结论。
        </p>
      </div>
    </div>

    <label class="flex items-center gap-2 text-2xs text-ink-2">
      <input v-model="enableAutoJudge" type="checkbox" class="size-3.5 accent-seal-ink" />
      启用 AI 自动初判（关闭后所有条目初始为「资料不足」，需完全人工判断）
    </label>

    <div class="flex flex-wrap items-center gap-2">
      <BaseButton variant="primary" size="sm" :loading="busy" @click="emit('load')">
        拉取比对结果 · GET /comparisons/{{ comparisonId }}
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :disabled="busy" @click="emit('start')">
        重新发起 AI 初判 · POST /comparisons:start
      </BaseButton>
    </div>
  </div>

  <!-- empty -->
  <div v-else-if="kind === 'empty'" class="flex flex-col items-center gap-2">
    <div class="flex flex-wrap justify-center gap-2">
      <BaseButton variant="primary" size="sm" :loading="busy" @click="emit('start')">
        按当前草稿重新发起比对
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="busy" @click="emit('goStep', 6)">
        前往流程 6 生成草稿
      </BaseButton>
      <BaseButton variant="ghost" size="sm" :disabled="busy" @click="emit('load')">
        重新拉取
      </BaseButton>
    </div>
    <p class="text-2xs text-ink-4">
      当前草稿 draftId：<code class="font-mono">{{ draftId }}</code> · 若草稿尚未生成，请先到流程 6
      生成故事卡 / 讲稿。
    </p>
  </div>

  <!-- unavailable -->
  <div v-else-if="kind === 'unavailable'" class="flex flex-col items-center gap-2">
    <div class="flex flex-wrap justify-center gap-2">
      <BaseButton variant="primary" size="sm" @click="emit('manual')">
        切换到本地缓存继续人工标注
      </BaseButton>
      <BaseButton variant="ghost" size="sm" @click="emit('goStep', 4)">
        回到流程 4 补充检索
      </BaseButton>
    </div>
    <p class="text-2xs leading-4 text-vermilion">
      比对能力不可用时，AI 初判与重判都不会执行；本地缓存里仍保留上次的比对项，
      可以逐条人工标注，输入会保留在界面上。
    </p>
  </div>

  <!-- error -->
  <BaseButton v-else variant="ghost" size="sm" @click="emit('start')"
    >改用「重新发起比对」</BaseButton
  >
</template>
