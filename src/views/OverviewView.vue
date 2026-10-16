<script setup lang="ts">
/**
 * 项目概览（面向使用者与项目干系人）。
 *
 * 这一页只回答四件事：这是什么、能做什么、怎么用、现在能用的是什么。
 * 面向开发者的内容（技术栈、目录结构、环境变量、接口与字段表、待确认清单、
 * 前后端协作约定、Mock 场景复现方式、AI 工具的契约名）已从本页移除——
 * 其中接口相关内容改为在报头右侧「开发者」开关里按需查看。
 */
import { computed } from 'vue'

import BaseButton from '@/components/common/BaseButton.vue'
import { useAppShell } from '@/composables/useAppShell'
import { mockStore } from '@/mock/store'
import { routes, useRouter } from '@/router'

const { project } = useAppShell()
const router = useRouter()

/** 核心功能：7 道流程，用使用者的语言描述。 */
const FLOWS = computed(() =>
  routes
    .filter((route) => route.step > 0)
    .map((route) => ({
      step: route.step,
      title: route.title.replace(/^\d+ · /, ''),
      description: route.description,
      path: route.path,
    })),
)

/** AI 在哪些环节介入，以及使用者能怎么干预（不含接口信息）。 */
const AI_POINTS = [
  {
    step: 2,
    name: '转写校正建议',
    does: '逐段指出方言用字、专名与断句可能有问题的地方，并说明理由。',
    control: '每条都可以「采纳」或「忽略」；忽略后仍可恢复，采纳在保存前也可以放弃。',
  },
  {
    step: 3,
    name: '信息抽取辅助',
    does: '从口述里挑出地点、人物、事件、机构与器物，给出规范名与别名。',
    control: '可一键采纳、批量确认、手工新增或改写；拿不准的会标成「待确认」。',
  },
  {
    step: 4,
    name: '资料检索增强',
    does: '补出你没写出来的检索词（如「三坊巷」→「三坊七巷」），并按相关度重排结果。',
    control: '扩展词可逐个加入或忽略，也可以整个关掉，回到纯关键词检索。',
  },
  {
    step: 5,
    name: '差异比对提示',
    does: '把创作内容和检索到的资料逐条对照，给出「一致 / 差异 / 待核实」的初判与理由。',
    control: '可以采纳初判，也可以点「请求重判」；人工结论会覆盖 AI，并标注「与 AI 不一致」。',
  },
  {
    step: 6,
    name: '内容生成草稿',
    does: '按选定类型、语气与篇幅写出初稿，并逐句附上来源角标。',
    control: '每个段落都能改；重新生成时可以选择保留你已经改过的段落。',
  },
  {
    step: 7,
    name: '审核风险提醒',
    does: '发布前指出「把传说写成了史实」「引用超出授权范围」「缺少来源」等问题。',
    control: '每条都要人工确认已知晓；存在严重风险时不允许直接发布。',
  },
]

const STATES = [
  {
    name: '加载中',
    sees: '正在取数据，界面上是一道界行与占位行。',
    todo: '稍等即可，按钮同时进入等待状态，不会重复提交。',
  },
  {
    name: '重试中',
    sees: '上一次请求失败后正在自动重试。',
    todo: '不需要你操作，页面会显示是第几次重试。',
  },
  { name: '成功', sees: '正常结果，并标注数据来源与耗时。', todo: '继续下一步。' },
  { name: '空数据', sees: '当前条件下没有内容。', todo: '按页面给出的建议放宽条件或换关键词。' },
  {
    name: '需人工确认',
    sees: 'AI 的判断只是建议，需要你确认。',
    todo: '确认或拒绝；拒绝后可以重新发起。这一步不能跳过。',
  },
  {
    name: '不可用',
    sees: '该能力未部署或已下线。',
    todo: '重试不会成功；按页面给出的人工替代方式继续。',
  },
  {
    name: '失败',
    sees: '按错误类型分类的提示（网络 / 超时 / 服务端等）。',
    todo: '只有可以重试的错误才会出现「重试」按钮。',
  },
]

