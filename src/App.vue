<script setup lang="ts">
/**
 * 应用外壳。
 *
 * 结构：报头（刊名 + 状态）→ 悬浮步骤条（横向 8 步导航）→ 主栏。
 * 步骤导航悬浮在内容之上并固定在可视区域内：报头与步骤条同属一个 sticky 区块，
 * 两者之间留一道透明间隙，内容从间隙中穿过——这正是「浮动」的读法。
 *
 * 面向使用者的界面默认不显示接口信息。需要前后端对接时，打开报头右侧的
 * 「开发者」开关，才会出现场景切换与接口衔接点面板。
 */
import { computed, nextTick, ref, watch } from 'vue'

import ApiContractPanel from '@/components/common/ApiContractPanel.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import AppToasts from '@/components/common/AppToasts.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { useAppShell } from '@/composables/useAppShell'
import { currentComponent, currentRoute, routes, useRouter } from '@/router'
import type { MockScenario } from '@/services/api/types'

const shell = useAppShell()
const router = useRouter()
/** currentPath 由路由实例提供（router/index.ts 未单独导出该 ref）。 */
const { currentPath } = router

const {
  dataSource,
  useMock,
  scenario,
  scenarioOptions,
  scenarioLabel,
  authExpiredReason,
  authenticated,
  operator,
} = shell

/** 开发者工具默认关闭：面向使用者的默认界面不含接口信息。 */
const { devOpen } = shell
/** 接口衔接点面板（开发者工具内再单独开关）。 */
const contractOpen = ref(false)

const navEl = ref<HTMLElement | null>(null)
const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const scenarioHint = computed(
  () => scenarioOptions.find((item) => item.value === scenario.value)?.hint ?? '',
)

/**
 * 步骤条上的短名：去掉路由标题里的「N · 」前缀。
 * @param title 路由标题，形如「1 · 上传采访录音」
 * @returns 去掉道次前缀后的短标题
 */
function shortTitle(title: string): string {
  return title.replace(/^\d+ · /, '')
}

function handleScenarioChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as MockScenario
  shell.changeScenario(value)
}

function navigate(path: string): void {
  router.push(path)
}

/** 切换步骤后把当前项滚入可视区（窄屏步骤条横向滚动时必要）。 */
watch(currentPath, () => {
  void nextTick(() => {
    navEl.value?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  })
})
</script>

