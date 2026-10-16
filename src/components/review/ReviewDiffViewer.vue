<script setup lang="ts">
/**
 * 审校对照视图（原文 vs 修订稿）。
 *
 * 采用 git 风格的左右并排：`equal` 块两侧内容相同，`change` 块分别用
 * 删除线（原文）/ 下划线（修订稿）标出增删。差异计算见 `utils/diff.ts`。
 */
import { computed, toRef } from 'vue'

import { useReviewDiff } from '@/composables/useReviewDiff'

interface Props {
  original: string
  revised: string
  /** 顶部统计条是否显示。 */
  showStats?: boolean
}

const props = withDefaults(defineProps<Props>(), { showStats: true })

const { blocks, stats, isIdentical, similarityText } = useReviewDiff(
  toRef(props, 'original'),
  toRef(props, 'revised'),
)

/** 只有存在实际差异时才高亮，避免把纯空白差异渲染成彩块。 */
const hasChanges = computed(() => !isIdentical.value)
</script>

<template>
  <div class="border border-rule">
    <!-- 列头 -->
    <div class="grid grid-cols-2 gap-px border-b border-rule bg-sheet">
      <div class="flex items-center gap-1.5 px-2.5 py-1.5">
        <span class="size-1.5 rounded-full bg-vermilion-wash" aria-hidden="true" />
        <span class="text-2xs font-medium text-ink-2">原文</span>
      </div>
      <div class="flex items-center gap-1.5 px-2.5 py-1.5">
        <span class="size-1.5 rounded-full bg-verified-wash" aria-hidden="true" />
        <span class="text-2xs font-medium text-ink-2">修订稿</span>
      </div>
    </div>

    <!-- 对照正文 -->
    <div class="grid grid-cols-2 gap-px bg-paper-3">
      <template v-for="block in blocks" :key="block.id">
        <!-- 原文列 -->
        <div
          class="px-2.5 py-2 text-xs leading-relaxed"
          :class="block.type === 'change' ? 'bg-sheet' : 'bg-sheet'"
        >
          <template v-for="(token, index) in block.left" :key="`l-${index}`">
            <del
              v-if="token.op === 'delete'"
              class="bg-vermilion text-vermilion decoration-rose-400/70"
              >{{ token.text }}</del
            >
            <template v-else>{{ token.text }}</template>
          </template>
        </div>

        <!-- 修订稿列 -->
        <div
          class="px-2.5 py-2 text-xs leading-relaxed"
          :class="block.type === 'change' ? 'bg-sheet' : 'bg-sheet'"
        >
          <template v-for="(token, index) in block.right" :key="`r-${index}`">
            <ins
              v-if="token.op === 'insert'"
              class="bg-verified text-verified no-underline decoration-emerald-400/70 underline"
              >{{ token.text }}</ins
            >
            <template v-else>{{ token.text }}</template>
          </template>
        </div>
      </template>
    </div>

    <!-- 统计 -->
    <div
      v-if="props.showStats"
      class="flex items-center gap-3 border-t border-rule bg-paper px-2.5 py-1.5 text-2xs text-ink-4"
    >
      <span v-if="!hasChanges" class="text-verified">两侧完全一致</span>
      <template v-else>
        <span class="text-vermilion">-{{ stats.deletedChars }} 字</span>
        <span class="text-verified">+{{ stats.insertedChars }} 字</span>
        <span>{{ stats.changeBlocks }} 处变更</span>
        <span class="ml-auto">相似度 {{ similarityText }}</span>
      </template>
    </div>
  </div>
</template>
