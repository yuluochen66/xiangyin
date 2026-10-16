<script setup lang="ts">
/**
 * 接口衔接点面板。
 *
 * 每个流程页底部都会挂这个组件：把该流程涉及的**全部后端接口**、
 * 请求/响应字段表、前端调用位置、mock 实现位置与待确认项一次列清，
 * 让前端开发与后端对接都在同一个界面上完成，不必跳文档。
 */
import { computed, ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

import { endpointsOfFlow } from '@/api/endpointCatalog'
import type { EndpointDoc } from '@/api/endpointCatalog'
import BaseButton from '@/components/common/BaseButton.vue'
import FieldTable from '@/components/common/FieldTable.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useAppShell } from '@/composables/useAppShell'
import type { HttpMethod } from '@/services/api/types'

interface Props {
  flow: number
  /** 默认是否展开。 */
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), { defaultOpen: false })

const { notify } = useAppShell()

const open = ref(props.defaultOpen)
const expandedId = ref<string | null>(null)

const endpoints = computed<EndpointDoc[]>(() => endpointsOfFlow(props.flow))

const todos = computed(() =>
  endpoints.value.flatMap((item) =>
    (item.todos ?? []).map((todo) => ({ id: item.id, label: item.label, todo })),
  ),
)

const METHOD_CLASS: Record<HttpMethod, string> = {
  GET: 'bg-seal text-seal-ink ring-seal-2',
  POST: 'bg-verified text-verified ring-verified',
  PUT: 'bg-attention text-attention ring-attention',
  PATCH: 'bg-attention text-attention ring-attention',
  DELETE: 'bg-vermilion text-vermilion ring-vermilion',
}

function toggle(id: string): void {
  expandedId.value = expandedId.value === id ? null : id
}

async function copyContract(): Promise<void> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(endpoints.value, null, 2))
    notify('success', `已复制流程 ${props.flow} 的 ${endpoints.value.length} 个接口契约。`)
  } catch {
    notify('error', '复制失败，请检查浏览器剪贴板权限。')
  }
}
</script>

<template>
  <section class="border border-rule bg-sheet">
    <header class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <button
        type="button"
        class="flex min-w-0 items-center gap-2 text-left"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="text-xs text-ink-4 transition-transform" :class="open ? 'rotate-90' : ''">
          ▶
        </span>
        <span class="text-xs font-semibold text-ink">接口衔接点</span>
        <StatusPill tone="violet" dense>{{ endpoints.length }} 个接口</StatusPill>
        <StatusPill v-if="todos.length > 0" tone="warning" dense
          >{{ todos.length }} 项待确认</StatusPill
        >
      </button>
      <BaseButton variant="ghost" size="sm" @click="copyContract">复制契约 JSON</BaseButton>
    </header>

    <div v-if="open" class="space-y-2.5 border-t border-rule px-4 py-3.5">
      <p class="text-2xs leading-5 text-ink-4">
        下列接口即为本流程的全部「数据交互节点」。前端通过
        <code class="bg-paper-3 px-1 py-px font-mono text-ink-2">@/api</code>
        调用，mock 与真实后端由环境变量
        <code class="bg-paper-3 px-1 py-px font-mono text-ink-2">VITE_USE_MOCK</code>
        切换；后端实现时请逐条核对字段表与待确认项。
      </p>

      <article v-for="endpoint in endpoints" :key="endpoint.id" class="border border-rule bg-paper">
        <button
          type="button"
          class="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left"
          :aria-expanded="expandedId === endpoint.id"
          @click="toggle(endpoint.id)"
        >
          <span
            class="px-1.5 py-px font-mono text-2xs font-semibold ring-1 ring-inset"
            :class="METHOD_CLASS[endpoint.method]"
          >
            {{ endpoint.method }}
          </span>
          <code class="font-mono text-2xs text-ink-2">{{ endpoint.url }}</code>
          <span class="text-2xs text-ink-3">{{ endpoint.label }}</span>
          <span
            v-if="endpoint.todos && endpoint.todos.length > 0"
            class="bg-attention px-1.5 py-px text-2xs text-attention ring-1 ring-inset ring-attention"
          >
            待确认 {{ endpoint.todos.length }}
          </span>
          <span class="ml-auto text-2xs text-ink-4">{{ endpoint.id }}</span>
        </button>

        <div v-if="expandedId === endpoint.id" class="space-y-2.5 border-t border-rule px-3 py-2.5">
          <dl class="grid grid-cols-1 gap-1.5 text-2xs sm:grid-cols-2">
            <div class="flex gap-1.5">
              <dt class="shrink-0 text-ink-4">前端调用</dt>
              <dd class="font-mono text-ink-2">{{ endpoint.caller }}</dd>
            </div>
            <div class="flex gap-1.5">
              <dt class="shrink-0 text-ink-4">mock 位置</dt>
              <dd class="font-mono text-ink-2">{{ endpoint.mockFile }}</dd>
            </div>
            <div class="flex gap-1.5">
              <dt class="shrink-0 text-ink-4">请求类型</dt>
              <dd class="font-mono text-seal-ink">{{ endpoint.requestType ?? '无请求体' }}</dd>
            </div>
            <div class="flex gap-1.5">
              <dt class="shrink-0 text-ink-4">响应类型</dt>
              <dd class="font-mono text-seal-ink">{{ endpoint.responseType }}</dd>
            </div>
          </dl>

          <FieldTable
            v-if="endpoint.requestFields"
            :fields="endpoint.requestFields"
            caption="请求字段"
          />
          <FieldTable
            v-if="endpoint.responseFields"
            :fields="endpoint.responseFields"
            caption="响应字段"
          />

          <ul v-if="endpoint.todos && endpoint.todos.length > 0" class="space-y-1">
            <li
              v-for="todo in endpoint.todos"
              :key="todo"
              class="flex gap-1.5 bg-attention-wash px-2 py-1 text-2xs text-attention"
            >
              <span aria-hidden="true"><AppIcon name="question" :size="14" /></span>
              <span>{{ todo }}</span>
            </li>
          </ul>
        </div>
      </article>
    </div>
  </section>
</template>
