/**
 * 应用外壳状态（项目信息、当前操作人、Mock 场景、全局提示、鉴权占位）。
 *
 * 以模块级单例 + 组合式函数的形式提供，避免引入状态管理库：
 * 组件通过 `useAppShell()` 读写同一份响应式状态。
 * 后续若引入 Pinia，只需替换本文件实现，组件调用方式不变。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { dataSourceLabel, env } from '@/config/env'
import { CURRENT_OPERATOR, DEMO_PROJECT } from '@/mock/dataset'
import type { ProjectInfo } from '@/mock/dataset'
import { mockScenario, setMockScenario } from '@/mock/scenario'
import {
  clearSession,
  getSession,
  isAuthenticated,
  onAuthExpired,
  setSession,
} from '@/services/api/auth'
import type { AuthSession } from '@/services/api/auth'
import { MOCK_SCENARIOS } from '@/services/api/types'
import type { MockScenario } from '@/services/api/types'
import type { OperatorInfo } from '@/types/api'

/** 全局提示级别。 */
export type NoticeLevel = 'info' | 'success' | 'warning' | 'error'

export interface Notice {
  id: string
  level: NoticeLevel
  text: string
  detail?: string
  /** 毫秒；0 表示不自动消失。 */
  timeout: number
  createdAt: number
}

let noticeSeq = 0

const notices = ref<Notice[]>([])
/** 鉴权失效提示，由 App 层决定是否跳转登录页。 */
const authExpiredReason = ref<string | null>(null)
/** 当前操作人，可由「切换身份」调试功能改写。 */
const operator = ref<OperatorInfo>({ ...CURRENT_OPERATOR })
/** 开发者工具开关，默认关闭。 */
const devOpen = ref(false)

// 订阅鉴权失效事件（401 由请求拦截器广播）
onAuthExpired((reason) => {
  authExpiredReason.value = reason
})

export interface AppShellApi {
  project: ProjectInfo
  operator: Ref<OperatorInfo>
  /**
   * 开发者工具是否展开。
   * 面向使用者的默认界面不含接口与 QA 工具；打开后才出现场景切换、接口衔接点、
   * 流程页头部的端点列表等。
   */
  devOpen: Ref<boolean>
  /** 当前 Mock 场景。 */
  scenario: Ref<MockScenario>
  scenarioOptions: typeof MOCK_SCENARIOS
  /** 场景中文名。 */
  scenarioLabel: ComputedRef<string>
  dataSource: string
  useMock: boolean
  authTokenKey: string
  notices: Ref<Notice[]>
  authExpiredReason: Ref<string | null>
  /** 是否已登录。 */
  authenticated: ComputedRef<boolean>
  session: ComputedRef<AuthSession | null>
  notify(level: NoticeLevel, text: string, detail?: string, timeout?: number): void
  dismissNotice(id: string): void
  clearNotices(): void
  changeScenario(scenario: MockScenario): void
  /** 鉴权占位：写入一个演示 token。 */
  signInDemo(): void
  signOut(): void
  dismissAuthExpired(): void
}

export function useAppShell(): AppShellApi {
  const scenarioLabel = computed(
    () => MOCK_SCENARIOS.find((item) => item.value === mockScenario.value)?.label ?? '未知',
  )

  function notify(level: NoticeLevel, text: string, detail?: string, timeout = 4000): void {
    noticeSeq += 1
    const notice: Notice = {
      id: `N-${noticeSeq}`,
      level,
      text,
      timeout,
      createdAt: Date.now(),
    }
    if (detail !== undefined) notice.detail = detail
    notices.value = [...notices.value, notice]

    if (timeout > 0) {
      setTimeout(() => dismissNotice(notice.id), timeout)
    }
  }

  function dismissNotice(id: string): void {
    notices.value = notices.value.filter((item) => item.id !== id)
  }

  function clearNotices(): void {
    notices.value = []
  }

  return {
    project: DEMO_PROJECT,
    operator,
    devOpen,
    scenario: mockScenario,
    scenarioOptions: MOCK_SCENARIOS,
    scenarioLabel,
    dataSource: dataSourceLabel,
    useMock: env.useMock,
    authTokenKey: env.authTokenKey,
    notices,
    authExpiredReason,
    authenticated: computed(() => {
      // 依赖 mock 场景以保持响应性
      void mockScenario.value
      return isAuthenticated()
    }),
    session: computed(() => {
      void mockScenario.value
      return getSession()
    }),
    notify,
    dismissNotice,
    clearNotices,
    changeScenario(scenario: MockScenario): void {
      setMockScenario(scenario)
      const label = MOCK_SCENARIOS.find((item) => item.value === scenario)?.label ?? scenario
      notify('info', `Mock 场景已切换为「${label}」，请重新执行当前操作查看状态。`)
    },
    signInDemo(): void {
      setSession({
        token: `demo-token-${Date.now().toString(36)}`,
        userName: CURRENT_OPERATOR.name,
        roles: [CURRENT_OPERATOR.role],
      })
      authExpiredReason.value = null
      notify('success', '已写入演示 Token（鉴权占位实现）。')
    },
    signOut(): void {
      clearSession()
      notify('info', '已清除本地 Token。')
    },
    dismissAuthExpired(): void {
      authExpiredReason.value = null
    },
  }
}
