<script setup lang="ts">
/**
 * 流程 6 的生成参数面板。
 *
 * 唯一职责：铺开输出类型 / 语气 / 篇幅 / 创作自由度 / 两个开关 / 标题读者与附加要求，
 * 组装「纳入范围选择器」，并给出发起生成、切换到人工撰写与最近一次请求体预览。
 * 参数状态由生成参数上下文持有，本组件只负责呈现与改写，不直接调用接口。
 */
import BaseButton from '@/components/common/BaseButton.vue'
import JsonPreview from '@/components/common/JsonPreview.vue'
import PanelSection from '@/components/common/PanelSection.vue'
import IncludeScopeSelector from '@/components/flow6/IncludeScopeSelector.vue'
import { useGenerationDraftContext } from '@/composables/useGenerationDraft'
import {
  LENGTH_OPTIONS,
  OUTPUT_TYPE_OPTIONS,
  TONE_OPTIONS,
  useGenerationFormContext,
} from '@/composables/useGenerationForm'

interface Props {
  /** 生成初稿是否进行中。 */
  genBusy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 发起生成初稿。 */
  generate: []
  /** 切换到人工撰写模式。 */
  humanDraft: []
}>()

const {
  outputType,
  tone,
  lengthPreset,
  creativity,
  requireCitation,
  allowUnverified,
  title,
  audience,
  extraInstruction,
  canGenerate,
  onCreativityInput,
} = useGenerationFormContext()

const { lastRequestBody } = useGenerationDraftContext()
</script>

<template>
  <PanelSection
    title="生成参数"
    description="请求体对应 CreateGenerationRequest，界面下方可预览实际发送的 JSON。"
  >
    <div class="space-y-4">
      <!-- 输出类型 -->
      <div>
        <p class="mb-1.5 text-2xs font-medium text-ink-3">输出类型 outputType</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="option in OUTPUT_TYPE_OPTIONS"
            :key="option.value"
            type="button"
            class="border px-3 py-2 text-left transition-colors"
            :class="
              outputType === option.value
                ? 'border-seal-2 bg-seal'
                : 'border-rule bg-paper hover:border-rule'
            "
            @click="outputType = option.value"
          >
            <span class="block text-xs font-medium text-ink">{{ option.label }}</span>
            <span class="mt-0.5 block text-2xs text-ink-4">{{ option.hint }}</span>
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <!-- 语气 -->
        <div>
          <p class="mb-1.5 text-2xs font-medium text-ink-3">语气 tone</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="option in TONE_OPTIONS"
              :key="option.value"
              type="button"
              class="px-2 py-1 text-2xs ring-1 ring-inset transition-colors"
              :class="
                tone === option.value
                  ? 'bg-seal text-seal-ink ring-seal-2'
                  : 'bg-sheet text-ink-3 ring-rule hover:text-ink'
              "
              :title="option.hint"
              @click="tone = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- 篇幅 -->
        <div>
          <p class="mb-1.5 text-2xs font-medium text-ink-3">篇幅 length</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="option in LENGTH_OPTIONS"
              :key="option.value"
              type="button"
              class="px-2 py-1 text-2xs ring-1 ring-inset transition-colors"
              :class="
                lengthPreset === option.value
                  ? 'bg-seal text-seal-ink ring-seal-2'
                  : 'bg-sheet text-ink-3 ring-rule hover:text-ink'
              "
              :title="option.hint"
              @click="lengthPreset = option.value"
            >
              {{ option.label }} · {{ option.hint }}
            </button>
          </div>
        </div>
      </div>

      <!-- 创作自由度 -->
      <div class="border border-rule bg-paper p-3">
        <div class="flex items-center justify-between">
          <p class="text-2xs font-medium text-ink-3">创作自由度 creativity</p>
          <span class="font-mono text-xs text-seal-ink">{{ Math.round(creativity * 100) }}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="creativity"
          class="mt-2 h-1.5 w-full cursor-pointer appearance-none bg-paper-3 accent-seal-ink"
          @input="onCreativityInput"
        />
        <p class="mt-1.5 text-2xs text-ink-4">
          {{
            creativity <= 0.2
              ? '0 表示严格复述资料，几乎不做改写。'
              : creativity >= 0.7
                ? '自由度较高，可能出现资料未直接支持的表述，请重点核对角标。'
                : '在忠实资料的前提下允许适度润色与转场。'
          }}
        </p>
      </div>

      <!-- 开关 -->
      <div class="grid gap-2 sm:grid-cols-2">
        <label class="flex cursor-pointer items-start gap-2 border border-rule bg-paper p-2.5">
          <input
            v-model="requireCitation"
            type="checkbox"
            class="mt-0.5 size-3.5 accent-seal-ink"
          />
          <span>
            <span class="block text-xs text-ink">强制逐句标注来源</span>
            <span class="mt-0.5 block text-2xs text-ink-4">
              requireCitation：无法溯源的结论不写入正文。
            </span>
          </span>
        </label>
        <label
          class="flex cursor-pointer items-start gap-2 border p-2.5"
          :class="allowUnverified ? 'border-attention bg-attention-wash' : 'border-rule bg-paper'"
        >
          <input
            v-model="allowUnverified"
            type="checkbox"
            class="mt-0.5 size-3.5 accent-attention"
          />
          <span>
            <span class="block text-xs text-ink">允许收录待核实内容</span>
            <span class="mt-0.5 block text-2xs text-ink-4">
              allowUnverified：开启后必须人工确认才能进入流程 7。
            </span>
          </span>
        </label>
      </div>

      <!-- 标题 / 读者 / 附加要求 -->
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-2xs font-medium text-ink-3">标题 title</span>
          <input
            v-model="title"
            type="text"
            class="w-full border border-rule bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-seal-2"
            placeholder="例如：一双手推亮的漆器"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-2xs font-medium text-ink-3">目标读者 audience</span>
          <input
            v-model="audience"
            type="text"
            class="w-full border border-rule bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-seal-2"
            placeholder="例如：小学四年级研学团"
          />
        </label>
      </div>
      <label class="block">
        <span class="mb-1 block text-2xs font-medium text-ink-3">附加要求 extraInstruction</span>
        <textarea
          v-model="extraInstruction"
          rows="2"
          class="w-full border border-rule bg-paper px-2.5 py-1.5 text-xs text-ink outline-none focus:border-seal-2"
          placeholder="例如：开头用一句福州方言原话，结尾给出一个可实地验证的观察任务。"
        ></textarea>
      </label>

      <IncludeScopeSelector />

      <div class="flex flex-wrap items-center gap-2">
        <BaseButton
          variant="primary"
          :loading="props.genBusy"
          :disabled="!canGenerate"
          @click="emit('generate')"
        >
          生成初稿
        </BaseButton>
        <BaseButton variant="ghost" @click="emit('humanDraft')"
          >无法生成？切换到人工撰写</BaseButton
        >
        <span class="text-2xs text-ink-4">接口：POST /generations:create</span>
      </div>
      <p v-if="!canGenerate" class="text-2xs text-attention">
        请至少填写标题并勾选 1 条论断，才能发起生成。
      </p>

      <div v-if="lastRequestBody">
        <JsonPreview :value="lastRequestBody" label="最近一次请求体" :collapsed-lines="10" />
      </div>
    </div>
  </PanelSection>
</template>
