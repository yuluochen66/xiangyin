/**
 * 环境变量集中出口。
 *
 * 设计约束（前后端协作约定）：
 * - 业务代码一律 `import { env } from '@/config/env'`，禁止直接读 `import.meta.env`；
 * - 所有字段都有默认值，后端未就绪或变量缺失时前端仍能独立运行；
 * - 类型转换（string → number/boolean）只在本文件发生。
 */

/**
 * 读取字符串变量，空串视为未配置。
 * @param raw 原始环境变量值（可能为 undefined）
 * @param fallback 未配置或为空串时使用的默认值
 * @returns 去除首尾空白后的字符串；未配置时返回 fallback
 */
function readString(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback
}

/**
 * 读取布尔变量，接受 true/1/yes/on。
 * @param raw 原始环境变量值
 * @param fallback 无法识别时使用的默认值
 * @returns 解析后的布尔值；空串视为未配置
 */
function readBool(raw: unknown, fallback: boolean): boolean {
  if (typeof raw !== 'string') return fallback
  const value = raw.trim().toLowerCase()
  if (value.length === 0) return fallback
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
}

/**
 * 读取整数变量，非法值回落默认。
 * @param raw 原始环境变量值
 * @param fallback 非法时使用的默认值
 * @param min 允许的最小值（含）
 * @returns 取整并夹取到 min 以上的整数
 */
function readInt(raw: unknown, fallback: number, min = 0): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.round(value))
}

/**
 * 读取 0~1 的小数变量。
 * @param raw 原始环境变量值
 * @param fallback 非法时使用的默认值
 * @returns 夹取到 0~1 的小数
 */
function readRatio(raw: unknown, fallback: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

export interface AppEnv {
  /** 接口基址。 */
  apiBaseUrl: string
  /** 是否使用本地 mock 数据层。 */
  useMock: boolean
  /** mock 基准延迟（毫秒）。 */
  mockLatencyMs: number
  /** mock 随机失败率。 */
  mockFailureRate: number
  /** 请求默认超时（毫秒）。 */
  requestTimeoutMs: number
  /** 自动重试次数。 */
  requestMaxRetries: number
  /** token 存储键名。 */
  authTokenKey: string
  /** 401 后跳转路径占位。 */
  loginPath: string
  /** 站点标题。 */
  appTitle: string
}

export const env: AppEnv = {
  apiBaseUrl: readString(import.meta.env.VITE_API_BASE_URL, '/api'),
  useMock: readBool(import.meta.env.VITE_USE_MOCK, true),
  mockLatencyMs: readInt(import.meta.env.VITE_MOCK_LATENCY_MS, 420),
  mockFailureRate: readRatio(import.meta.env.VITE_MOCK_FAILURE_RATE, 0),
  requestTimeoutMs: readInt(import.meta.env.VITE_REQUEST_TIMEOUT_MS, 15_000, 1_000),
  requestMaxRetries: readInt(import.meta.env.VITE_REQUEST_MAX_RETRIES, 2),
  authTokenKey: readString(import.meta.env.VITE_AUTH_TOKEN_KEY, 'xiangyin_token'),
  loginPath: readString(import.meta.env.VITE_LOGIN_PATH, '/login'),
  appTitle: readString(
    import.meta.env.VITE_APP_TITLE,
    '乡音有据 · 福州地方文化口述整理与共创智能体',
  ),
}

/** 当前生效的数据来源，用于顶栏提示。 */
export const dataSourceLabel = env.useMock ? '本地 Mock 数据' : '真实后端接口'

/**
 * 拼接完整接口地址。
 * @param path 接口路径或完整 URL
 * @returns 拼接后的完整地址；已是 http(s) 开头时原样返回
 */
export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = env.apiBaseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}
