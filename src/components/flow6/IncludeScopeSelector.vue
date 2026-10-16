<script setup lang="ts">
/**
 * 流程 6 的纳入范围选择器。
 *
 * 唯一职责：勾选本次生成纳入的论断（claimIds）与允许引用的资料（sourceIds），并提供
 * 「全选一致项」「只选高可信」两个批量操作；不渲染其他生成参数，也不触发任何接口调用。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useGenerationFormContext } from '@/composables/useGenerationForm'

const {
  claimOptions,
  sourceOptions,
  selectedClaimIds,
  selectedSourceIds,
  selectAllClaims,
  selectHighCredibilitySources,
} = useGenerationFormContext()
</script>

<template>
  <div class="grid gap-3 lg:grid-cols-2">
    <div class="border border-rule bg-paper p-2.5">
      <div class="flex items-center justify-between gap-2">
        <p class="text-2xs font-medium text-ink-3">
          纳入论断 claimIds（{{ selectedClaimIds.length }} / {{ claimOptions.length }}）
        </p>
        <BaseButton size="sm" variant="ghost" @click="selectAllClaims">全选一致项</BaseButton>
      </div>
      <div class="scroll-area mt-2 max-h-40 space-y-1.5 overflow-auto pr-1">
        <label
          v-for="item in claimOptions"
          :key="item.itemId"
          class="flex cursor-pointer items-start gap-2 px-1 py-1 hover:bg-sheet"
        >
          <input
            v-model="selectedClaimIds"
            type="checkbox"
            :value="item.itemId"
            class="mt-0.5 size-3.5 shrink-0 accent-seal-ink"
          />
          <span class="min-w-0">
            <span class="block text-2xs leading-4 text-ink-2">{{ item.claimText }}</span>
            <span class="mt-0.5 block text-2xs text-ink-4">
              {{ item.itemId }} · {{ item.verdictLabel }}
            </span>
          </span>
        </label>
      </div>
    </div>

    <div class="border border-rule bg-paper p-2.5">
      <div class="flex items-center justify-between gap-2">
        <p class="text-2xs font-medium text-ink-3">
          允许引用 sourceIds（{{ selectedSourceIds.length }} / {{ sourceOptions.length }}）
        </p>
        <BaseButton size="sm" variant="ghost" @click="selectHighCredibilitySources">
          只选高可信
        </BaseButton>
      </div>
      <div class="scroll-area mt-2 max-h-40 space-y-1.5 overflow-auto pr-1">
        <label
          v-for="source in sourceOptions"
          :key="source.sourceId"
          class="flex cursor-pointer items-start gap-2 px-1 py-1 hover:bg-sheet"
        >
          <input
            v-model="selectedSourceIds"
            type="checkbox"
            :value="source.sourceId"
            class="mt-0.5 size-3.5 shrink-0 accent-seal-ink"
          />
          <span class="min-w-0">
            <span class="block truncate text-2xs text-ink-2">{{ source.title }}</span>
            <span class="mt-0.5 flex items-center gap-1.5">
              <StatusPill :tone="source.credibilityTone" dense>{{
                source.credibilityLabel
              }}</StatusPill>
              <span class="truncate text-2xs text-ink-4">{{ source.publisher }}</span>
            </span>
          </span>
        </label>
      </div>
    </div>
  </div>
</template>
