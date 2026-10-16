<script setup lang="ts">
/**
 * 流程 4 的 idle 引导面板。
 *
 * 唯一职责：在「尚未发起检索」时给出推荐检索词与「浏览全部资料」入口，
 * 把用户点击的检索词或浏览意图冒泡给主视图。本组件不持有状态、不发请求。
 */
import AppIcon from '@/components/common/AppIcon.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { RECOMMENDED_KEYWORDS } from '@/composables/useSourceMeta'

interface Props {
  isBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{ 'use-recommended': [term: string]; 'browse-all': [] }>()
</script>

<template>
  <!-- idle：推荐检索词 -->
  <div class="space-y-3 border border-dashed border-rule bg-sheet p-6">
    <div class="flex items-start gap-2.5">
      <span aria-hidden="true"><AppIcon name="search" :size="20" /></span>
      <div>
        <p class="text-sm font-medium text-ink">尚未发起检索</p>
        <p class="mt-0.5 text-xs leading-5 text-ink-4">
          输入关键词，或直接点一个推荐检索词开始。AI 扩展与重排默认开启，可以随时关闭。
        </p>
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <BaseButton
        v-for="term in RECOMMENDED_KEYWORDS"
        :key="term"
        variant="secondary"
        size="sm"
        :disabled="props.isBusy"
        @click="emit('use-recommended', term)"
      >
        {{ term }}
      </BaseButton>
    </div>

    <div class="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
      <BaseButton variant="ghost" size="sm" :loading="props.isBusy" @click="emit('browse-all')">
        浏览全部资料（不设关键词）
      </BaseButton>
      <span class="text-2xs text-ink-4">
        不设关键词时后端按可信度返回全库资料，适合先摸底再收窄条件。
      </span>
    </div>
  </div>
</template>
