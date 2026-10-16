/**
 * 鉴权占位实现。
 *
 * 当前没有真实登录流程，本模块只提供：
 * 1. token 的读写与清除（localStorage，键名由 VITE_AUTH_TOKEN_KEY 配置）；
 * 2. 请求头注入所需的 token 获取函数；
 * 3. 401 触发点：清空 token 并广播事件，由 App 层决定跳转登录页。
 *
 * TODO-AUTH-1 待确认：token 是 Bearer 头、Cookie 还是签名参数；
 * TODO-AUTH-2 待确认：是否存在 refreshToken 续期流程；
 * TODO-AUTH-3 待确认：登录页路由与回跳参数格式。
 */
import { env } from '@/config/env'

/** 鉴权失效事件名。App 层订阅后跳转登录页。 */
export const AUTH_EXPIRED_EVENT = 'xiangyin:auth-expired'

export interface AuthSession {
  token: string
  /** ISO 8601 过期时间，可选。 */
  expiresAt?: string
  /** 展示用的用户名。 */
  userName?: string
  /** 角色，用于前端按钮级权限控制（后端仍需校验）。 */
  roles?: string[]
}

/** 内存缓存，避免每次请求都读 localStorage。 */
let cachedSession: AuthSession | null = null
let loaded = false

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

/**
 * 读取会话。未登录返回 null。
 * @returns 当前会话；未登录或存储不可用时返回 null
 */
export function getSession(): AuthSession | null {
  if (loaded) return cachedSession
  loaded = true
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(env.authTokenKey)
    cachedSession = raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    cachedSession = null
  }
  return cachedSession
}

/**
 * 获取 token 字符串，供请求头注入。
 * @returns token 字符串；未登录返回 null
 */
export function getAuthToken(): string | null {
  return getSession()?.token ?? null
}

/**
 * 写入会话（登录成功后调用）。
 * @param session 要写入的会话，token 为必填字段
 */
export function setSession(session: AuthSession): void {
  cachedSession = session
  loaded = true
  if (!canUseStorage()) return
  try {
    localStorage.setItem(env.authTokenKey, JSON.stringify(session))
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
}

/** 清除会话（登出或 401 时调用）。 */
export function clearSession(): void {
  cachedSession = null
  loaded = true
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(env.authTokenKey)
  } catch {
    /* ignore */
  }
}

/**
 * 构造鉴权请求头。无 token 时返回空对象。
 * @returns 鉴权请求头；无 token 时返回空对象
 */
export function buildAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  // TODO-AUTH-1 待确认鉴权方式；当前按 Bearer 处理
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * 是否已登录。
 * @returns 是否存在可用 token
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null
}

/**
 * 401 处理入口：由响应拦截器调用。
 * 清空会话并广播事件；跳转逻辑留给 App 层（本模块不依赖路由实现）。
 * @param reason 失效原因，会随事件广播给订阅者
 */
export function handleUnauthorized(reason = '登录状态已失效'): void {
  clearSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }))
  }
}

/**
 * 订阅鉴权失效事件，返回取消订阅函数。
 * @param handler 鉴权失效时的回调
 * @returns 取消订阅的函数
 */
export function onAuthExpired(handler: (reason: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<{ reason?: string }>).detail
    handler(detail?.reason ?? '登录状态已失效')
  }
  window.addEventListener(AUTH_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener)
}
