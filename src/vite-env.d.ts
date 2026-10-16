/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/**
 * 环境变量类型声明。
 *
 * 命名规范：仅 VITE_ 前缀的变量会被注入客户端（见 .env.example）。
 * 这里只声明「有默认值、可缺省」的可选字符串——运行时解析与兜底统一由
 * src/config/env.ts 完成，业务代码不得直接读取 import.meta.env。
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCK?: string
  readonly VITE_MOCK_LATENCY_MS?: string
  readonly VITE_MOCK_FAILURE_RATE?: string
  readonly VITE_REQUEST_TIMEOUT_MS?: string
  readonly VITE_REQUEST_MAX_RETRIES?: string
  readonly VITE_AUTH_TOKEN_KEY?: string
  readonly VITE_LOGIN_PATH?: string
  readonly VITE_APP_TITLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
