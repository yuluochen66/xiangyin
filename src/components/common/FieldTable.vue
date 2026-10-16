<script setup lang="ts">
/**
 * 接口字段表。
 *
 * 渲染 endpointCatalog 里的 FieldDoc，是前后端对齐字段时的直接依据。
 */
import { REQUIREMENT_LABEL } from '@/api/endpointCatalog'
import type { FieldDoc, Requirement } from '@/api/endpointCatalog'

interface Props {
  fields: FieldDoc[]
  caption?: string
}

const props = withDefaults(defineProps<Props>(), { caption: undefined })

const REQ_CLASS: Record<Requirement, string> = {
  M: 'bg-vermilion text-vermilion ring-vermilion',
  O: 'bg-paper-3 text-ink-3 ring-rule-strong',
  C: 'bg-attention text-attention ring-attention',
}
</script>

<template>
  <div class="overflow-x-auto border border-rule">
    <table class="w-full border-collapse text-left text-2xs">
      <caption
        v-if="props.caption"
        class="border-b border-rule bg-sheet px-3 py-1.5 text-left text-2xs text-ink-3"
      >
        {{
          props.caption
        }}
      </caption>
      <thead class="bg-sheet text-ink-3">
        <tr>
          <th class="px-2.5 py-1.5 font-medium">字段名</th>
          <th class="px-2.5 py-1.5 font-medium">类型</th>
          <th class="px-2.5 py-1.5 font-medium">必填</th>
          <th class="px-2.5 py-1.5 font-medium">说明</th>
          <th class="px-2.5 py-1.5 font-medium">默认值</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-rule">
        <tr v-for="field in props.fields" :key="field.name" class="align-top hover:bg-paper-3">
          <td class="whitespace-nowrap px-2.5 py-1.5 font-mono text-ink">{{ field.name }}</td>
          <td class="px-2.5 py-1.5 font-mono text-seal-ink">{{ field.type }}</td>
          <td class="px-2.5 py-1.5">
            <span
              class="inline-flex px-1.5 py-px text-2xs ring-1 ring-inset"
              :class="REQ_CLASS[field.requirement]"
            >
              {{ REQUIREMENT_LABEL[field.requirement] }}
            </span>
          </td>
          <td class="px-2.5 py-1.5 text-ink-3">{{ field.desc }}</td>
          <td class="px-2.5 py-1.5 font-mono text-ink-4">{{ field.fallback ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