<template>
  <!-- taste-skill-ignore hairline,mono,shadow — 本项目既定设计语言「志书校样」以 1px 界行与等宽数据（编号/计数）为基础，理由见 DESIGN.md；悬浮条属于规则明示允许使用投影的 sticky bar -->
  <div class="min-h-dvh bg-paper text-ink">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-1.5 focus:text-xs focus:text-sheet"
    >
      跳到主内容
    </a>

    <!-- ============ sticky 区块：报头（实底）+ 悬浮步骤条 ============ -->
    <header class="sticky top-0 z-40">
      <!-- 报头 -->
      <div class="border-b border-rule-strong bg-sheet">
        <div class="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <div class="flex min-w-0 flex-col gap-y-0.5 sm:flex-row sm:items-baseline sm:gap-x-3">
            <span class="font-serif text-base font-semibold tracking-tight text-ink">乡音有据</span>
            <span class="meta">福州地方文化口述整理与共创</span>
          </div>

          <div class="ml-auto flex items-center gap-2">
            <StatusPill :tone="useMock ? 'warning' : 'success'" dense class="hidden sm:inline-flex">
              {{ dataSource }}
            </StatusPill>

            <!-- 开发者开关：默认关闭，使用者界面看不到接口与登录占位 -->
            <BaseButton
              variant="ghost"
              size="sm"
              :title="devOpen ? '隐藏开发者工具' : '显示开发者工具（场景切换 / 接口衔接点）'"
              @click="devOpen = !devOpen"
            >
              <AppIcon :name="devOpen ? 'chevronDown' : 'chevronRight'" :size="12" />
              开发者
            </BaseButton>
          </div>
        </div>

        <!-- 开发者工具条 -->
        <div v-if="devOpen" class="border-t border-rule bg-paper-2">
          <div
            class="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-1.5"
          >
            <label class="flex items-center gap-1.5">
              <span class="meta">Mock 场景</span>
              <select
                :value="scenario"
                :title="scenarioHint"
                class="h-6 cursor-pointer border border-rule-strong bg-sheet px-1.5 font-mono text-2xs text-ink"
                @change="handleScenarioChange"
              >
                <option v-for="option in scenarioOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <BaseButton variant="ghost" size="sm" @click="contractOpen = !contractOpen">
              {{ contractOpen ? '隐藏接口衔接点' : '显示接口衔接点' }}
            </BaseButton>

            <span class="meta">数据源 {{ dataSource }} · 当前场景 {{ scenarioLabel }}</span>
            <span class="meta hidden lg:inline">接口目录 33 个 · 待确认 28 项</span>

            <!-- 登录态是占位实现，属于开发者工具 -->
            <span class="flex items-center gap-2">
              <template v-if="authenticated">
                <span class="meta">{{ operator.name }} · {{ operator.role }}</span>
                <BaseButton variant="ghost" size="sm" @click="shell.signOut()">登出</BaseButton>
              </template>
              <template v-else>
                <span class="flex items-center gap-1">
                  <AppIcon name="lock" :size="12" class="text-vermilion" />
                  <span class="meta text-vermilion">未登录</span>
                </span>
                <BaseButton variant="secondary" size="sm" @click="shell.signInDemo()">
                  写入演示 Token
                </BaseButton>
              </template>
            </span>
          </div>
        </div>

        <!-- 鉴权失效（401 占位） -->
        <div
          v-if="authExpiredReason"
          class="flex flex-wrap items-center gap-2 border-t border-vermilion bg-vermilion-wash px-4 py-1.5"
        >
          <AppIcon name="lock" :size="12" class="text-vermilion" />
          <span class="text-2xs text-vermilion">
            {{ authExpiredReason }}（401 由请求拦截器捕获，此处为跳转登录页的占位位置）
          </span>
          <BaseButton variant="ghost" size="sm" @click="shell.dismissAuthExpired()"
            >知道了</BaseButton
          >
        </div>
      </div>

      <!-- 悬浮步骤条：透明间隙 + 纸面 + 柔和投影，内容从间隙穿过 -->
      <div class="bg-transparent px-4 pt-2 pb-2">
        <nav
          ref="navEl"
          class="sheet mx-auto flex max-w-[1280px] snap-x snap-proximity overflow-x-auto shadow-[0_1px_2px_rgb(22_24_26/0.05),0_10px_24px_-12px_rgb(22_24_26/0.22)]"
          aria-label="流程导航"
        >
          <button
            v-for="route in routes"
            :key="route.name"
            type="button"
            class="group flex min-w-[6.5rem] flex-1 snap-start cursor-pointer items-baseline justify-center gap-x-2 border-r border-rule px-3 py-2 whitespace-nowrap transition-colors last:border-r-0"
            :class="
              route.path === currentRoute.path
                ? 'bg-ink text-sheet'
                : 'text-ink-2 hover:bg-paper-2 hover:text-ink'
            "
            :aria-current="route.path === currentRoute.path ? 'page' : undefined"
            :title="route.description"
            @click="navigate(route.path)"
          >
            <span
              v-if="route.step > 0"
              class="font-mono text-2xs tabular-nums"
              :class="route.path === currentRoute.path ? 'text-sheet/80' : 'text-ink-4'"
            >
              {{ route.step }}
            </span>
            <span class="text-xs font-medium">{{ shortTitle(route.title) }}</span>
          </button>
        </nav>
      </div>
    </header>

    <!-- ============ 主栏 ============ -->
    <main id="main" class="mx-auto max-w-[1280px] space-y-8 px-4 py-6">
      <component :is="currentComponent" :key="currentRoute.path" />

      <!-- 接口衔接点：仅开发者开关打开时出现 -->
      <ApiContractPanel
        v-if="devOpen && contractOpen"
        :flow="currentRoute.step === 0 ? 1 : currentRoute.step"
      />
    </main>

    <AppToasts />
  </div>
</template>
