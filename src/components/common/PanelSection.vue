<script setup lang="ts">
/**
 * 分区。
 *
 * 刻意**不是**卡片：印刷世界用通栏界行 + 留白分区，而不是圆角容器。
 * 这样也天然避免了「卡片套卡片」这一最常见的模板化痕迹。
 */
interface Props {
  title: string
  description?: string
  dense?: boolean
  bodyClass?: string
  /** 需要独立图版时（例如并排的两个数据源）加纸面与四边框。 */
  framed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  dense: false,
  bodyClass: '',
  framed: false,
})
</script>

<template>
  <section :class="props.framed ? 'sheet' : 'rule-t'">
    <header
      class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
      :class="props.framed ? 'px-3 pt-2.5' : 'pt-2.5'"
    >
      <div class="min-w-0">
        <h2 class="font-serif text-sm font-semibold tracking-tight text-ink">
          {{ props.title }}
        </h2>
        <p v-if="props.description" class="measure mt-0.5 text-xs leading-5 text-ink-3">
          {{ props.description }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <slot name="actions" />
      </div>
    </header>
    <div :class="[props.dense ? 'py-2' : 'py-3', props.framed ? 'px-3' : '', props.bodyClass]">
      <slot />
    </div>
  </section>
</template>
