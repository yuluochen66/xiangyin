/**
 * 极简 hash 路由。
 *
 * 为什么不用 vue-router：本项目是单页原型，只有 8 个平级路由、
 * 无嵌套、无守卫、无参数；自研 40 行可避免引入额外依赖，
 * 也便于后续替换（替换时只需保持 `useRouter()` 的四个导出）。
 */
import { computed, defineAsyncComponent, ref } from 'vue'
import type { Component } from 'vue'

export interface RouteDef {
  path: string
  name: string
  /** 顶部悬浮步骤条上的显示名。 */
  title: string
  /** 对应流程编号（1~7），概览页为 0。 */
  step: number
  /** 一句话说明。 */
  description: string
  component: () => Promise<{ default: Component }>
}

/** 路由表。component 采用按需加载。 */
export const routes: RouteDef[] = [
  {
    path: '/',
    name: 'overview',
    title: '项目概览',
    step: 0,
    description: '项目状态、7 个流程的总览与接口衔接点速查。',
    component: () => import('@/views/OverviewView.vue'),
  },
  {
    path: '/upload',
    name: 'upload',
    title: '1 · 上传采访录音',
    step: 1,
    description: '拖拽上传、授权确认、分片进度与失败重试。',
    component: () => import('@/views/Flow1UploadView.vue'),
  },
  {
    path: '/transcribe',
    name: 'transcribe',
    title: '2 · 转写与人工校正',
    step: 2,
    description: '时间轴 / 段落双视图、低置信度高亮、AI 校正建议、版本回滚。',
    component: () => import('@/views/Flow2TranscribeView.vue'),
  },
  {
    path: '/extract',
    name: 'extract',
    title: '3 · 提取地点人物事件',
    step: 3,
    description: '结构化卡片、人工增删改、同义项合并、原文溯源跳转。',
    component: () => import('@/views/Flow3ExtractView.vue'),
  },
  {
    path: '/search',
    name: 'search',
    title: '4 · 检索地方资料',
    step: 4,
    description: '条件组合检索、可信度分级、AI 智能扩展词与关联线索。',
    component: () => import('@/views/Flow4SearchView.vue'),
  },
  {
    path: '/compare',
    name: 'compare',
    title: '5 · 标注一致与差异',
    step: 5,
    description: '创作内容与资料左右对照、逐条标注、进度统计。',
    component: () => import('@/views/Flow5CompareView.vue'),
  },
  {
    path: '/generate',
    name: 'generate',
    title: '6 · 生成故事卡 / 讲稿',
    step: 6,
    description: '选类型调语气、自动引用来源、人工编辑与重新生成。',
    component: () => import('@/views/Flow6GenerateView.vue'),
  },
  {
    path: '/publish',
    name: 'publish',
    title: '7 · 审核发布',
    step: 7,
    description: '状态流转、AI 风险提醒、审核意见、版本记录与回滚。',
    component: () => import('@/views/Flow7PublishView.vue'),
  },
]

/**
 * 把路径归一为 '/xxx' 形式。
 * @param raw 原始 hash 值，可能带 #、可能为空
 * @returns 归一化路径，形如 `/upload`；空 hash 返回 `/`
 */
function normalize(raw: string): string {
  const withoutHash = raw.replace(/^#/, '')
  if (withoutHash.length === 0) return '/'
  return withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`
}

const currentPath = ref<string>(normalize(window.location.hash))

window.addEventListener('hashchange', () => {
  currentPath.value = normalize(window.location.hash)
})

export const currentRoute = computed<RouteDef>(
  () => routes.find((route) => route.path === currentPath.value) ?? routes[0]!,
)

/** 路由组件（异步加载并缓存）。 */
export const currentComponent = computed(() =>
  defineAsyncComponent({
    loader: currentRoute.value.component,
    delay: 0,
    timeout: 20000,
  }),
)

export interface RouterApi {
  currentPath: typeof currentPath
  currentRoute: typeof currentRoute
  push(path: string): void
  replace(path: string): void
  /** 按流程编号跳转。 */
  goToStep(step: number): void
}

export function useRouter(): RouterApi {
  function push(path: string): void {
    const target = normalize(path)
    if (target === currentPath.value) return
    window.location.hash = target
    // hashchange 事件在部分场景下异步触发，这里同步更新以保证界面即时响应
    currentPath.value = target
  }

  return {
    currentPath,
    currentRoute,
    push,
    replace(path) {
      const target = normalize(path)
      window.history.replaceState(null, '', `#${target}`)
      currentPath.value = target
    },
    goToStep(step) {
      const route = routes.find((item) => item.step === step)
      if (route) push(route.path)
    },
  }
}
