/**
 * 统一 API 请求层的公共类型。
 *
 * 这里的类型是「前端请求封装 ↔ 后端接口」的协议层，与业务字段（见 src/types/api/*）
 * 分离：业务模块只描述自己的请求/响应字段，协议层负责信封、分页、错误与重试。
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/* ------------------------------------------------------------------ */
/* 分页                                                                */
/* ------------------------------------------------------------------ */

/** 分页请求参数。后端字段名待确认（TODO-API-1）。 */
export interface PageQuery {
  page?: number
  pageSize?: number
  /** 排序字段，例如 'publishedAt'。 */
  sort?: string
  order?: 'asc' | 'desc'
}

/** 分页响应体。 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/* ------------------------------------------------------------------ */
/* 错误                                                                */
/* ------------------------------------------------------------------ */

/**
 * 前端统一的接口错误码。
 * 与后端业务码是多对一关系：业务码 → 下面这些分类，由响应拦截器完成映射。
 */
export type ApiErrorCode =
  | 'network' // 网络不可达 / DNS / 断网
  | 'timeout' // 请求超时
  | 'auth' // 401 未登录或 token 失效
  | 'forbidden' // 403 无权限
  | 'notFound' // 404 资源不存在
  | 'validation' // 400/422 参数校验失败
  | 'business' // 业务规则拒绝（HTTP 200 + 业务失败码）
  | 'server' // 5xx
  | 'unavailable' // 依赖能力不可用（如 ASR 服务未部署）
  | 'cancelled' // 用户主动取消
  | 'unknown'

/* ------------------------------------------------------------------ */
/* mock 场景                                                           */
/* ------------------------------------------------------------------ */

/**
 * mock 场景开关。用于在无后端的情况下验证 7 种界面状态。
 * 通过报头右侧「开发者」开关里的 Mock 场景下拉切换，所有接口的 mock 实现都会读取它。
 */
export type MockScenario =
  | 'normal' // 成功
  | 'empty' // 空数据
  | 'failure' // 失败（可重试）
  | 'slow' // 慢响应（加载中）
  | 'unavailable' // 能力不可用（不可重试）
  | 'needsConfirm' // 需人工确认

export const MOCK_SCENARIOS: ReadonlyArray<{ value: MockScenario; label: string; hint: string }> = [
  { value: 'normal', label: '成功', hint: '返回正常数据' },
  { value: 'empty', label: '空数据', hint: '返回空列表，验证空状态' },
  { value: 'failure', label: '失败', hint: '抛可重试错误，验证重试' },
  { value: 'slow', label: '加载中', hint: '延长响应时间，验证骨架屏' },
  { value: 'unavailable', label: '不可用', hint: '抛不可重试错误' },
  { value: 'needsConfirm', label: '需人工确认', hint: '返回待确认标记' },
]

/* ------------------------------------------------------------------ */
/* 请求配置                                                            */
/* ------------------------------------------------------------------ */

/** mock 执行上下文。 */
export interface MockContext {
  scenario: MockScenario
  latencyMs: number
  /** 第几次尝试（从 1 开始），重试时会递增。 */
  attempt: number
}

/** mock 实现签名。 */
export type MockResolver<TRes> = (ctx: MockContext) => TRes | Promise<TRes>

/**
 * 一次接口调用的完整描述。
 *
 * 业务模块（src/api/*.ts）只负责填写本对象；请求方式、鉴权、超时、重试、
 * 错误归一与 mock 分流全部由 httpClient 统一处理。
 */
export interface RequestConfig<TBody, TRes> {
  /** 接口中文名，用于错误提示、加载文案与文档面板。 */
  label: string
  method: HttpMethod
  /** 路径模板，支持 `{id}` 形式的路径参数，例如 '/transcripts/{id}/segments'。 */
  url: string
  /** 路径参数。 */
  path?: Record<string, string | number>
  /** 查询参数，值为 undefined 的键会被剔除。 */
  query?: Record<string, unknown>
  /** 请求体。 */
  body?: TBody
  /** 额外请求头。 */
  headers?: Record<string, string>
  /** 单次超时覆盖。 */
  timeoutMs?: number
  /** 自动重试次数覆盖（仅对可重试错误生效）。 */
  maxRetries?: number
  /** 外部取消信号。 */
  signal?: AbortSignal
  /** mock 数据实现。VITE_USE_MOCK=true 时优先走这里。 */
  mock?: MockResolver<TRes>
  /**
   * 响应为「空数据」时的判定函数。用于把后端返回的空列表
   * 归一成界面上的空状态，而不是让组件各自判断。
   */
  isEmpty?: (data: TRes) => boolean
  /**
   * 响应字段补齐：后端字段缺失 / 命名不一致时，在此收敛为前端类型。
   * 这是应对「后端返回不确定」的主要手段（配合默认值）。
   */
  normalize?: (raw: unknown) => TRes
}

/** 请求拦截器。 */
export type RequestInterceptor = (init: {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body: unknown
}) =>
  | { url: string; method: HttpMethod; headers: Record<string, string>; body: unknown }
  | Promise<{ url: string; method: HttpMethod; headers: Record<string, string>; body: unknown }>

/** 响应拦截器。raw 为解析后的响应体。 */
export type ResponseInterceptor = (raw: unknown, config: { url: string; label: string }) => unknown
