/**
 * 应用入口。
 *
 * 集中完成三件事：
 * 1. 挂载根组件；
 * 2. 注册全局请求拦截器（鉴权头由 services/api/auth 提供，这里只放跨模块逻辑）；
 * 3. 启动时校验运行环境（mock / 后端地址）并给出提示。
 */
import { createApp } from 'vue'

import App from './App.vue'
import { env } from './config/env'
import { api } from './services/api'
import './style.css'

/* ------------------------------------------------------------------ */
/* 请求 / 响应拦截器示例                                               */
/* ------------------------------------------------------------------ */

// 请求拦截器：统一补充业务侧请求头（鉴权头已由 httpClient 注入，不重复添加）
api.useRequestInterceptor((init) => ({
  ...init,
  headers: {
    ...init.headers,
    // TODO-BE-1 待确认：是否需要租户 / 项目维度请求头
    'X-Client': 'xiangyin-web',
  },
}))

// 响应拦截器：若后端使用 { result: ... } 而不支持 { data: ... }，
// 可在此处做一次兼容映射，避免每个业务模块重复处理。
api.useResponseInterceptor((raw) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>
    if (!('data' in record) && 'result' in record) {
      return { ...record, data: record['result'] }
    }
  }
  return raw
})

/* ------------------------------------------------------------------ */
/* 启动                                                               */
/* ------------------------------------------------------------------ */

createApp(App).mount('#app')

if (env.useMock) {
  console.info(
    '[乡音有据] 当前使用本地 Mock 数据层（VITE_USE_MOCK=true）。\n' +
      '报头右侧「开发者」开关里可切换成功 / 空数据 / 失败 / 加载中 / 不可用 / 需人工确认，' +
      '用于验证每个流程的 7 种界面状态。',
  )
} else {
  console.info(`[乡音有据] 当前对接真实后端：${env.apiBaseUrl}`)
}
