<script setup lang="ts">
/**
 * 流程 6 的草稿区块列表。
 *
 * 唯一职责：逐个渲染可编辑的正文区块——标题、正文、角标可点击的正文预览与关联风险——
 * 并把编辑、删除、角标定位写回草稿状态；不负责保存、重新生成与进入下一流程。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useGenerationDraftContext } from '@/composables/useGenerationDraft'
import { RISK_LEVEL_META } from '@/composables/useGenerationMeta'

const {
  editableBlocks,
  preservedBlockIds,
  bodyTokens,
  activeCitation,
  activeBlockId,
  risksForBlock,
  markEdited,
  removeBlock,
  focusCitation,
} = useGenerationDraftContext()
</script>

<template>
  <article
    v-for="block in editableBlocks"
    :id="'block-' + block.id"
    :key="block.id"
    class="border p-3 transition-colors"
    :class="activeBlockId === block.id ? 'border-seal-2 bg-seal' : 'border-rule bg-paper'"
  >
    <header class="flex flex-wrap items-center gap-2">
      <span class="font-mono text-2xs text-ink-4">{{ block.id }}</span>
      <StatusPill v-if="block.edited" tone="warning" dense>已人工编辑</StatusPill>
      <StatusPill v-if="preservedBlockIds.includes(block.id)" tone="violet" dense>
        重新生成时保留
      </StatusPill>
      <StatusPill v-if="risksForBlock(block.id).length" tone="danger" dense>
        关联风险 {{ risksForBlock(block.id).length }}
      </StatusPill>
      <BaseButton
        class="ml-auto"
        size="sm"
        variant="ghost"
        title="删除该区块"
        @click="removeBlock(block.id)"
      >
        删除
      </BaseButton>
    </header>

    <input
      v-model="block.heading"
      type="text"
      class="mt-2 w-full border border-rule bg-paper px-2 py-1 text-xs font-medium text-ink outline-none focus:border-seal-2"
      @input="markEdited(block)"
    />
    <textarea
      v-model="block.body"
      rows="3"
      class="scroll-area mt-2 w-full border border-rule bg-paper px-2 py-1.5 text-xs leading-5 text-ink outline-none focus:border-seal-2"
      @input="markEdited(block)"
    ></textarea>

    <div class="mt-2 border border-rule bg-sheet px-2.5 py-2">
      <p class="text-2xs text-ink-4">正文预览（点击角标查看来源）</p>
      <p class="mt-1 text-xs leading-6 text-ink">
        <template
          v-for="(token, tokenIndex) in bodyTokens[block.id] ?? []"
          :key="block.id + '-' + tokenIndex"
        >
          <button
            v-if="token.type === 'cite'"
            type="button"
            class="mx-0.5 inline-flex -translate-y-0.5 items-center px-1 align-super text-2xs font-semibold ring-1 ring-inset transition-colors"
            :class="
              activeCitation === token.index
                ? 'bg-seal text-sheet ring-seal-2'
                : 'bg-seal text-seal-ink ring-seal-2 hover:bg-seal'
            "
            :title="'查看第 ' + token.index + ' 条来源'"
            @click="focusCitation(token.index)"
          >
            [{{ token.index }}]
          </button>
          <template v-else>{{ token.text }}</template>
        </template>
      </p>
    </div>

    <ul v-if="risksForBlock(block.id).length" class="mt-2 space-y-1">
      <li
        v-for="(note, noteIndex) in risksForBlock(block.id)"
        :key="block.id + '-risk-' + noteIndex"
        class="border px-2 py-1.5 text-2xs"
        :class="RISK_LEVEL_META[note.level].cardClass"
      >
        <span class="font-medium">{{ RISK_LEVEL_META[note.level].label }}</span>
        · {{ note.message }}
        <span class="block text-2xs text-ink-3">建议：{{ note.suggestion }}</span>
      </li>
    </ul>
  </article>
</template>
