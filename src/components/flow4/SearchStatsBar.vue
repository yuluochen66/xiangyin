<script setup lang="ts">
/**
 * 流程 4 的检索结果统计条。
 *
 * 唯一职责：在结果区顶部展示一次检索的规模与耗时——命中数、页码与每页条数、
 * 界面耗时、检索耗时、是否 mock 数据、第几次调用。纯展示，不持有任何状态。
 */
import { computed } from 'vue'

import StatusPill from '@/components/common/StatusPill.vue'
import type { SearchSourcesResponse } from '@/types/api'

interface Props {
  result: SearchSourcesResponse | null
  tookMs: number | null
  fromMock: boolean
  attempts: number
}

const props = defineProps<Props>()

const result = computed(() => props.result)
</script>

<template>
  <!-- 结果统计条 -->
  <div
    v-if="result"
    class="flex flex-wrap items-center gap-x-3 gap-y-1.5 border border-rule bg-sheet px-3 py-2 text-2xs text-ink-3"
  >
    <span class="text-ink-2"
      >命中 <b class="text-ink">{{ result.total }}</b> 条</span
    >
    <span>第 {{ result.page }} 页 · 每页 {{ result.pageSize }}</span>
    <span v-if="props.tookMs !== null">界面耗时 {{ props.tookMs }} ms</span>
    <span v-if="result.tookMs">检索耗时 {{ result.tookMs }} ms</span>
    <StatusPill v-if="props.fromMock" tone="warning" dense>mock 数据</StatusPill>
    <span class="ml-auto">第 {{ props.attempts }} 次调用</span>
  </div>
</template>