/**
 * 项目规模：写成一句话，而不是「大数字 + 小标签」。
 * 后者是两个技能都明确点名的模板（impeccable 的 hero-metric，taste-skill 的 eyebrow）。
 */
const scaleLine = computed(
  () => `目前收录 ${mockStore.interviews.length} 条采访，已发布 ${project.publishedCount} 条内容。`,
)

const USAGE = [
  '顶部悬浮步骤条点任意一步即可切换流程；当前所在步骤是一块实心墨底，另外它固定在可视区域内，窄屏可以横向滑动。',
  '每道流程的操作按钮都在页面内部；切换流程用页面顶部的悬浮步骤条。',
  '数据的来源与登录状态在报头右侧。',
  '要看接口与字段说明时，打开报头右侧的「开发者」开关；使用者默认看不到这些内容。',
]
</script>

<template>
  <!-- taste-skill-ignore hairline,mono,shadow — 本项目既定设计语言「志书校样」以 1px 界行与等宽数据（编号/计数）为基础，理由见 DESIGN.md；悬浮条属于规则明示允许使用投影的 sticky bar -->
  <div class="space-y-8">
    <!-- ==================== 这是什么 ==================== -->
    <section class="rule-b pb-6">
      <div class="flex flex-col gap-y-1 sm:flex-row sm:items-baseline sm:gap-x-3">
        <h1 class="font-serif text-3xl font-semibold tracking-tight text-ink">乡音有据</h1>
        <span class="meta">福州地方文化口述整理与共创智能体</span>
      </div>
      <p class="measure mt-4 text-lg leading-8 text-ink">{{ project.description }}</p>
      <p class="measure mt-3 text-base leading-7 text-ink-2">
        它要解决的，是这类项目里最常见的三个麻烦：
        <span class="text-ink">录音、方志、族谱、旧报刊各在一处</span>，没有一条能追溯的引用链路；
        <span class="text-ink">口述材料难以整理</span
        >，方言用字、听不清的片段、讲述人记忆的出入都要逐段核对； 以及最要紧的一条——<span
          class="text-attention"
          >AI 写出来的东西，很容易把传说、个人记忆和史实混在一起</span
        >。
      </p>
      <p class="measure mt-3 text-base leading-7 text-ink-2">
        这个工作台的做法是把「证据有多硬」变成一等公民：每一条结论都带判定与理由，
        传说和低可信来源不会被悄悄采信，发布前还有一道风险检查拦着。
      </p>

      <p class="measure mt-4 text-base leading-7 text-ink-2">{{ scaleLine }}</p>

      <div class="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <BaseButton variant="primary" @click="router.push('/upload')">从第一道流程开始</BaseButton>
        <BaseButton variant="secondary" @click="router.push('/compare')">直接看差异标注</BaseButton>
      </div>
    </section>

    <!-- ==================== 核心功能：7 道流程 ==================== -->
    <section class="rule-t pt-5">
      <h2 class="font-serif text-lg font-semibold tracking-tight text-ink">核心功能：七道流程</h2>
      <p class="measure mt-2 text-base leading-7 text-ink-3">
        从一段已获授权的录音，到一份可以发布的故事卡或研学讲稿，全程留痕。顺序是固定的，每一步的产物都是下一步的输入。
      </p>

      <ol class="mt-4">
        <li v-for="flow in FLOWS" :key="flow.step">
          <button
            type="button"
            class="group flex w-full cursor-pointer items-baseline gap-x-4 border-b border-rule-soft py-3 text-left transition-colors hover:bg-paper-2"
            @click="router.push(flow.path)"
          >
            <span class="w-3 shrink-0 font-mono text-xs tabular-nums text-ink-4">
              {{ flow.step }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-serif text-base font-medium text-ink">{{ flow.title }}</span>
              <span class="measure mt-0.5 block text-base leading-7 text-ink-3">
                {{ flow.description }}
              </span>
            </span>
          </button>
        </li>
      </ol>
    </section>

    <!-- ==================== AI 介入点 ==================== -->
    <section class="rule-t pt-5">
      <h2 class="font-serif text-lg font-semibold tracking-tight text-ink">AI 在哪些环节帮你</h2>
      <p class="measure mt-2 text-base leading-7 text-ink-3">
        AI
        不是单独的一个功能，而是嵌在流程里的六个环节。每个环节它只给建议，最终判断始终由人来做，而且都能撤回。
      </p>

      <dl class="mt-4 divide-y divide-rule-soft">
        <div
          v-for="point in AI_POINTS"
          :key="point.name"
          class="grid gap-x-8 gap-y-1 py-3 lg:grid-cols-12"
        >
          <dt class="lg:col-span-3">
            <span class="meta">第 {{ point.step }} 道</span>
            <span class="mt-0.5 block font-serif text-base font-medium text-ink">{{
              point.name
            }}</span>
          </dt>
          <dd class="measure text-base leading-7 text-ink-2 lg:col-span-5">{{ point.does }}</dd>
          <dd class="measure text-base leading-7 text-ink-3 lg:col-span-4">
            <span class="meta">你能怎么干预</span><br />{{ point.control }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- ==================== 状态说明 ==================== -->
    <section class="rule-t pt-5">
      <h2 class="font-serif text-lg font-semibold tracking-tight text-ink">遇到这些状态怎么办</h2>
      <p class="measure mt-2 text-base leading-7 text-ink-3">
        每一道流程都会出现下面七种状态。它们不是故障提示，而是流程的正式组成部分。
      </p>

      <table class="mt-4 w-full border-collapse text-left text-base">
        <thead class="rule-b text-ink-4">
          <tr>
            <th class="py-2 pr-4 font-medium">状态</th>
            <th class="py-2 pr-4 font-medium">你会看到什么</th>
            <th class="py-2 font-medium">怎么办</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-rule-soft">
          <tr v-for="state in STATES" :key="state.name" class="align-top">
            <td class="whitespace-nowrap py-2 pr-4 font-medium text-ink">{{ state.name }}</td>
            <td class="py-2 pr-4 leading-6 text-ink-3">{{ state.sees }}</td>
            <td class="py-2 leading-6 text-ink-2">{{ state.todo }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ==================== 怎么用 ==================== -->
    <section class="rule-t pt-5">
      <h2 class="font-serif text-lg font-semibold tracking-tight text-ink">怎么用</h2>
      <ul class="measure mt-3 space-y-2">
        <li v-for="item in USAGE" :key="item" class="flex gap-x-3 text-base leading-7 text-ink-2">
          <span class="mt-2.5 h-px w-3 shrink-0 bg-rule-strong" aria-hidden="true" />
          <span>{{ item }}</span>
        </li>
      </ul>
    </section>

    <!-- ==================== 当前状态与说明 ==================== -->
    <section class="rule-t pt-5">
      <h2 class="font-serif text-lg font-semibold tracking-tight text-ink">当前状态与说明</h2>
      <dl class="measure mt-3 space-y-2.5">
        <div class="flex gap-x-3">
          <dt class="w-24 shrink-0 pt-1 text-xs text-ink-4">当前版本</dt>
          <dd class="text-base leading-7 text-ink-2">
            可运行的前端原型，尚未接入真实后端、真实采访录音与授权书。
          </dd>
        </div>
        <div class="flex gap-x-3">
          <dt class="w-24 shrink-0 pt-1 text-xs text-ink-4">数据来源</dt>
          <dd class="text-base leading-7 text-ink-2">
            全部为演示数据：一条福州口述采访（林水妹）、十三项抽取结果、十条地方资料、六条比对项与一篇生成草稿。
          </dd>
        </div>
        <div class="flex gap-x-3">
          <dt class="w-24 shrink-0 pt-1 text-xs text-ink-4">请勿直接引用</dt>
          <dd class="text-base leading-7 text-attention">
            演示数据里的资料摘录、引用格式与 AI 产出均为示例内容，不能作为真实史实或引用来源使用。
          </dd>
        </div>
        <div class="flex gap-x-3">
          <dt class="w-24 shrink-0 pt-1 text-xs text-ink-4">主持范围</dt>
          <dd class="text-base leading-7 text-ink-2">三坊七巷及闽都文化片区的口述采访整理。</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
