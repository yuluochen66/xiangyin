# 前后端交接开发文档

> **读者**：后端开发人员。
> **目标**：读完本文档后，你应能在**不询问前端人员**的情况下独立完成后端开发并联调通过。
> **一致性保证**：文中「功能完整性核查」「接口明细」「数据模型」「待确认事项」四节由
> `scripts/gen-handoff-doc.mjs` 从 `src/api/endpointCatalog.ts` 与 `src/types/**` **直接生成**，
> 因此不会与前端代码脱节；其余章节为人工撰写。改接口后运行 `pnpm docs:handoff` 重新生成。

---

## 一、项目与架构总览

### 1.1 这是什么

「乡音有据」是福州地方文化口述材料的整理、标注与共创工作台。核心诉求是**把口述材料变成可溯源的证据**：
每条结论都要带判定与理由，传说与低可信来源不会被悄悄采信，发布前还有一道风险检查。

### 1.2 前端当前形态

**纯前端单页应用（SPA）**，无需后端即可完整运行——所有接口都有本地 mock 实现。
当前有 **8 个路由**、**33 个接口**、**4 个 AI 工具契约**、**6 种 mock 场景**、**178 个源文件**。

```
浏览器
  │
  ├─ 路由层   src/router/index.ts（自研 hash 路由，8 个路由，视图异步加载）
  │
  ├─ 页面层   src/views/OverviewView.vue + Flow1~Flow7（7 道流程各一页）
  │            └─ 各页私有子组件：src/components/flow2 … flow7/
  │
  ├─ 状态层   src/composables/useAsyncTask.ts  ← 8 态界面状态机（全站唯一实现）
  │            src/composables/useAppShell.ts   ← 项目信息 / 操作人 / 全局提示
  │            src/composables/useXxx*.ts       ← 各流程领域状态
  │
  ├─ 数据层（两条并行通路，见 1.4）
  │   ├─ REST：src/api/*.ts ─► src/services/api/httpClient.ts ─┬─► src/mock（VITE_USE_MOCK=true）
  │   │                                                        └─► src/services/http（真实后端）
  │   └─ 工具：src/services/toolClient.ts ────────────────────┬─► src/services/mock/mockTransport.ts
  │                                                          └─► src/services/http/httpTransport.ts
  │
  └─ 组件层   src/components/{common,review,tools,flowN}/
```

### 1.3 界面状态机（后端必须理解的一点）

需求要求每个流程区分 7 种界面状态。前端把它收敛成**一个**状态机 `TaskPhase`（`src/composables/useAsyncTask.ts`），
共 **8 个取值**——需求要求的 7 种 + 未开始：

```ts
type TaskPhase =
  | 'idle'        // 未开始（需求未要求的第 8 个状态）
  | 'loading'     // 加载中
  | 'retrying'    // 重试中（展示「第 N/M 次」）
  | 'success'     // 成功
  | 'empty'       // 空数据
  | 'error'       // 失败
  | 'confirm'     // 需人工确认
  | 'unavailable' // 不可用（重试无意义的失败）
```

**与后端的关系**：`error` / `unavailable` / `confirm` 三个状态**由后端响应推导**，不是前端随意设置的。

| 界面状态 | 前端依据什么推导 | 后端需要做什么 |
| --- | --- | --- |
| `error` | `ApiError.retryable === true`（network / timeout / server） | 返回网络类错误或 5xx |
| `unavailable` | 错误码 `unavailable`（HTTP 503） | 能力未部署时返回 503 |
| `confirm` | 响应中 `confirmStatus === 'pending'` 或 `needsHumanConfirm === true` | 返回待确认标记（见 §4.4） |
| `empty` | `RequestConfig.isEmpty(data)` 判定为真（通常 `list.length === 0`） | 正常返回空数组，**不要返回 404** |
| `retrying` | 前端自动重试时由 `RequestHooks.onRetry` 触发 | 无需配合 |

> **注意**：`RemoteTaskStatus`（`queued|running|succeeded|failed|cancelled|partial`，见 §9）是**服务端任务**状态，
> 与上面的**界面状态**是两件事。前者描述任务本身，后者描述界面该渲染什么。后端只需返回前者。

### 1.4 两条并行数据通路（**必须先定这一条**，见 §11 D-01）

前端当前同时保留了两条通往 AI 能力的路径，后端需要在联调前**二选一**：

| 通路 | 前端位置 | 调用方式 | 适用形态 |
| --- | --- | --- | --- |
| **A. REST 端点** | `src/api/*.ts`（33 个） | 各流程页直接调用，如 `transcribeApi.start()` | 传统 BFF / 网关 |
| **B. 四工具契约** | `src/services/toolClient.ts` | 流程 4~7 内嵌的「AI 工具调用」面板 | Agent / 工具编排平台 |

**现状**：两条路都在跑（都走 mock）。业务流程以 **A** 为主；**B** 是给工具化后端预留的，前端代码里标记为 `TODO-ARCH-1`。
**若后端只实现一条，请明确告知，前端会移除另一条**——不会要求两类都做。

---

## 二、前端技术栈与目录结构

### 2.1 技术栈

| 项 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3.5（`<script setup lang="ts">`） | 运行时依赖**只有 vue** |
| 语言 | TypeScript 5.8 strict | `noUnusedLocals` / `noImplicitOverride` / `verbatimModuleSyntax` 全开 |
| 构建 | Vite 6 | 开发端口 **5174** |
| 样式 | Tailwind CSS v4 | 设计令牌集中在 `src/style.css` 的 `@theme` |
| 路由 | **自研** hash 路由（约 40 行） | 未用 vue-router；深链必须带 `#` |
| 状态 | Composables（模块级单例） | 未用 pinia |
| HTTP | **自研** `request()` 封装 | 未用 axios |
| 代码规范 | ESLint 9（扁平配置）+ Prettier 3 | `pnpm lint` / `pnpm format:check` |
| 测试 | 无单元测试框架；有接口层冒烟脚本 | `pnpm smoke`（56 项断言，全绿） |

### 2.2 目录结构（只看后端需要关心的）

```
src/
├─ api/                    ★ 接口定义层：每个模块一个文件，接口的「唯一真相」
│  ├─ upload.ts            流程 1（6 个 HTTP 端点）
│  ├─ transcribe.ts        流程 2（6 个 HTTP 端点）
│  ├─ extract.ts           流程 3（6 个 HTTP 端点）
│  ├─ search.ts            流程 4（2 个 HTTP 端点）
│  ├─ compare.ts           流程 5（3 个 HTTP 端点）
│  ├─ generate.ts          流程 6（4 个 HTTP 端点）
│  ├─ publish.ts           流程 7（6 个 HTTP 端点，含状态机 TRANSITIONS）
│  │                       （各模块还含纯前端的本地函数，如 computeStats / applyParams，
│  │                        它们不发请求，因此不计入端点）
│  └─ endpointCatalog.ts   ★ 接口衔接点目录：字段表 + 待确认项（本文档数据源）
├─ types/
│  ├─ api/*.ts             ★ 每个模块的请求/响应字段类型（= 前端对后端的假设）
│  ├─ domain.ts            领域模型（Claim / SourceTag / StoryCard …）
│  └─ tools.ts             ★ 四个工具的入参/出参契约
├─ services/
│  ├─ api/httpClient.ts    ★ 请求封装：信封解包 / 超时 / 重试 / 拦截器 / 错误归一
│  ├─ api/errors.ts        ApiError + HTTP 状态码 → 错误码映射
│  ├─ api/auth.ts          token 存取 / Bearer 注入 / 401 广播（**占位实现**）
│  ├─ toolClient.ts        四工具的类型化门面
│  ├─ transport.ts         transport 抽象（mock / http 可替换）
│  ├─ mock/                工具层 mock 实现
│  └─ http/                工具层真实 HTTP 实现（字段映射待后端确认）
├─ mock/                   ★ mock 数据层（后端就绪后可整体删除）
│  ├─ dataset.ts           福州地方文化演示数据
│  ├─ store.ts             可变状态（编辑后真的会变，刷新回初始值）
│  ├─ scenario.ts          6 种 mock 场景开关
│  └─ helpers.ts           场景判定与工具函数
├─ config/env.ts           ★ 环境变量集中出口（唯一允许读 import.meta.env 的文件）
├─ composables/            状态逻辑（useAsyncTask 是核心）
├─ components/             组件（common 通用 / review / tools / flowN 各流程私有）
└─ views/                  8 个页面
```

---

## 三、环境配置与启动

### 3.1 环境变量（全部由 `src/config/env.ts` 集中读取）

| 变量名 | 默认值 | 前端用途 | 后端是否相关 |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | 接口基址。留空或用相对路径时走同源代理 | ★ 需确认部署形态 |
| `VITE_USE_MOCK` | `true` | **true = 全部接口走本地 mock**；false = 走真实 HTTP | ★ 联调时置 false |
| `VITE_MOCK_LATENCY_MS` | `420` | mock 模拟延迟基准，用于验证加载态 | 否（仅 mock） |
| `VITE_MOCK_FAILURE_RATE` | `0` | mock 随机失败率 0~1 | 否（仅 mock） |
| `VITE_REQUEST_TIMEOUT_MS` | `15000` | 单次请求超时（毫秒） | ★ 按后端 SLA 调整 |
| `VITE_REQUEST_MAX_RETRIES` | `2` | 自动重试次数（**仅** network/timeout/server 会重试） | ★ 需确认幂等性 |
| `VITE_AUTH_TOKEN_KEY` | `xiangyin_token` | token 在 localStorage 的键名 | 否 |
| `VITE_LOGIN_PATH` | `/login` | 401 后跳转路径**占位** | ★ 需确认登录方案 |
| `VITE_APP_TITLE` | 乡音有据 · … | 站点标题 | 否 |

完整示例见 `.env.example`。

> ⚠️ **关于自动重试**：默认重试 2 次，退避 300ms / 900ms（封顶 4s），仅对 network / timeout / server 生效。
> 若某些 `POST` 接口**不幂等**，请告知，前端会为这些接口单独设 `maxRetries: 0`。

### 3.2 启动方式

```bash
pnpm install
pnpm dev            # http://localhost:5174（默认 mock 模式，无需后端）
```

接真实后端：复制 `.env.example` 为 `.env.local`，设置

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8080    # 或 /api 走同源代理
```

### 3.3 全部命令

```bash
pnpm typecheck      # vue-tsc 全量类型检查
pnpm lint           # ESLint（含 JSDoc 完整性）
pnpm build          # 类型检查 + 生产构建
pnpm smoke          # 接口层端到端冒烟（56 项断言，真实执行 src/api/*）
pnpm docs:api       # 由 endpointCatalog 生成 docs/API-CONTRACT.md
pnpm docs:handoff   # 由 endpointCatalog + types 生成本文档的生成章节
```

**联调建议**：每接好一个接口就跑一次 `pnpm smoke`（它跑 mock，但能证明前端调用路径没被改坏）。

---

## 四、协议层约定（后端必须遵守）

> 本节的每一条都对应前端代码里的实际实现；前端已按这些约定写好兼容层，后端按此实现即可零改动联调。

### 4.1 响应信封

前端在 `src/services/api/httpClient.ts` 的 `unwrapEnvelope()` 中解包，兼容字段名如下（**字段名待确认，见 D-02**）：

```ts
interface Envelope<T> {
  code?: string | number      // 业务码
  success?: boolean           // 成功标记
  message?: string            // 错误文案（message 与 msg 任一）
  msg?: string
  data?: T                    // 业务数据
  traceId?: string            // 链路 id（traceId 与 requestId 任一）
  requestId?: string
}
```

**成功判定**：`code` 为 `0` / `200` / `'OK'` / `'SUCCESS'`，**或** `code` 缺省（直接返回裸数据也支持）。
**失败**：抛 `ApiError`，`businessCode` 原样保留供排查。`traceId` 会被记录，报错时会一并带上——**请务必返回它**，否则线上问题无法定位。

### 4.2 分页

```ts
interface PageQuery  { page?: number; pageSize?: number; sort?: string; order?: 'asc' | 'desc' }
interface PageResult<T> { list: T[]; total: number; page: number; pageSize: number; hasMore: boolean }
```

- 前端**已实现**追加式「加载更多」（流程 4，`useSearchPagination.ts`），依据 `hasMore` 决定是否显示按钮；
- `page` 从 **1** 开始；`total` 是**过滤后的总数**（流程 4 的结果统计条直接展示它）；
- **字段名待确认（D-03）**。若后端用 `records`/`size`/`current` 这类命名，请告知，前端在 `normalize()` 里一次性收敛。

### 4.3 鉴权（当前为占位实现）

| 项 | 前端现状 | 后端需确认 |
| --- | --- | --- |
| token 存储 | `localStorage`，键名 `VITE_AUTH_TOKEN_KEY`（默认 `xiangyin_token`） | 是否改用 httpOnly Cookie？（会改为后端下发） |
| 会话结构 | `{ token, operator: { id, name, role }, expiresAt? }`，JSON 字符串 | 字段是否一致 |
| 注入方式 | `Authorization: Bearer <token>`（`buildAuthHeaders()`） | 是否为 Bearer |
| 401 处理 | 错误码 `auth` → `needsLogin = true` → 广播 `onAuthExpired` 回调，跳转 `VITE_LOGIN_PATH` | 登录页路径 |
| 登录接口 | **不存在**。`signInDemo()` 写入演示 token（报头「开发者」开关内） | 需定义：登录 / 登出 / 刷新 / 当前用户 |

**没有实现的部分**：真实登录页、token 刷新、权限判定。`OperatorInfo.role` 是普通字符串，前端**不做**权限校验——所有按钮可见性由**业务状态**决定，不由角色决定。若需要 RBAC，请明确提出。

### 4.4 人工确认与版本冲突（`confirm` 态的判定来源）

两条判定路径，任一成立即进入 `confirm` 态：

1. 响应里的 `AiMeta.needsHumanConfirm === true`（所有 AI 接口都应返回 `AiMeta`，见 §8）；
2. 响应的 `confirmStatus === 'pending'`（`ConfirmStatus`：`not_required | pending | confirmed | rejected`）。

**版本冲突（乐观锁）**：流程 7 提交状态流转时带 `expectedFrom`（期望的当前状态）。
后端应在状态已变时**拒绝**并返回可识别错误，前端目前按「拒绝 + 提示刷新」处理（`TODO-CONFLICT-1`，`endpointCatalog.ts`）。
若后端采用「自动合并」，请告知，前端需要改交互。

### 4.5 错误码与 HTTP 状态码映射

前端把任意异常收敛为 `ApiError`，共 **11 个错误码**。映射规则（`statusToErrorCode()`，`src/services/api/errors.ts`）：

| HTTP 状态码 | 前端错误码 | 是否自动重试 | 是否跳登录 | 默认中文文案 |
| --- | --- | --- | --- | --- |
| （网络不可达 / DNS / 断网） | `network` | ✅ | — | 网络连接失败，请检查网络后重试。 |
| 408 / 504 / 前端超时 | `timeout` | ✅ | — | 请求超时，服务响应过慢，请稍后重试。 |
| 401 | `auth` | — | ✅ | 登录状态已失效，请重新登录。 |
| 403 | `forbidden` | — | — | 当前账号没有该操作的权限。 |
| 404 | `notFound` | — | — | 请求的资源不存在或已被删除。 |
| 400 / 422 | `validation` | — | — | 提交的参数不合法，请检查后重试。 |
| **200 + 业务失败码** | `business` | — | — | 业务规则拒绝了本次操作。 |
| 5xx（除 503） | `server` | ✅ | — | 服务端处理失败，请稍后重试。 |
| 503 | `unavailable` | — | — | 该能力当前不可用，请联系管理员或稍后再试。 |
| 499 | `cancelled` | — | — | 请求已取消。 |
| 其他 | `unknown` | — | — | 发生未知错误。 |

**422 字段级校验错误**：前端期望

```ts
interface FieldIssue { field: string; message: string }
```

用于在对应输入框下就地提示（`TODO-API-3` 待确认结构，是数组还是 `{ field: message }` 映射）。

### 4.6 超时与重试

| 项 | 默认 | 可覆盖位置 |
| --- | --- | --- |
| 单次超时 | `VITE_REQUEST_TIMEOUT_MS` = 15000ms（下限 1000） | 每个接口的 `timeoutMs` |
| 自动重试次数 | `VITE_REQUEST_MAX_RETRIES` = 2 | 每个接口的 `maxRetries` |
| 退避 | 300 → 900 → 1800ms…封顶 4000ms | 固定 |
| 重试范围 | **仅** `network` / `timeout` / `server` | 固定 |

长耗时接口（ASR 转写、长文生成）**不要**靠长超时，请改造成异步任务 + 轮询/推送（见 D-05）。
前端支持 `AbortSignal` 取消（用户切页或点取消时触发），取消会变成 `cancelled` 码，**不计入失败统计**。

---

## 五、前端功能完整性核查

### 5.0 客观覆盖情况（自动生成）

<!-- BEGIN GENERATED: features -->

| 流程 | 视图文件 | 行数 | 私有子组件 | 端点数 | 端点 id |
| --- | --- | --- | --- | --- | --- |
| 1 | `Flow1UploadView.vue` | 996 | 0 | 6 | `upload.init`、`upload.chunk`、`upload.status`、`upload.complete`、`upload.license`、`upload.list` |
| 2 | `Flow2TranscribeView.vue` | 449 | 15 | 6 | `transcribe.start`、`transcribe.get`、`transcribe.suggestions`、`transcribe.corrections`、`transcribe.versions`、`transcribe.rollback` |
| 3 | `Flow3ExtractView.vue` | 448 | 14 | 6 | `extract.start`、`extract.get`、`extract.upsert`、`extract.delete`、`extract.merge`、`extract.batchConfirm` |
| 4 | `Flow4SearchView.vue` | 429 | 11 | 2 | `search.sources`、`search.detail` |
| 5 | `Flow5CompareView.vue` | 439 | 10 | 3 | `compare.start`、`compare.annotations`、`compare.rejudge` |
| 6 | `Flow6GenerateView.vue` | 404 | 9 | 4 | `generate.create`、`generate.regenerate`、`generate.save`、`generate.get` |
| 7 | `Flow7PublishView.vue` | 105 | 8 | 6 | `publish.transition`、`publish.riskCheck`、`publish.reviewComment`、`publish.publish`、`publish.versions`、`publish.rollback` |

合计 **33 个端点**（含概览页无端点）。


<!-- END GENERATED: features -->

### 5.1 已实现（可完整交互，均有 mock 数据）

| # | 功能 | 页面 / 路由 | 实现位置 |
| --- | --- | --- | --- |
| 0 | 项目概览：七道流程说明、AI 介入点、状态说明、使用说明 | `/` | `views/OverviewView.vue` |
| 1 | 采访上传：信息表单、文件校验、分片进度、授权确认、采访记录列表 | `/#/upload` | `views/Flow1UploadView.vue`（996 行，**未拆分**） |
| 2 | 转写与人工校正：音频播放、**音频↔文本联动**、逐段编辑、AI 校正建议（采纳/忽略/恢复/试听）、版本回滚 | `/#/transcribe` | `views/Flow2TranscribeView.vue` + `components/flow2/`（15）+ 5 composable |
| 3 | 提取地点人物事件：实体卡片、三档筛选、增删改、同义项合并、原文溯源跳转、批量确认 | `/#/extract` | `views/Flow3ExtractView.vue` + `components/flow3/`（14）+ 9 composable |
| 4 | 检索地方资料：条件组合、分面筛选、**AI 扩展词**、可信度分级、低可信人工确认、加载更多分页、资料详情侧栏、关联线索 | `/#/search` | `views/Flow4SearchView.vue` + `components/flow4/`（11）+ 7 composable |
| 5 | 标注一致与差异：左右对照、AI 初判+理由、人工判定（**差异必填原因**）、实时统计、增量保存/整批提交、单条重判 | `/#/compare` | `views/Flow5CompareView.vue` + `components/flow5/`（10）+ 7 composable |
| 6 | 生成故事卡 / 讲稿：参数、纳入范围勾选、草稿区块编辑、引用角标、风险提示、保存草稿、进入流程 7 | `/#/generate` | `views/Flow6GenerateView.vue` + `components/flow6/`（9）+ 5 composable |
| 7 | 审核发布：状态机流转（含乐观锁）、审核意见、风险逐条确认、版本回滚、发布三项确认 | `/#/publish` | `views/Flow7PublishView.vue` + `components/flow7/`（8）+ 6 composable |
| — | 8 态界面状态机（需求要求 7 种 + idle），全站唯一 loading 来源 | 所有页面 | `composables/useAsyncTask.ts` + `components/common/AsyncStateBoundary.vue` |
| — | 统一请求层：信封解包 / 超时 / 退避重试 / 拦截器 / 错误归一 / mock 分流 / 空数据判定 | — | `services/api/httpClient.ts` |
| — | 6 种 mock 场景切换（成功/空/失败/慢/不可用/需确认） | 报头「开发者」开关 | `mock/scenario.ts` + `mock/helpers.ts` |
| — | 四工具契约层 + 调用面板（流程 4~7 内嵌） | 流程 4~7 | `types/tools.ts` + `services/toolClient.ts` + `components/tools/ToolInvokePanel.vue` |
| — | 接口衔接点目录：33 个端点的字段表 + 28 项待确认 | 报头「开发者」开关 | `api/endpointCatalog.ts` + `components/common/ApiContractPanel.vue` |
| — | 鉴权占位：token 存取 / Bearer 注入 / 401 广播 | 报头「开发者」开关 | `services/api/auth.ts` + `composables/useAppShell.ts` |

### 5.2 部分实现（有界面与前端逻辑，但依赖后端定协议）

| 功能 | 已有什么 | 缺什么 | 影响范围 | 是否后端开发的前置依赖 |
| --- | --- | --- | --- | --- |
| **真实文件上传** | 表单、大小/格式校验、分片循环、进度条、剩余时间、失败重试入口 | **真实字节传输**。前端 `uploadChunk()` 只发 `{ chunkIndex, totalChunks }`；全库**无** `FormData` / `Blob` / `file.slice` | 流程 1 无法真正上传音频 | ✅ **是**，且需先定协议（D-04） |
| **断点重传** | `resumeUpload()`、失败分片缓存、会话复用 | 依赖后端返回 `failedChunks: number[]`；且真正重传仍需上面的字节传输 | 流程 1 | ✅ 是 |
| **上传进度** | 前端本地模拟进度 | 服务端进度获取方式（轮询 / SSE / WebSocket）未定 | 流程 1 | ✅ 是（D-05） |
| **转写任务进度** | 异步任务 id 已预留（`taskId`） | 轮询还是 SSE 未定，间隔与最大时长待定（`TODO-ASR-1`） | 流程 2 | ✅ 是（D-05） |
| **长文生成** | 同步请求已实现 | 长文可能超时，是否改异步任务未定（`TODO-GEN-1`） | 流程 6 | ✅ 是 |
| **鉴权** | token 存取、Bearer 注入、401 广播、演示 token | 登录/登出/刷新接口、真实登录页、token 形态 | 全站 | ✅ 是（D-06） |
| **分页** | 流程 4 追加式加载更多已实现 | 分页字段名待确认（`TODO-API-1`） | 流程 4（其他流程为全量列表） | ✅ 是（D-03） |
| **字段级错误提示** | 组件支持就地展示 | 422 错误体结构待确认（`TODO-API-3`） | 全站表单 | ✅ 是（D-02） |
| **工具层 HTTP 实现** | 接口与类型齐备 | `services/http/httpTransport.ts` 的 DTO 字段映射待后端确认 | 流程 4~7 工具面板 | ✅ 是（D-01） |

### 5.3 未实现 / 不在前端范围

| 项 | 状态 | 说明 | 谁来做 |
| --- | --- | --- | --- |
| ASR 转写 / NER 抽取 / 一致性比对 / 文本生成 | 未实现 | 前端只有契约与 mock | **后端 / AI 服务** |
| 全文检索索引与相关度排序 | 未实现 | 前端只管发条件、渲染结果 | **后端** |
| 权限模型（RBAC） | 未实现 | `role` 只是展示用字符串，前端不做鉴权 | 需产品先明确，见 §11 D-07 |
| 多人协作 / 实时协同 | 未实现 | 无 WebSocket、无在线状态、无并发编辑冲突处理（仅流程 7 有乐观锁） | 需产品明确 |
| 音频录制 | 未实现 | 只能选择已有音频文件 | 需产品明确是否为必需 |
| 导入 / 导出（含讲稿导出） | 未实现 | 全库无下载实现；若需求要求导出讲稿/故事卡，请明确提出 | 需产品明确 |
| 单元测试 / E2E | 未实现 | 仅有接口层冒烟（56 项断言） | 前端后续 |

## 六、待后端实现的功能清单

### 6.0 P0 —— 阻塞项（不先定这些，联调无法开始）

| # | 事项 | 为什么阻塞 | 关联 |
| --- | --- | --- | --- |
| 1 | **通路 A / B 二选一** | 决定要落 33 个 REST 端点还是 4 个工具契约（见 §1.4） | D-01 |
| 2 | **响应信封字段名** | 决定解包层能否零改动；裸数据 / `code+data` / `success+data` 都要明确 | D-02 |
| 3 | **错误体结构**（含 422 字段级） | 决定错误提示与表单就地提示 | D-02 |
| 4 | **分页字段名与起始页码** | 流程 4 的加载更多与结果统计 | D-03 |
| 5 | **上传协议**：预签名直传 or 后端转发；分片字节如何传 | 流程 1 目前**无法真正上传**（只发下标） | D-04 |
| 6 | **任务进度获取方式**：轮询 or SSE | ASR 转写、长文生成的进度与完成判定 | D-05 |
| 7 | **鉴权方案**：登录/登出/刷新接口、token 形态 | 全站请求头与 401 处理 | D-06 |
| 8 | **非幂等接口清单** | 默认自动重试 2 次，非幂等接口会重复提交 | D-08 |

### 6.1 P1 —— 33 个端点的实现

按流程顺序实现即可，字段以 §7 为准。建议顺序：

`流程1 上传（6）→ 流程2 转写（6）→ 流程3 提取（6）→ 流程4 检索（2）→ 流程5 比对（3）→ 流程6 生成（4）→ 流程7 发布（6）`

每个流程联通后，前端只需把 `VITE_USE_MOCK` 置 false 即可切到真实后端，无需改代码。

### 6.2 P2 —— 需求确认后再定

权限模型（RBAC）、多人协作/实时协同、音频录制、导入导出。这些**当前前端未实现**，见 §5.3。

---

## 七、接口明细（自动生成，与代码一致）

> 数据源：`src/api/endpointCatalog.ts`。**这些字段是「前端对后端的假设」**，不是后端已实现的契约——
> 请逐条核对；不一致处以你我的书面确认为准，并回写目录后重新生成本文档。

<!-- BEGIN GENERATED: endpoints -->

### 流程 1（6 个端点）

| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |
| --- | --- | --- | --- | --- | --- |
| `upload.init` | 初始化上传 | `POST` | `/interviews/uploads:init` | `UploadInitRequest` | `UploadInitResponse` |
| `upload.chunk` | 上传分片 | `POST` | `/interviews/uploads/{uploadId}/chunks` | `ChunkUploadRequest` | `ChunkUploadResponse` |
| `upload.status` | 查询上传状态 | `GET` | `/interviews/uploads/{uploadId}` | — | `UploadStatusResponse` |
| `upload.complete` | 合并分片 | `POST` | `/interviews/uploads/{uploadId}:complete` | — | `UploadCompleteResponse` |
| `upload.license` | 提交授权确认 | `POST` | `/interviews/{interviewId}/license` | `LicenseConfirmRequest` | `LicenseConfirmResponse` |
| `upload.list` | 采访列表 | `GET` | `/interviews` | — | `InterviewListResponse` |

#### `upload.init · 初始化上传`

**接口**：`POST /interviews/uploads:init`

- 前端调用位置：`src/api/upload.ts · uploadApi.init`
- mock 实现位置：`src/api/upload.ts（内联 mock）+ src/mock/dataset.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 必填 | 采访标题 | — |
| `narrator` | `string` | 必填 | 讲述人姓名 | — |
| `interviewer` | `string` | 必填 | 采访人姓名 | — |
| `fileName` | `string` | 必填 | 原始文件名，用于重复检测 | — |
| `sizeBytes` | `number` | 必填 | 文件大小（字节），前端先做上限校验 | — |
| `mimeType` | `string` | 必填 | audio/mpeg 等 | — |
| `durationMs` | `number` | 可选 | 前端预读时长；浏览器不支持时为 undefined | undefined |
| `checksum` | `string` | 可选 | 内容指纹（sha256 前 16 位），用于判定重复 | undefined |
| `recordedAt` | `string` | 必填 | ISO 8601 采录日期 | — |
| `recordedPlace` | `string` | 必填 | 采录地点 | — |
| `dialect` | `string` | 可选 | 方言/语言，如「闽东语·福州话」 | undefined |
| `projectId` | `string` | 可选 | 项目归属 | 当前项目 id |
| `licenseType` | `LicenseType` | 必填 | 授权类型声明：public / research_only / internal / limited_time | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `uploadId` | `string` | 必填 | 上传会话 id | — |
| `interviewId` | `string` | 必填 | 预分配的采访记录 id | — |
| `chunkSizeBytes` | `number` | 必填 | 后端下发分片大小 | 前端默认 4MiB |
| `totalChunks` | `number` | 必填 | 总分片数 | — |
| `chunkUrls` | `string[]` | 可选 | 预签名直传地址；为空表示走后端转发 | — |
| `expiresAt` | `string` | 必填 | 上传会话过期时间（ISO 8601） | — |
| `duplicate` | `DuplicateHit | null` | 必填 | 重复文件命中；无重复时为 null | — |
| `constraints` | `UploadConstraints` | 必填 | 后端下发的格式与大小白名单 | — |

**待确认**

- TODO-UP-2：分片是直传（预签名 URL）还是后端转发，直接影响前端进度计算方式。
- TODO-UP-1：允许格式白名单最终以哪份清单为准（当前为 mp3/wav/m4a/aac/flac/ogg）。
- 重复判定依据是文件名、指纹还是两者结合？

#### `upload.chunk · 上传分片`

**接口**：`POST /interviews/uploads/{uploadId}/chunks`

- 前端调用位置：`src/api/upload.ts · uploadApi.uploadChunk`
- mock 实现位置：`src/api/upload.ts（内联 mock）`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `uploadId` | `string` | 必填 | 上传会话 id（路径参数） | — |
| `chunkIndex` | `number` | 必填 | 分片下标，从 0 开始 | — |
| `totalChunks` | `number` | 必填 | 总分片数 | — |
| `checksum` | `string` | 可选 | 分片校验和 | — |
| `blob` | `Blob` | 必填 | 分片二进制（multipart/form-data 或直传 body） | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `received` | `number` | 必填 | 累计已接收分片数 | — |
| `progress` | `number` | 必填 | 0~1 总进度 | — |
| `uploadedBytes` | `number` | 必填 | 已上传字节数 | — |
| `remainingMs` | `number | null` | 必填 | 预估剩余时间，无法估算为 null | — |

**待确认**

- 分片失败时后端返回什么错误结构？前端需要据此做单分片重传。

#### `upload.status · 查询上传状态`

**接口**：`GET /interviews/uploads/{uploadId}`

- 前端调用位置：`src/api/upload.ts · uploadApi.getStatus`
- mock 实现位置：`src/api/upload.ts（内联 mock）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `status` | `RemoteTaskStatus | 'merging'` | 必填 | 上传/合并状态 | — |
| `progress` | `number` | 必填 | 0~1 | — |
| `failedChunks` | `number[]` | 必填 | 失败分片下标，前端据此断点续传 | — |
| `message` | `string` | 可选 | 失败原因 | — |

**待确认**

- 是否需要服务端主动推送（SSE/WebSocket）替代轮询？轮询间隔待定。

#### `upload.complete · 合并分片`

**接口**：`POST /interviews/uploads/{uploadId}:complete`

- 前端调用位置：`src/api/upload.ts · uploadApi.complete`
- mock 实现位置：`src/api/upload.ts（内联 mock）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `interviewId` | `string` | 必填 | 正式采访记录 id | — |
| `audioUrl` | `string` | 必填 | 可播放地址（需支持 Range 请求） | — |
| `durationMs` | `number` | 必填 | 服务端解析出的时长 | — |
| `licenseStatus` | `LicenseStatus` | 必填 | 授权状态，合并后初始为 pending | — |

#### `upload.license · 提交授权确认`

**接口**：`POST /interviews/{interviewId}/license`

- 前端调用位置：`src/api/upload.ts · uploadApi.confirmLicense`
- mock 实现位置：`src/api/upload.ts（内联 mock）`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `decision` | `'confirmed' | 'rejected'` | 必填 | 授权结论 | — |
| `licenseType` | `LicenseType` | 必填 | 最终授权类型，可与上传时声明不同 | — |
| `signer` | `string` | 必填 | 授权人（讲述人或代理人） | — |
| `signedAt` | `string` | 必填 | ISO 8601 签署时间 | — |
| `attachments` | `string[]` | 可选 | 授权书扫描件地址 | — |
| `operator` | `OperatorInfo` | 必填 | 录入人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `licenseStatus` | `LicenseStatus` | 必填 | 确认后的授权状态 | — |
| `certificateNo` | `string` | 可选 | 授权凭证编号 | — |
| `confirmedAt` | `string` | 可选 | 确认时间 | — |

**待确认**

- TODO-AUTH-4：授权书文件是否走同一套上传会话？

#### `upload.list · 采访列表`

**接口**：`GET /interviews`

- 前端调用位置：`src/api/upload.ts · uploadApi.listInterviews`
- mock 实现位置：`src/api/upload.ts（内联 mock）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `list` | `InterviewSummary[]` | 必填 | 采访记录列表 | — |
| `list[].stage` | `number` | 必填 | 已推进到的流程编号 1~7，用于概览页进度展示 | — |
| `total` | `number` | 必填 | 总数 | — |

**待确认**

- 是否需要服务端分页与筛选（按讲述人 / 授权状态 / 流程阶段）？

### 流程 2（6 个端点）

| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |
| --- | --- | --- | --- | --- | --- |
| `transcribe.start` | 发起转写 | `POST` | `/transcripts:start` | `StartTranscribeRequest` | `StartTranscribeResponse` |
| `transcribe.get` | 拉取转写结果 | `GET` | `/transcripts/{transcriptId}` | — | `GetTranscriptResponse` |
| `transcribe.suggestions` | 获取校正建议 | `POST` | `/transcripts/{transcriptId}/suggestions` | — | `SuggestCorrectionsResponse` |
| `transcribe.corrections` | 保存校正 | `POST` | `/transcripts/{transcriptId}/corrections` | `SubmitCorrectionRequest` | `SubmitCorrectionResponse` |
| `transcribe.versions` | 版本列表 | `GET` | `/transcripts/{transcriptId}/versions` | — | `TranscriptVersionListResponse` |
| `transcribe.rollback` | 回滚版本 | `POST` | `/transcripts/{transcriptId}/rollback` | `RollbackTranscriptRequest` | `RollbackTranscriptResponse` |

#### `transcribe.start · 发起转写`

**接口**：`POST /transcripts:start`

- 前端调用位置：`src/api/transcribe.ts · transcribeApi.start`
- mock 实现位置：`src/api/transcribe.ts（内联 mock）`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `interviewId` | `string` | 必填 | 采访记录 id | — |
| `language` | `string` | 必填 | BCP 47，如 zh-CN | — |
| `enableDiarization` | `boolean` | 必填 | 是否启用说话人分离 | true |
| `vocabularyHints` | `string[]` | 可选 | 领域词表，提升方言与专名识别率 | — |
| `modelHint` | `'fast' | 'balanced' | 'accurate'` | 可选 | 模型档位 | balanced |
| `operator` | `OperatorInfo` | 必填 | 发起人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | 必填 | 异步任务 id，用于轮询 | — |
| `transcriptId` | `string` | 必填 | 转写稿 id | — |
| `status` | `'queued' | 'running'` | 必填 | 任务初始状态 | — |
| `estimatedMs` | `number` | 必填 | 预估耗时，用于进度文案 | — |
| `aiMeta` | `AiMeta` | 必填 | 模型版本、置信度、是否需人工确认 | — |

**待确认**

- TODO-ASR-1：任务是轮询还是支持 SSE 推送？轮询间隔与最大时长待定。

#### `transcribe.get · 拉取转写结果`

**接口**：`GET /transcripts/{transcriptId}`

- 前端调用位置：`src/api/transcribe.ts · transcribeApi.getTranscript`
- mock 实现位置：`src/api/transcribe.ts（内联 mock）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `segments` | `TranscriptSegmentDTO[]` | 必填 | 时间轴片段，音频文本联动的数据基础 | — |
| `segments[].confidence` | `number` | 必填 | 0~1 置信度 | — |
| `segments[].lowConfidence` | `boolean` | 必填 | 是否低于阈值（后端按阈值判定） | — |
| `segments[].originalText` | `string` | 必填 | AI 原始文本，用于版本对比 | — |
| `paragraphs` | `TranscriptParagraphDTO[]` | 必填 | 段落视图数据 | — |
| `lowConfidenceThreshold` | `number` | 必填 | 阈值，后端下发以保证前后端判定一致 | 0.72 |
| `version` | `VersionRef` | 必填 | 当前版本 | — |
| `failureReason` | `string` | 可选 | 失败原因 | — |

**待确认**

- TODO-ASR-2：低置信度是后端标记还是前端按阈值计算？当前约定后端标记、前端只展示。
- 词级时间戳（words）是否一定返回？决定文本高亮粒度。

#### `transcribe.suggestions · 获取校正建议`

**接口**：`POST /transcripts/{transcriptId}/suggestions`

- 前端调用位置：`src/api/transcribe.ts · transcribeApi.suggestCorrections`
- mock 实现位置：`src/api/transcribe.ts（GLOSSARY 词表）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `suggestions` | `CorrectionSuggestion[]` | 必填 | 逐段建议，含建议文本、类别与理由 | — |
| `suggestions[].category` | `'typo' | 'dialect' | 'proper_noun' | 'segmentation' | 'other'` | 必填 | 建议类型，用于分组展示 | — |
| `glossaryVersion` | `string` | 必填 | 词表版本，便于追溯建议来源 | — |
| `aiMeta` | `AiMeta` | 必填 | 模型信息 | — |

**待确认**

- 词表由后端维护还是前端配置？当前 mock 在前端。

#### `transcribe.corrections · 保存校正`

**接口**：`POST /transcripts/{transcriptId}/corrections`

- 前端调用位置：`src/api/transcribe.ts · transcribeApi.submitCorrections`
- mock 实现位置：`src/api/transcribe.ts（内联 mock）`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `baseVersionId` | `string` | 必填 | 乐观锁：基于哪个版本修改 | — |
| `editor` | `OperatorInfo` | 必填 | 修改人，用于「记录修改人与时间」 | — |
| `corrections` | `SegmentCorrection[]` | 必填 | 本次提交的逐段校正 | — |
| `corrections[].segmentId` | `string` | 必填 | 片段 id | — |
| `corrections[].text` | `string` | 必填 | 校正后文本 | — |
| `corrections[].fromAiSuggestion` | `boolean` | 可选 | 是否采纳了 AI 建议 | false |
| `saveAsDraft` | `boolean` | 必填 | true 只存草稿不生成版本 | false |
| `note` | `string` | 可选 | 变更说明 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `versionId` | `string` | 必填 | 新版本 id | — |
| `changedCount` | `number` | 必填 | 本次改动条数 | — |
| `lowConfidenceRemaining` | `number` | 必填 | 剩余低置信度片段数 | — |
| `conflict` | `object | null` | 必填 | 乐观锁冲突信息；无冲突为 null | — |

**待确认**

- TODO-CONFLICT-1：版本冲突时后端是自动合并还是直接拒绝？前端目前按「拒绝并提示刷新」处理。

#### `transcribe.versions · 版本列表`

**接口**：`GET /transcripts/{transcriptId}/versions`

- 前端调用位置：`src/api/transcribe.ts · transcribeApi.listVersions`
- mock 实现位置：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `versions` | `TranscriptVersionRecord[]` | 必填 | 版本列表，倒序 | — |
| `versions[].source` | `'ai' | 'human' | 'rollback'` | 必填 | 版本来源，用于界面区分 | — |
| `currentVersionId` | `string` | 必填 | 当前版本 id | — |

#### `transcribe.rollback · 回滚版本`

**接口**：`POST /transcripts/{transcriptId}/rollback`

- 前端调用位置：`src/api/transcribe.ts · transcribeApi.rollback`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `targetVersionId` | `string` | 必填 | 回滚目标版本 | — |
| `operator` | `OperatorInfo` | 必填 | 操作人 | — |
| `note` | `string` | 可选 | 回滚原因 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `currentVersionId` | `string` | 必填 | 回滚后生成的新版本 id | — |
| `segments` | `TranscriptSegmentDTO[]` | 必填 | 回滚后的完整片段，前端据此整体替换 | — |

**待确认**

- 回滚是「恢复到旧内容并新建版本」还是「删除中间版本」？当前按前者实现。

### 流程 3（6 个端点）

| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |
| --- | --- | --- | --- | --- | --- |
| `extract.start` | 发起信息抽取 | `POST` | `/extractions:start` | `StartExtractionRequest` | `StartExtractionResponse` |
| `extract.get` | 拉取抽取结果 | `GET` | `/extractions/{extractionId}` | — | `GetExtractionResponse` |
| `extract.upsert` | 新增 / 更新实体 | `POST` | `/extractions/{extractionId}/entities` | `UpsertEntityRequest` | `UpsertEntityResponse` |
| `extract.delete` | 删除实体 | `DELETE` | `/extractions/{extractionId}/entities/{entityId}` | `DeleteEntityRequest` | `{ deletedId, pendingConfirmCount }` |
| `extract.merge` | 合并同义项 | `POST` | `/extractions/{extractionId}/entities:merge` | `MergeEntitiesRequest` | `MergeEntitiesResponse` |
| `extract.batchConfirm` | 批量确认 | `POST` | `/extractions/{extractionId}/entities:batchConfirm` | `BatchConfirmRequest` | `BatchConfirmResponse` |

#### `extract.start · 发起信息抽取`

**接口**：`POST /extractions:start`

- 前端调用位置：`src/api/extract.ts · extractApi.start`
- mock 实现位置：`src/api/extract.ts（内联 mock）`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `interviewId` | `string` | 必填 | 采访记录 id | — |
| `transcriptId` | `string` | 必填 | 转写稿 id（抽取基于校正后的文本） | — |
| `kinds` | `EntityKind[]` | 必填 | 抽取类别：place / person / event / organization / artifact / time | — |
| `minConfidence` | `number` | 必填 | 低于该置信度标记为「需人工确认」 | 0.72 |
| `operator` | `OperatorInfo` | 必填 | 发起人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `taskId` | `string` | 必填 | 异步任务 id | — |
| `extractionId` | `string` | 必填 | 抽取结果 id | — |
| `estimatedMs` | `number` | 必填 | 预估耗时 | — |

#### `extract.get · 拉取抽取结果`

**接口**：`GET /extractions/{extractionId}`

- 前端调用位置：`src/api/extract.ts · extractApi.getExtraction`
- mock 实现位置：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entities` | `ExtractedEntity[]` | 必填 | 实体列表 | — |
| `entities[].evidence` | `EvidenceRef[]` | 必填 | 与原文的对应关系，支撑「跳转到原文」 | — |
| `entities[].confirmStatus` | `ConfirmStatus` | 必填 | pending 即界面上的「需人工确认」 | — |
| `entities[].uncertaintyNote` | `string` | 可选 | 不确定性说明 | — |
| `pendingConfirmCount` | `number` | 必填 | 待确认数量 | — |
| `duplicateGroups` | `DuplicateGroup[]` | 必填 | 疑似同义项分组 | — |

**待确认**

- 同义项分组由后端算还是前端算？当前 mock 在前端按名称相似度计算。

#### `extract.upsert · 新增 / 更新实体`

**接口**：`POST /extractions/{extractionId}/entities`

- 前端调用位置：`src/api/extract.ts · extractApi.upsertEntity`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entityId` | `string` | 可选 | 不传=新增，传=更新 | — |
| `kind` | `EntityKind` | 必填 | 类别 | — |
| `name` | `string` | 必填 | 原文形式 | — |
| `normalizedName` | `string` | 必填 | 规范名 | — |
| `aliases` | `string[]` | 必填 | 别名列表 | — |
| `confirmStatus` | `ConfirmStatus` | 可选 | 人工确认结果 | — |
| `evidence` | `EvidenceRef[]` | 可选 | 人工补挂的原文依据 | — |
| `operator` | `OperatorInfo` | 必填 | 操作人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entity` | `ExtractedEntity` | 必填 | 保存后的实体 | — |
| `pendingConfirmCount` | `number` | 必填 | 待确认数量 | — |
| `versionNo` | `number` | 必填 | 数据版本号 | — |

#### `extract.delete · 删除实体`

**接口**：`DELETE /extractions/{extractionId}/entities/{entityId}`

- 前端调用位置：`src/api/extract.ts · extractApi.deleteEntity`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entityId` | `string` | 必填 | 实体 id（路径参数） | — |
| `operator` | `OperatorInfo` | 必填 | 操作人 | — |
| `reason` | `string` | 可选 | 删除原因，用于审计 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `deletedId` | `string` | 必填 | 被删除的实体 id | — |
| `pendingConfirmCount` | `number` | 必填 | 删除后的待确认数量 | — |

**待确认**

- 删除是软删除还是硬删除？审计要求待确认。

#### `extract.merge · 合并同义项`

**接口**：`POST /extractions/{extractionId}/entities:merge`

- 前端调用位置：`src/api/extract.ts · extractApi.mergeEntities`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `primaryId` | `string` | 必填 | 合并后保留的实体 id | — |
| `mergedIds` | `string[]` | 必填 | 被合并的实体 id 列表 | — |
| `operator` | `OperatorInfo` | 必填 | 操作人 | — |
| `note` | `string` | 可选 | 合并说明 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entity` | `ExtractedEntity` | 必填 | 合并后的主实体 | — |
| `mergedAliases` | `string[]` | 必填 | 合并后的别名集合 | — |
| `removedIds` | `string[]` | 必填 | 被移除的实体 id | — |

**待确认**

- 合并是否可撤销？若需要，后端应保留合并前后的实体快照。

#### `extract.batchConfirm · 批量确认`

**接口**：`POST /extractions/{extractionId}/entities:batchConfirm`

- 前端调用位置：`src/api/extract.ts · extractApi.batchConfirm`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entityIds` | `string[]` | 必填 | 待确认的实体 id | — |
| `confirmStatus` | `'confirmed' | 'rejected'` | 必填 | 确认结果 | — |
| `operator` | `OperatorInfo` | 必填 | 操作人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entities` | `ExtractedEntity[]` | 必填 | 更新后的实体 | — |
| `confirmedCount` | `number` | 必填 | 本次确认数量 | — |
| `pendingConfirmCount` | `number` | 必填 | 剩余待确认数量 | — |

### 流程 4（2 个端点）

| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |
| --- | --- | --- | --- | --- | --- |
| `search.sources` | 组合检索资料 | `POST` | `/sources/search` | `SearchSourcesRequest` | `SearchSourcesResponse` |
| `search.detail` | 资料详情 | `GET` | `/sources/{sourceId}` | — | `GetSourceDetailResponse` |

#### `search.sources · 组合检索资料`

**接口**：`POST /sources/search`

- 前端调用位置：`src/api/search.ts · searchApi.search`
- mock 实现位置：`src/api/search.ts（EXPANSION_RULES）+ src/mock/dataset.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `keywords` | `string[]` | 必填 | 关键词；多词语义（AND/OR）待确认 | — |
| `entityIds` | `string[]` | 可选 | 按流程 3 的实体过滤 | — |
| `places` | `string[]` | 可选 | 地点自由输入 | — |
| `persons` | `string[]` | 可选 | 人物自由输入 | — |
| `events` | `string[]` | 可选 | 事件自由输入 | — |
| `timeRange` | `TimeRange` | 可选 | 时间区间，支持历史纪年文本 | — |
| `sourceTypes` | `SourceType[]` | 可选 | 来源类型过滤 | — |
| `credibility` | `CredibilityLevel[]` | 可选 | 可信度过滤 | — |
| `enableQueryExpansion` | `boolean` | 必填 | 是否启用 AI 智能扩展检索词 | true |
| `enableReRank` | `boolean` | 必填 | 是否启用 AI 相关度重排 | true |
| `page / pageSize` | `number` | 可选 | 分页 | 1 / 10 |
| `sort` | `'relevance' | 'publishedAt' | 'credibility'` | 可选 | 排序方式 | relevance |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `hits` | `SearchHit[]` | 必填 | 命中结果 | — |
| `hits[].credibility` | `'high' | 'medium' | 'low' | 'unverified'` | 必填 | 可信度分级 | — |
| `hits[].credibilityScore` | `number` | 必填 | 0~1 分值，用于排序与展示 | — |
| `hits[].excerpt` | `string` | 必填 | 原文摘录 | — |
| `hits[].locator` | `object` | 必填 | 页码 / 行号 / 链接 | — |
| `expandedKeywords` | `ExpandedKeyword[]` | 必填 | AI 扩展词及理由；未启用时为空数组 | — |
| `facets` | `SearchFacet[]` | 必填 | 分面统计，用于筛选栏数量 | — |
| `leads` | `RelatedLead[]` | 必填 | 关联线索，供继续深挖 | — |

**待确认**

- TODO-SEARCH-1：多关键词是 AND 还是 OR？是否支持引号短语与排除词语法？
- 扩展词与重排是否计费/限流？需要前端做节流提示。

#### `search.detail · 资料详情`

**接口**：`GET /sources/{sourceId}`

- 前端调用位置：`src/api/search.ts · searchApi.getSourceDetail`
- mock 实现位置：`src/mock/dataset.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `fullExcerpt` | `string` | 必填 | 完整摘录（受授权范围限制） | — |
| `citation` | `string` | 必填 | 引用格式文本，供生成流程直接使用 | — |
| `relatedSources` | `SearchHit[]` | 必填 | 相关资料来源 | — |
| `leads` | `RelatedLead[]` | 必填 | 关联线索 | — |

**待确认**

- 受版权限制的资料，后端是否返回全文？前端需按授权范围降级展示。

### 流程 5（3 个端点）

| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |
| --- | --- | --- | --- | --- | --- |
| `compare.start` | 发起比对 | `POST` | `/comparisons:start` | `StartComparisonRequest` | `StartComparisonResponse` |
| `compare.annotations` | 提交标注 | `POST` | `/comparisons/{comparisonId}/annotations` | `SubmitAnnotationsRequest` | `SubmitAnnotationsResponse` |
| `compare.rejudge` | 请求 AI 重判 | `POST` | `/comparisons/{comparisonId}/items/{itemId}:rejudge` | `RejudgeItemRequest` | `RejudgeItemResponse` |

#### `compare.start · 发起比对`

**接口**：`POST /comparisons:start`

- 前端调用位置：`src/api/compare.ts · compareApi.start`
- mock 实现位置：`src/mock/dataset.ts · DEMO_COMPARISON_ITEMS`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `draftId` | `string` | 必填 | 待比对的创作草稿 id | — |
| `claimIds` | `string[]` | 可选 | 限定比对的论断；不传=全部 | — |
| `enableAutoJudge` | `boolean` | 必填 | 是否启用 AI 自动初判 | true |
| `maxSourcesPerClaim` | `number` | 可选 | 每条论断最多配对资料数 | 1 |
| `operator` | `OperatorInfo` | 必填 | 发起人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `items` | `ComparisonItem[]` | 必填 | 比对项列表（左：创作内容，右：资料） | — |
| `items[].aiVerdict` | `CompareVerdict` | 必填 | AI 初判：consistent / conflict / needs_verification / insufficient | — |
| `items[].aiReason` | `string` | 必填 | AI 理由说明，必须展示以避免黑箱 | — |
| `items[].annotationState` | `'unannotated' | 'annotated'` | 必填 | 人工标注状态 | — |
| `stats` | `AnnotationStats` | 必填 | 标注进度统计 | — |

**待确认**

- AI 初判是否允许「弃权」（insufficient）？前端已按四态渲染。

#### `compare.annotations · 提交标注`

**接口**：`POST /comparisons/{comparisonId}/annotations`

- 前端调用位置：`src/api/compare.ts · compareApi.submitAnnotations`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `annotations` | `AnnotationInput[]` | 必填 | 标注列表 | — |
| `annotations[].itemId` | `string` | 必填 | 比对项 id | — |
| `annotations[].verdict` | `CompareVerdict` | 必填 | 人工结论 | — |
| `annotations[].reason` | `string` | 条件必填 | verdict 为 conflict / needs_verification 时必填 | — |
| `annotations[].reasonTags` | `ConflictReasonTag[]` | 必填 | 差异原因分类 | — |
| `annotator` | `OperatorInfo` | 必填 | 标注人 | — |
| `submitAll` | `boolean` | 必填 | true=整批提交，false=增量保存 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `savedCount` | `number` | 必填 | 实际写入条数 | — |
| `stats` | `AnnotationStats` | 必填 | 更新后的进度统计 | — |
| `invalid` | `object[]` | 必填 | 校验失败条目，前端需就地提示 | — |

**待确认**

- 增量保存的频率上限？是否需要防抖与并发合并策略？

#### `compare.rejudge · 请求 AI 重判`

**接口**：`POST /comparisons/{comparisonId}/items/{itemId}:rejudge`

- 前端调用位置：`src/api/compare.ts · compareApi.rejudgeItem`
- mock 实现位置：`src/api/compare.ts（内联 mock）`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `itemId` | `string` | 必填 | 比对项 id（路径参数） | — |
| `hints` | `string` | 可选 | 人工补充的上下文，用于提升重判质量 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `item` | `ComparisonItem` | 必填 | 重判后的比对项 | — |
| `aiMeta` | `AiMeta` | 必填 | 重判模型信息 | — |

### 流程 6（4 个端点）

| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |
| --- | --- | --- | --- | --- | --- |
| `generate.create` | 生成初稿 | `POST` | `/generations:create` | `CreateGenerationRequest` | `CreateGenerationResponse` |
| `generate.regenerate` | 重新生成 | `POST` | `/generations/{draftId}:regenerate` | `RegenerateRequest` | `RegenerateResponse` |
| `generate.save` | 保存草稿 | `PUT` | `/generations/{draftId}` | `SaveDraftRequest` | `SaveDraftResponse` |
| `generate.get` | 拉取草稿 | `GET` | `/generations/{draftId}` | — | `GetDraftResponse` |

#### `generate.create · 生成初稿`

**接口**：`POST /generations:create`

- 前端调用位置：`src/api/generate.ts · generateApi.create`
- mock 实现位置：`src/mock/dataset.ts · DEMO_GENERATION`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `outputType` | `'story_card' | 'study_script'` | 必填 | 输出类型 | — |
| `tone` | `Tone` | 必填 | 语气：plain / narrative / academic / child / official | — |
| `length` | `'short' | 'medium' | 'long'` | 必填 | 篇幅 | — |
| `title` | `string` | 必填 | 标题 | — |
| `audience` | `string` | 可选 | 目标读者，如「小学四年级研学团」 | — |
| `claimIds` | `string[]` | 必填 | 纳入的论断（通常来自流程 5 标注为「一致」的条目） | — |
| `sourceIds` | `string[]` | 必填 | 允许引用的资料 id，约束引用范围 | — |
| `requireCitation` | `boolean` | 必填 | 是否强制逐句标注来源 | true |
| `allowUnverified` | `boolean` | 必填 | 是否允许收录「待核实」内容 | false |
| `creativity` | `number` | 必填 | 创作自由度 0~1，0=严格复述资料 | 0.2 |
| `extraInstruction` | `string` | 可选 | 附加要求 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `blocks` | `DraftBlock[]` | 必填 | 正文区块 | — |
| `blocks[].citationIndexes` | `number[]` | 必填 | 该区块引用的角标序号 | — |
| `citations` | `Citation[]` | 必填 | 引用来源明细，含定位与摘录 | — |
| `riskNotes` | `RiskNote[]` | 必填 | 生成期风险提示（传说当史实、无来源等） | — |
| `omittedSourceIds` | `string[]` | 必填 | 因风险被排除的资料，需向用户说明 | — |
| `version` | `VersionRef` | 必填 | 版本信息 | — |

**待确认**

- TODO-GEN-1：生成是同步返回还是异步任务？长文可能超时，需确认是否走任务轮询。
- 引用角标编号由后端给定还是前端渲染时生成？当前约定后端给定。

#### `generate.regenerate · 重新生成`

**接口**：`POST /generations/{draftId}:regenerate`

- 前端调用位置：`src/api/generate.ts · generateApi.regenerate`
- mock 实现位置：`src/mock/dataset.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `tone / length / creativity` | `各类型` | 可选 | 仅覆盖需要变化的参数 | — |
| `extraInstruction` | `string` | 可选 | 附加要求 | — |
| `keepEditedBlocks` | `boolean` | 必填 | 是否保留人工已编辑的区块 | true |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `blocks / citations / riskNotes` | `各类型` | 必填 | 重新生成后的内容 | — |
| `preservedBlockIds` | `string[]` | 必填 | 被保留的人工编辑区块，需在界面标出 | — |

#### `generate.save · 保存草稿`

**接口**：`PUT /generations/{draftId}`

- 前端调用位置：`src/api/generate.ts · generateApi.saveDraft`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 必填 | 标题 | — |
| `blocks` | `DraftBlock[]` | 必填 | 完整正文区块 | — |
| `createVersion` | `boolean` | 必填 | true=生成正式版本，false=仅存草稿 | — |
| `note` | `string` | 可选 | 保存说明 | — |
| `operator` | `OperatorInfo` | 必填 | 保存人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `version` | `VersionRef` | 必填 | 保存后的版本 | — |
| `riskNotes` | `RiskNote[]` | 必填 | 编辑后重算的风险提示 | — |

**待确认**

- 是否需要自动保存（如每 30 秒）？届时 createVersion 应固定为 false。

#### `generate.get · 拉取草稿`

**接口**：`GET /generations/{draftId}`

- 前端调用位置：`src/api/generate.ts · generateApi.getDraft`
- mock 实现位置：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `blocks / citations` | `各类型` | 必填 | 草稿内容 | — |
| `status` | `PublishStatus` | 必填 | 草稿当前所处的发布状态 | — |
| `updatedBy` | `OperatorInfo` | 必填 | 最后修改人 | — |

### 流程 7（6 个端点）

| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |
| --- | --- | --- | --- | --- | --- |
| `publish.transition` | 状态流转 | `POST` | `/contents/{contentId}/transitions` | `TransitionRequest` | `TransitionResponse` |
| `publish.riskCheck` | AI 风险检查 | `POST` | `/contents/{contentId}/risk-check` | — | `RiskCheckResponse` |
| `publish.reviewComment` | 提交审核意见 | `POST` | `/contents/{contentId}/review-comments` | `ReviewCommentRequest` | `ReviewCommentResponse` |
| `publish.publish` | 最终确认并发布 | `POST` | `/contents/{contentId}/publish` | `FinalConfirmRequest` | `PublishResponse` |
| `publish.versions` | 版本记录 | `GET` | `/contents/{contentId}/versions` | — | `VersionListResponse` |
| `publish.rollback` | 回滚版本 | `POST` | `/contents/{contentId}/rollback` | — | `{ status, versionNo, rolledBackTo }` |

#### `publish.transition · 状态流转`

**接口**：`POST /contents/{contentId}/transitions`

- 前端调用位置：`src/api/publish.ts · publishApi.transition`
- mock 实现位置：`src/api/publish.ts（TRANSITIONS 状态机）`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `action` | `ReviewAction` | 必填 | submit / approve / reject / publish / archive / withdraw | — |
| `expectedFrom` | `PublishStatus` | 必填 | 乐观锁：期望的当前状态，不匹配则拒绝 | — |
| `operator` | `OperatorInfo` | 必填 | 操作人 | — |
| `comment` | `string` | 可选 | 流转说明 / 审核意见 | — |
| `checklist` | `ChecklistItem[]` | 可选 | 发布前检查清单勾选结果 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `status` | `PublishStatus` | 必填 | 流转后的状态 | — |
| `versionNo` | `number` | 必填 | 本次流转生成的版本号 | — |
| `allowedActions` | `ReviewAction[]` | 必填 | 当前状态下允许的下一步，前端据此渲染按钮 | — |
| `publishedUrl` | `string` | 可选 | 发布后的对外地址 | — |

**待确认**

- TODO-WF-1：状态机的合法流转表需与后端完全对齐（当前定义见 src/api/publish.ts 的 TRANSITIONS）。
- 并发流转冲突的返回码与结构待确认。

#### `publish.riskCheck · AI 风险检查`

**接口**：`POST /contents/{contentId}/risk-check`

- 前端调用位置：`src/api/publish.ts · publishApi.riskCheck`
- mock 实现位置：`src/api/publish.ts（内联 mock，综合比对与生成阶段数据）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `risks` | `ReviewRisk[]` | 必填 | 风险项列表，含等级、分类、建议处理方式 | — |
| `risks[].category` | `string` | 必填 | unsourced_claim / legend_as_fact / low_credibility_source / license_scope / sensitive_content / citation_missing | — |
| `overallLevel` | `'low' | 'medium' | 'high'` | 必填 | 综合风险等级 | — |
| `publishable` | `boolean` | 必填 | 是否允许直接发布 | — |
| `blockers` | `string[]` | 必填 | 阻止发布的原因，前端需逐条展示 | — |

**待确认**

- 风险项是否允许「忽略并说明」？当前设计为必须逐条确认知晓（acknowledged）。

#### `publish.reviewComment · 提交审核意见`

**接口**：`POST /contents/{contentId}/review-comments`

- 前端调用位置：`src/api/publish.ts · publishApi.reviewComment`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `decision` | `'approved' | 'rejected'` | 必填 | 审核结论 | — |
| `comment` | `string` | 条件必填 | 驳回时必填 | — |
| `riskDecisions` | `object[]` | 可选 | 逐条风险项的确认结果 | — |
| `reviewer` | `OperatorInfo` | 必填 | 审核人 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `status` | `PublishStatus` | 必填 | 审核后的状态 | — |
| `reviewedAt` | `string` | 必填 | 审核时间 | — |
| `versionNo` | `number` | 必填 | 审核产生的版本号 | — |

#### `publish.publish · 最终确认并发布`

**接口**：`POST /contents/{contentId}/publish`

- 前端调用位置：`src/api/publish.ts · publishApi.publish`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `confirmLicense` | `boolean` | 必填 | 已确认授权范围 | false |
| `confirmCitation` | `boolean` | 必填 | 已确认引用标注完整 | false |
| `confirmReviewed` | `boolean` | 必填 | 已确认完成审核 | false |
| `operator` | `OperatorInfo` | 必填 | 发布人 | — |
| `note` | `string` | 可选 | 发布说明 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `publishedUrl` | `string` | 必填 | 对外地址 | — |
| `visibility` | `'public' | 'internal'` | 必填 | 可见范围，由授权类型决定 | — |
| `certificateNo` | `string` | 可选 | 发布凭证编号 | — |

#### `publish.versions · 版本记录`

**接口**：`GET /contents/{contentId}/versions`

- 前端调用位置：`src/api/publish.ts · publishApi.listVersions`
- mock 实现位置：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `versions` | `ContentVersionRecord[]` | 必填 | 版本列表，倒序 | — |
| `versions[].riskLevel` | `'low' | 'medium' | 'high'` | 必填 | 该版本的风险等级快照 | — |
| `currentVersionId` | `string` | 必填 | 当前版本 id | — |

#### `publish.rollback · 回滚版本`

**接口**：`POST /contents/{contentId}/rollback`

- 前端调用位置：`src/api/publish.ts · publishApi.rollback`
- mock 实现位置：`src/mock/store.ts`

**请求字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `targetVersionId` | `string` | 必填 | 回滚目标版本 | — |
| `operator` | `OperatorInfo` | 必填 | 操作人 | — |
| `note` | `string` | 可选 | 回滚原因 | — |

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `status` | `PublishStatus` | 必填 | 回滚后的状态 | — |
| `versionNo` | `number` | 必填 | 新生成的版本号 | — |
| `rolledBackTo` | `string` | 必填 | 实际回滚到的版本 id | — |

**待确认**

- 已发布内容回滚后，线上是否立即下线？需要与后端确认缓存刷新策略。


<!-- END GENERATED: endpoints -->

---

## 八、数据模型（自动生成，直接取自类型定义源码）

> 数据源：`src/types/api/*.ts` 与 `src/types/domain.ts`。
> 这些 TS 类型就是前端解析响应时的**类型断言**：字段名、类型、可选性必须与后端实际返回一致，
> 否则运行期不会报错（TS 类型在运行时被擦除），只会表现为界面字段为空。

<!-- BEGIN GENERATED: models -->

### `src/types/api/common.ts`

```ts
/**
 * 接口契约的公共类型。
 *
 * ⚠️ 前后端协作说明：
 * 本文件与同目录下 7 个模块文件共同构成**前端对后端接口的假设**。
 * 所有「待确认」字段都在注释中标出 TODO 编号，后端定稿后以本文档为准逐条核对。
 */

/**
 * 后端任务生命周期状态。
 * 注意与界面状态机（`TaskPhase`，见 composables/useAsyncTask.ts）区分：
 * 前者由服务端返回、描述任务本身；后者由前端推导、描述界面该渲染什么。
 */
export type RemoteTaskStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'partial'

/** 人工确认状态。用于「需人工确认」这一界面状态的判定来源。 */
export type ConfirmStatus = 'not_required' | 'pending' | 'confirmed' | 'rejected'

/** AI 能力的元信息。所有 AI 接口的响应都必须带这个对象。 */
export interface AiMeta {
  /** 模型标识，例如 'fuzhou-asr-v2'。 */
  model: string
  modelVersion: string
  /** 模型自评置信度 0~1。 */
  confidence: number
  /** 是否必须人工确认后才能进入下一步。 */
  needsHumanConfirm: boolean
  /** 提示词版本，便于复现与回溯。 */
  promptVersion?: string
  /** ISO 8601。 */
  generatedAt: string
  /** AI 侧耗时（毫秒）。 */
  tookMs: number
  /** 能力不可用时的原因（后端返回，前端只展示）。 */
  unavailableReason?: string
}

/** 操作人信息。用于「记录修改人与修改时间」。 */
export interface OperatorInfo {
  id: string
  name: string
  /** 角色：编审 / 研究者 / 管理员。 */
  role: string
}

/** 版本引用。所有可回滚的资源都返回这个结构。 */
export interface VersionRef {
  versionId: string
  /** 从 1 开始的递增版本号。 */
  versionNo: number
  createdBy: OperatorInfo
  /** ISO 8601。 */
  createdAt: string
  /** 变更说明。 */
  note?: string
}

/** 字段级校验错误。HTTP 422 时后端应返回该结构（TODO-API-3 待确认）。 */
export interface FieldIssue {
  field: string
  message: string
}

/** 空数据时的补充说明，便于界面区分「真无数据」与「筛选过窄」。 */
export interface EmptyHint {
  reason: string
  suggestion?: string
}
```

### `src/types/api/compare.ts`

```ts
/**
 * 流程 5：标注一致或有差异之处 —— 接口契约。
 *
 * 数据形态：AI 创作内容（论断）与检索资料逐条配对，形成「比对项」，
 * 每项先由 AI 初判，再由人工标注最终结论。
 */
import type { AiMeta, OperatorInfo } from './common'

/**
 * 比对结论。
 * - consistent 一致
 * - conflict 差异
 * - needs_verification 待核实
 * - insufficient 资料不足（无法判断）
 */
export type CompareVerdict = 'consistent' | 'conflict' | 'needs_verification' | 'insufficient'

/** 人工标注状态。 */
export type AnnotationState = 'unannotated' | 'annotated'

/** 差异原因分类，用于统计与后续复盘。 */
export type ConflictReasonTag =
  | 'time_error' // 时间不符
  | 'place_error' // 地点不符
  | 'person_mixup' // 人物混淆
  | 'legend_as_fact' // 传说当作史实
  | 'memory_bias' // 个人记忆偏差
  | 'source_low_credibility' // 来源可信度不足
  | 'transcription_error' // 转写错误
  | 'other'

/* ---------------- POST /comparisons:start ---------------- */

export interface StartComparisonRequest {
  /** 待比对的创作草稿 id（流程 6 产出，或外部导入）。 */
  draftId: string
  /** 限定比对的论断；不传表示全部。 */
  claimIds?: string[]
  /** 是否启用 AI 自动初判。 */
  enableAutoJudge: boolean
  /** 每条论断最多配对的资料数。 */
  maxSourcesPerClaim?: number
  operator: OperatorInfo
}

/** 单个比对项。 */
export interface ComparisonItem {
  itemId: string
  /** 创作内容中的论断原文。 */
  claimText: string
  /** 论断在草稿中的位置，用于左侧跳转。 */
  claimBlockId?: string
  /** 论断对应的采访片段（若有）。 */
  claimSegmentId?: string
  /** 配对到的资料；资料不足时为 null。 */
  source: {
    sourceId: string
    title: string
    publisher: string
    credibility: 'high' | 'medium' | 'low' | 'unverified'
    publishedAt: string
    excerpt: string
    locator: { page?: number; line?: number; url?: string; callNumber?: string }
  } | null
  /** AI 初判结论。source 为 null 时恒为 insufficient。 */
  aiVerdict: CompareVerdict
  /** AI 初判置信度 0~1。 */
  aiConfidence: number
  /** AI 给出的理由说明（必须展示给用户，避免黑箱）。 */
  aiReason: string
  /** AI 理由对应的分类标签。 */
  aiReasonTags: ConflictReasonTag[]
  /** 人工最终结论；未标注时为 null。 */
  humanVerdict: CompareVerdict | null
  humanReason: string | null
  humanReasonTags: ConflictReasonTag[]
  annotator: OperatorInfo | null
  /** ISO 8601。 */
  annotatedAt: string | null
  /** 标注状态。 */
  annotationState: AnnotationState
}

/** 标注进度统计。 */
export interface AnnotationStats {
  total: number
  annotated: number
  /** 0~1。 */
  progress: number
  consistent: number
  conflict: number
  needsVerification: number
  insufficient: number
  /** 与 AI 初判不一致的人工标注数（用于评估 AI 效果）。 */
  disagreedWithAi: number
}

export interface StartComparisonResponse {
  comparisonId: string
  draftId: string
  items: ComparisonItem[]
  stats: AnnotationStats
  aiMeta: AiMeta
}

/* ---------------- GET /comparisons/{comparisonId} ---------------- */

export interface GetComparisonResponse {
  comparisonId: string
  draftId: string
  items: ComparisonItem[]
  stats: AnnotationStats
  aiMeta: AiMeta
  status: 'succeeded' | 'running' | 'failed'
  failureReason?: string
}

/* ---------------- POST /comparisons/{id}/annotations ---------------- */

export interface AnnotationInput {
  itemId: string
  verdict: CompareVerdict
  /** verdict 为 conflict / needs_verification 时必填。 */
  reason: string
  reasonTags: ConflictReasonTag[]
}

export interface SubmitAnnotationsRequest {
  comparisonId: string
  annotations: AnnotationInput[]
  annotator: OperatorInfo
  /** true 表示提交整批（用于最终提交）；false 为增量保存。 */
  submitAll: boolean
}

export interface SubmitAnnotationsResponse {
  comparisonId: string
  savedAt: string
  /** 本次实际写入的条数。 */
  savedCount: number
  stats: AnnotationStats
  /** 校验失败的条目。 */
  invalid: Array<{ itemId: string; message: string }>
}

/** AI 重判单条（人工对初判有异议时可请求重新判断）。 */
export interface RejudgeItemRequest {
  comparisonId: string
  itemId: string
  /** 人工补充的上下文，用于提升重判质量。 */
  hints?: string
}

export interface RejudgeItemResponse {
  item: ComparisonItem
  aiMeta: AiMeta
}
```

### `src/types/api/extract.ts`

```ts
/**
 * 流程 3：提取地点 / 人物 / 事件 —— 接口契约。
 */
import type { AiMeta, ConfirmStatus, OperatorInfo } from './common'

/** 实体类别。 */
export type EntityKind = 'place' | 'person' | 'event' | 'organization' | 'artifact' | 'time'

/** 一条抽取结果与原始文本的对应关系（用于「跳转到原文」）。 */
export interface EvidenceRef {
  segmentId: string
  /** 原文中的字符区间，用于精确高亮。 */
  charStart: number
  charEnd: number
  /** 命中的原文片段。 */
  quote: string
  /** 片段起始时间（毫秒），用于回跳音频。 */
  startMs: number
}

/** 抽取出的实体。 */
export interface ExtractedEntity {
  id: string
  kind: EntityKind
  /** 原文中出现的形式，例如「三坊巷」。 */
  name: string
  /** 规范化后的标准名，例如「三坊七巷」。 */
  normalizedName: string
  /** 别名 / 异体写法。 */
  aliases: string[]
  /** 0~1。 */
  confidence: number
  /** 确认状态：pending 即界面上的「需人工确认」。 */
  confirmStatus: ConfirmStatus
  /** 不确定性说明，例如「原文发音含混，可能是『塔巷』」。 */
  uncertaintyNote?: string
  evidence: EvidenceRef[]
  /** 是否为人工新增。 */
  createdByHuman: boolean
  updatedBy?: OperatorInfo
  updatedAt?: string
}

/* ---------------- POST /extractions:start ---------------- */

export interface StartExtractionRequest {
  interviewId: string
  transcriptId: string
  kinds: EntityKind[]
  /** 低于该置信度的结果标为「待确认」。 */
  minConfidence: number
  operator: OperatorInfo
}

export interface StartExtractionResponse {
  taskId: string
  extractionId: string
  status: 'queued' | 'running'
  estimatedMs: number
  aiMeta: AiMeta
}

/* ---------------- GET /extractions/{extractionId} ---------------- */

export interface GetExtractionResponse {
  extractionId: string
  interviewId: string
  transcriptId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'
  entities: ExtractedEntity[]
  /** 待人工确认的实体数。 */
  pendingConfirmCount: number
  /** 疑似同义项分组，供「同义项合并」使用。 */
  duplicateGroups: DuplicateGroup[]
  aiMeta: AiMeta
  failureReason?: string
}

/** 同义项分组，例如「三坊七巷 / 三坊巷 / 三坊七巷街区」。 */
export interface DuplicateGroup {
  groupId: string
  /** 建议保留的实体 id。 */
  suggestedPrimaryId: string
  memberIds: string[]
  /** 依据说明。 */
  reason: string
  similarity: number
}

/* ---------------- POST /extractions/{id}/entities ---------------- */

export interface UpsertEntityRequest {
  extractionId: string
  /** 不传表示新增，传表示更新。 */
  entityId?: string
  kind: EntityKind
  name: string
  normalizedName: string
  aliases: string[]
  /** 人工确认 / 撤销确认。 */
  confirmStatus?: ConfirmStatus
  uncertaintyNote?: string
  /** 人工新增时补挂的原文依据。 */
  evidence?: EvidenceRef[]
  operator: OperatorInfo
}

export interface UpsertEntityResponse {
  entity: ExtractedEntity
  pendingConfirmCount: number
  versionNo: number
  updatedAt: string
}

export interface DeleteEntityRequest {
  extractionId: string
  entityId: string
  operator: OperatorInfo
  reason?: string
}

/** 同义项合并请求。 */
export interface MergeEntitiesRequest {
  extractionId: string
  /** 合并后保留的实体 id。 */
  primaryId: string
  /** 被合并（消失）的实体 id。 */
  mergedIds: string[]
  operator: OperatorInfo
  note?: string
}

export interface MergeEntitiesResponse {
  entity: ExtractedEntity
  /** 受影响而被删除的实体 id。 */
  removedIds: string[]
  /** 合并后的别名列表。 */
  mergedAliases: string[]
  pendingConfirmCount: number
  versionNo: number
}

/** 批量确认（一键采纳 AI 建议）。 */
export interface BatchConfirmRequest {
  extractionId: string
  entityIds: string[]
  confirmStatus: 'confirmed' | 'rejected'
  operator: OperatorInfo
}

export interface BatchConfirmResponse {
  entities: ExtractedEntity[]
  pendingConfirmCount: number
  confirmedCount: number
}
```

### `src/types/api/generate.ts`

```ts
/**
 * 流程 6：生成故事卡或研学讲稿 —— 接口契约。
 */
import type { AiMeta, OperatorInfo, VersionRef } from './common'

/** 输出类型。 */
export type OutputType = 'story_card' | 'study_script'

/** 语气。 */
export type Tone = 'plain' | 'narrative' | 'academic' | 'child' | 'official'

/** 篇幅。 */
export type LengthPreset = 'short' | 'medium' | 'long'

/** 引用来源。 */
export interface Citation {
  /** 正文中的角标序号，从 1 开始。 */
  index: number
  sourceId: string
  sourceTitle: string
  publisher: string
  /** 定位描述，例如「第 12 页」「00:08.8」。 */
  locatorText: string
  quote: string
  credibility: 'high' | 'medium' | 'low' | 'unverified'
}

/** 生成正文的一个区块（标题 + 段落）。 */
export interface DraftBlock {
  id: string
  heading: string
  body: string
  /** 该区块引用的角标序号。 */
  citationIndexes: number[]
  /** 是否为人工编辑过的区块。 */
  edited: boolean
}

/** 风险提示。 */
export interface RiskNote {
  level: 'info' | 'warning' | 'critical'
  category: 'legend_as_fact' | 'unsourced' | 'low_credibility' | 'sensitive' | 'copyright' | 'other'
  message: string
  suggestion: string
  relatedBlockId?: string
}

/* ---------------- POST /generations:create ---------------- */

export interface CreateGenerationRequest {
  outputType: OutputType
  tone: Tone
  length: LengthPreset
  title: string
  /** 目标读者，例如「小学四年级研学团」。 */
  audience?: string
  /** 纳入的论断 id（来自流程 5 中标注为「一致」的条目）。 */
  claimIds: string[]
  /** 允许引用的资料 id；为空时后端按论断自动关联。 */
  sourceIds: string[]
  /** 是否强制为每句结论附来源标注。 */
  requireCitation: boolean
  /** 是否允许收录「待核实」内容（默认 false，仅作为开放式提问呈现）。 */
  allowUnverified: boolean
  /** 创作自由度 0~1，0 = 严格复述资料。 */
  creativity: number
  /** 附加要求（自由文本）。 */
  extraInstruction?: string
  operator: OperatorInfo
}

export interface CreateGenerationResponse {
  draftId: string
  outputType: OutputType
  title: string
  blocks: DraftBlock[]
  citations: Citation[]
  /** 实际用到的资料 id。 */
  usedSourceIds: string[]
  /** 因风险被排除的资料 id。 */
  omittedSourceIds: string[]
  riskNotes: RiskNote[]
  version: VersionRef
  aiMeta: AiMeta
}

/* ---------------- POST /generations/{draftId}:regenerate ---------------- */

export interface RegenerateRequest {
  draftId: string
  /** 仅覆盖变化的部分参数，其余沿用上次。 */
  tone?: Tone
  length?: LengthPreset
  creativity?: number
  extraInstruction?: string
  /** 保留人工已编辑的区块。 */
  keepEditedBlocks: boolean
  operator: OperatorInfo
}

export interface RegenerateResponse {
  draftId: string
  blocks: DraftBlock[]
  citations: Citation[]
  riskNotes: RiskNote[]
  version: VersionRef
  aiMeta: AiMeta
  /** 因保留人工编辑而未重新生成的区块 id。 */
  preservedBlockIds: string[]
}

/* ---------------- PUT /generations/{draftId} ---------------- */

export interface SaveDraftRequest {
  draftId: string
  title: string
  blocks: DraftBlock[]
  /** true 时生成一个正式版本，false 仅保存草稿。 */
  createVersion: boolean
  note?: string
  operator: OperatorInfo
}

export interface SaveDraftResponse {
  draftId: string
  savedAt: string
  version: VersionRef
  /** 保存后的风险重算结果（编辑可能引入新风险）。 */
  riskNotes: RiskNote[]
}

/* ---------------- GET /generations/{draftId} ---------------- */

export interface GetDraftResponse {
  draftId: string
  outputType: OutputType
  title: string
  blocks: DraftBlock[]
  citations: Citation[]
  riskNotes: RiskNote[]
  version: VersionRef
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'archived'
  updatedAt: string
  updatedBy: OperatorInfo
}
```

### `src/types/api/index.ts`

```ts
/**
 * 7 个业务模块的接口契约出口。
 *
 * 结构约定：`src/types/api/<module>.ts` 描述字段（本层），
 * `src/api/<module>.ts` 描述端点与 mock 实现（调用层），
 * 两者一一对应，方便前后端按模块对接。
 */
export type {
  AiMeta,
  ConfirmStatus,
  EmptyHint,
  FieldIssue,
  OperatorInfo,
  RemoteTaskStatus,
  VersionRef,
} from './common'

export type {
  AudioFormat,
  ChunkUploadRequest,
  ChunkUploadResponse,
  DuplicateHit,
  InterviewListResponse,
  InterviewSummary,
  LicenseConfirmRequest,
  LicenseConfirmResponse,
  LicenseStatus,
  LicenseType,
  UploadCompleteResponse,
  UploadConstraints,
  UploadInitRequest,
  UploadInitResponse,
  UploadStatusResponse,
} from './upload'

export type {
  CorrectionSuggestion,
  GetTranscriptResponse,
  RollbackTranscriptRequest,
  RollbackTranscriptResponse,
  SegmentCorrection,
  StartTranscribeRequest,
  StartTranscribeResponse,
  SubmitCorrectionRequest,
  SubmitCorrectionResponse,
  SuggestCorrectionsResponse,
  TranscriptParagraphDTO,
  TranscriptSegmentDTO,
  TranscriptVersionListResponse,
  TranscriptVersionRecord,
  TranscriptViewMode,
} from './transcribe'

export type {
  BatchConfirmRequest,
  BatchConfirmResponse,
  DeleteEntityRequest,
  DuplicateGroup,
  EntityKind,
  EvidenceRef,
  ExtractedEntity,
  GetExtractionResponse,
  MergeEntitiesRequest,
  MergeEntitiesResponse,
  StartExtractionRequest,
  StartExtractionResponse,
  UpsertEntityRequest,
  UpsertEntityResponse,
} from './extract'

export type {
  CredibilityLevel,
  ExpandedKeyword,
  GetSourceDetailResponse,
  RelatedLead,
  SearchFacet,
  SearchHit,
  SearchSort,
  SearchSourcesRequest,
  SearchSourcesResponse,
  SourceType,
  TimeRange,
} from './search'

export type {
  AnnotationInput,
  AnnotationStats,
  CompareVerdict,
  ComparisonItem,
  ConflictReasonTag,
  GetComparisonResponse,
  RejudgeItemRequest,
  RejudgeItemResponse,
  StartComparisonRequest,
  StartComparisonResponse,
  SubmitAnnotationsRequest,
  SubmitAnnotationsResponse,
} from './compare'

export type {
  Citation,
  CreateGenerationRequest,
  CreateGenerationResponse,
  DraftBlock,
  GetDraftResponse,
  LengthPreset,
  OutputType,
  RegenerateRequest,
  RegenerateResponse,
  RiskNote,
  SaveDraftRequest,
  SaveDraftResponse,
  Tone,
} from './generate'

export type {
  ChecklistItem,
  ContentVersionRecord,
  FinalConfirmRequest,
  PublishResponse,
  PublishStatus,
  ReviewAction,
  ReviewCommentRequest,
  ReviewCommentResponse,
  ReviewRisk,
  RiskCheckResponse,
  RollbackContentRequest,
  RollbackContentResponse,
  TransitionRequest,
  TransitionResponse,
  VersionListResponse,
} from './publish'
```

### `src/types/api/publish.ts`

```ts
/**
 * 流程 7：审核发布 —— 接口契约。
 */
import type { AiMeta, OperatorInfo, VersionRef } from './common'

/**
 * 发布状态机：
 *   draft ──submit──► pending_review ──approve──► approved ──publish──► published
 *                          │                                  ▲
 *                          └────reject──► rejected ──revise────┘
 *   published ──archive──► archived（可回滚到历史版本）
 */
export type PublishStatus =
  'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'archived'

/** 审核动作。 */
export type ReviewAction = 'submit' | 'approve' | 'reject' | 'publish' | 'archive' | 'withdraw'

/* ---------------- POST /contents/{contentId}/transitions ---------------- */

export interface TransitionRequest {
  contentId: string
  action: ReviewAction
  /** 期望的起始状态，用于乐观锁：状态不匹配则拒绝。 */
  expectedFrom: PublishStatus
  operator: OperatorInfo
  comment?: string
  /** 发布前检查清单勾选结果。 */
  checklist?: ChecklistItem[]
}

export interface ChecklistItem {
  key: 'license' | 'citation' | 'annotation' | 'proofread' | 'sensitive'
  label: string
  checked: boolean
  /** 后端要求的必填项，未勾选不允许流转。 */
  required: boolean
}

export interface TransitionResponse {
  contentId: string
  /** 流转后的状态。 */
  status: PublishStatus
  /** 本次流转生成的新版本号。 */
  versionNo: number
  updatedAt: string
  /** 当前状态下允许的下一步动作。 */
  allowedActions: ReviewAction[]
  /** 若进入待审，返回审核任务 id。 */
  reviewId?: string
  /** 发布成功后的对外地址。 */
  publishedUrl?: string
}

/* ---------------- POST /contents/{contentId}/risk-check ---------------- */

/** 审核风险项。 */
export interface ReviewRisk {
  id: string
  level: 'info' | 'warning' | 'critical'
  category:
    | 'unsourced_claim' // 无来源结论
    | 'legend_as_fact' // 传说当史实
    | 'low_credibility_source' // 引用低可信来源
    | 'license_scope' // 超出授权范围
    | 'sensitive_content' // 敏感内容
    | 'citation_missing' // 缺少引用标注
    | 'other'
  message: string
  /** 建议处理方式。 */
  suggestion: string
  /** 定位到正文区块。 */
  relatedBlockId?: string
  /** 审核人是否已确认知晓。 */
  acknowledged: boolean
}

export interface RiskCheckResponse {
  contentId: string
  risks: ReviewRisk[]
  /** 综合风险等级。 */
  overallLevel: 'low' | 'medium' | 'high'
  /** 是否允许直接发布。 */
  publishable: boolean
  /** 阻止发布的原因。 */
  blockers: string[]
  aiMeta: AiMeta
}

/* ---------------- POST /contents/{contentId}/review-comments ---------------- */

export interface ReviewCommentRequest {
  contentId: string
  decision: 'approved' | 'rejected'
  /** 审核意见。reject 时必填。 */
  comment: string
  /** 逐条风险项的确认结果。 */
  riskDecisions: Array<{ riskId: string; acknowledged: boolean; note?: string }>
  reviewer: OperatorInfo
}

export interface ReviewCommentResponse {
  contentId: string
  status: PublishStatus
  reviewedAt: string
  reviewer: OperatorInfo
  comment: string
  versionNo: number
}

/* ---------------- POST /contents/{contentId}/publish ---------------- */

export interface FinalConfirmRequest {
  contentId: string
  operator: OperatorInfo
  /** 三项最终确认，缺一不可。 */
  confirmLicense: boolean
  confirmCitation: boolean
  confirmReviewed: boolean
  note?: string
}

export interface PublishResponse {
  contentId: string
  status: PublishStatus
  publishedUrl: string
  publishedAt: string
  versionNo: number
  /** 对外可见范围，由授权类型决定。 */
  visibility: 'public' | 'internal'
  certificateNo?: string
}

/* ---------------- 版本记录 ---------------- */

export interface ContentVersionRecord extends VersionRef {
  status: PublishStatus
  /** 该版本的风险等级快照。 */
  riskLevel: 'low' | 'medium' | 'high'
  publishedUrl?: string
}

export interface VersionListResponse {
  contentId: string
  versions: ContentVersionRecord[]
  currentVersionId: string
}

export interface RollbackContentRequest {
  contentId: string
  targetVersionId: string
  operator: OperatorInfo
  note?: string
}

export interface RollbackContentResponse {
  contentId: string
  status: PublishStatus
  versionNo: number
  rolledBackTo: string
  updatedAt: string
}
```

### `src/types/api/search.ts`

```ts
/**
 * 流程 4：检索地方资料 —— 接口契约。
 */
import type { PageQuery } from '@/services/api/types'

import type { AiMeta } from './common'

/** 资料来源类型。 */
export type SourceType =
  | 'gazetteer' // 地方志
  | 'chronicle' // 年鉴 / 大事记
  | 'genealogy' // 族谱
  | 'newspaper' // 旧报刊
  | 'academic' // 学术论文 / 专著
  | 'archive' // 官方档案
  | 'oral' // 口述记录
  | 'inscription' // 碑刻 / 匾额
  | 'heritage_list' // 非遗名录

/** 可信度分级。 */
export type CredibilityLevel = 'high' | 'medium' | 'low' | 'unverified'

/** 检索结果的排序方式。 */
export type SearchSort = 'relevance' | 'publishedAt' | 'credibility'

/** 时间区间。 */
export interface TimeRange {
  /** ISO 8601 或历史纪年文本（如「清光绪年间」）。 */
  from?: string
  to?: string
}

/* ---------------- POST /sources/search ---------------- */

export interface SearchSourcesRequest extends PageQuery {
  /** 关键词列表（AND 语义，TODO-SEARCH-1 待确认）。 */
  keywords: string[]
  /** 按结构化实体过滤。 */
  entityIds?: string[]
  /** 地点 / 人物 / 事件的自由输入（与 entityIds 取并集）。 */
  places?: string[]
  persons?: string[]
  events?: string[]
  timeRange?: TimeRange
  /** 来源类型过滤。 */
  sourceTypes?: SourceType[]
  /** 可信度过滤。 */
  credibility?: CredibilityLevel[]
  /** 是否启用 AI 智能扩展检索词。 */
  enableQueryExpansion: boolean
  /** 是否启用 AI 相关度重排。 */
  enableReRank: boolean
}

/** AI 扩展出的检索词。 */
export interface ExpandedKeyword {
  term: string
  /** 扩展权重 0~1。 */
  weight: number
  /** 扩展理由，例如「『三坊巷』为『三坊七巷』的民国旧称」。 */
  reason: string
  /** 该词命中的结果数（后端预统计）。 */
  hitCount: number
}

/** 一条检索命中。 */
export interface SearchHit {
  sourceId: string
  title: string
  /** 出版方 / 收藏机构。 */
  publisher: string
  sourceType: SourceType
  credibility: CredibilityLevel
  /** 可信度分值 0~1，用于排序与展示。 */
  credibilityScore: number
  /** ISO 8601 或历史纪年文本。 */
  publishedAt: string
  /** 原文摘录。 */
  excerpt: string
  /** 命中的高亮片段。 */
  highlights: string[]
  /** 相关度得分 0~1。 */
  score: number
  /** 定位信息。 */
  locator: { page?: number; line?: number; url?: string; callNumber?: string }
  /** 关联到本次采访的实体 id。 */
  relatedEntityIds: string[]
  /** 关联线索（可继续跳转）。 */
  relatedLeadIds: string[]
  /** 是否已被引用到草稿。 */
  cited: boolean
}

/** 关联线索：引导用户继续深挖。 */
export interface RelatedLead {
  id: string
  title: string
  kind: 'entity' | 'source' | 'interview' | 'event'
  hint: string
  confidence: number
}

/** 分面统计，用于筛选栏展示数量。 */
export interface SearchFacet {
  field: 'sourceType' | 'credibility' | 'decade'
  buckets: Array<{ value: string; label: string; count: number }>
}

export interface SearchSourcesResponse {
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  hits: SearchHit[]
  /** AI 扩展出的检索词（enableQueryExpansion=true 时）。 */
  expandedKeywords: ExpandedKeyword[]
  facets: SearchFacet[]
  leads: RelatedLead[]
  /** 耗时（毫秒）。 */
  tookMs: number
  aiMeta?: AiMeta
}

/* ---------------- GET /sources/{sourceId} ---------------- */

export interface GetSourceDetailResponse {
  source: SearchHit
  /** 完整摘录（可能远长于 excerpt）。 */
  fullExcerpt: string
  /** 引用信息（GB/T 7714 风格）。 */
  citation: string
  relatedSources: SearchHit[]
  leads: RelatedLead[]
}
```

### `src/types/api/transcribe.ts`

```ts
/**
 * 流程 2：转写并支持人工校正 —— 接口契约。
 */
import type { AiMeta, OperatorInfo, VersionRef } from './common'

/** 转写视图模式。 */
export type TranscriptViewMode = 'timeline' | 'paragraph'

/** 单个转写片段。 */
export interface TranscriptSegmentDTO {
  id: string
  /** 从 0 开始的顺序号。 */
  index: number
  startMs: number
  endMs: number
  speaker: string
  /** 当前版本的文本（可能已被人工校正）。 */
  text: string
  /** AI 原始文本，用于版本对比时显示「原本写了什么」。 */
  originalText: string
  /** 0~1 置信度。 */
  confidence: number
  /** 是否低于阈值（由后端按 threshold 计算，前端不重复判断）。 */
  lowConfidence: boolean
  /** 人工是否已校正该片段。 */
  edited: boolean
  /** 校正人。 */
  editedBy?: OperatorInfo
  /** ISO 8601 校正时间。 */
  editedAt?: string
  /** 词级时间戳，用于更细粒度的对齐（可选）。 */
  words?: Array<{ text: string; startMs: number; endMs: number }>
}

/** 段落视图：把若干片段合并为一段，供「段落」视图切换。 */
export interface TranscriptParagraphDTO {
  id: string
  speaker: string
  startMs: number
  endMs: number
  segmentIds: string[]
  text: string
  /** 该段落中的低置信度片段数。 */
  lowConfidenceCount: number
}

/* ---------------- POST /transcripts:start ---------------- */

export interface StartTranscribeRequest {
  interviewId: string
  /** BCP 47，例如 'zh-CN'。 */
  language: string
  /** 是否启用说话人分离。 */
  enableDiarization: boolean
  /** 领域词表，提升方言与专有名词识别率。 */
  vocabularyHints?: string[]
  /** 期望模型档位。 */
  modelHint?: 'fast' | 'balanced' | 'accurate'
  operator: OperatorInfo
}

export interface StartTranscribeResponse {
  taskId: string
  transcriptId: string
  status: 'queued' | 'running'
  /** 预估耗时（毫秒）。 */
  estimatedMs: number
  aiMeta: AiMeta
}

/* ---------------- GET /transcripts/{transcriptId} ---------------- */

export interface GetTranscriptResponse {
  transcriptId: string
  interviewId: string
  language: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'
  segments: TranscriptSegmentDTO[]
  paragraphs: TranscriptParagraphDTO[]
  /** 当前版本。 */
  version: VersionRef
  /** 低置信度阈值（0~1），后端下发以便与前端标记一致。 */
  lowConfidenceThreshold: number
  lowConfidenceCount: number
  editedCount: number
  aiMeta: AiMeta
  /** 任务失败时的原因。 */
  failureReason?: string
}

/* ---------------- POST /transcripts/{id}/corrections ---------------- */

export interface SegmentCorrection {
  segmentId: string
  /** 校正后的文本。 */
  text: string
  speaker?: string
  /** 校正原因，便于后续训练与审计。 */
  reason?: string
  /** 该校正是否来自 AI 建议。 */
  fromAiSuggestion?: boolean
}

export interface SubmitCorrectionRequest {
  transcriptId: string
  /** 基于哪个版本修改，用于乐观锁冲突检测。 */
  baseVersionId: string
  editor: OperatorInfo
  corrections: SegmentCorrection[]
  /** true 时仅存草稿，不生成新版本。 */
  saveAsDraft: boolean
  note?: string
}

export interface SubmitCorrectionResponse {
  versionId: string
  versionNo: number
  savedAt: string
  changedCount: number
  lowConfidenceRemaining: number
  /** 基于 baseVersionId 的冲突提示（乐观锁）。 */
  conflict?: { conflictSegmentIds: string[]; message: string } | null
}

/* ---------------- POST /transcripts/{id}/suggestions ---------------- */

export interface CorrectionSuggestion {
  segmentId: string
  originalText: string
  suggestedText: string
  /** AI 对建议本身的置信度 0~1。 */
  confidence: number
  /** 建议类型：错别字 / 方言用字 / 专有名词 / 断句。 */
  category: 'typo' | 'dialect' | 'proper_noun' | 'segmentation' | 'other'
  reason: string
  /** 命中的地方词表条目。 */
  glossaryHit?: string
}

export interface SuggestCorrectionsResponse {
  transcriptId: string
  suggestions: CorrectionSuggestion[]
  /** 建议所依据的模型与词表版本。 */
  aiMeta: AiMeta
  glossaryVersion: string
}

/* ---------------- 版本 ---------------- */

export interface TranscriptVersionRecord extends VersionRef {
  /** 版本来源：AI 初稿 / 人工校正 / 回滚。 */
  source: 'ai' | 'human' | 'rollback'
  changedCount: number
}

export interface TranscriptVersionListResponse {
  transcriptId: string
  versions: TranscriptVersionRecord[]
  currentVersionId: string
}

export interface RollbackTranscriptRequest {
  transcriptId: string
  targetVersionId: string
  operator: OperatorInfo
  note?: string
}

export interface RollbackTranscriptResponse {
  transcriptId: string
  currentVersionId: string
  versionNo: number
  segments: TranscriptSegmentDTO[]
}
```

### `src/types/api/upload.ts`

```ts
/**
 * 流程 1：上传已授权采访录音 —— 接口契约。
 */
import type { AiMeta, ConfirmStatus, OperatorInfo, RemoteTaskStatus } from './common'

/** 允许的音频格式（与后端白名单保持一致，TODO-UP-1 待确认最终清单）。 */
export type AudioFormat = 'mp3' | 'wav' | 'm4a' | 'aac' | 'flac' | 'ogg'

/** 授权类型。口述史项目必须逐条确认授权范围。 */
export type LicenseType =
  | 'public' // 公开授权，可对外发布
  | 'research_only' // 仅研究使用，不得公开发布
  | 'internal' // 仅项目内部使用
  | 'limited_time' // 限时授权，到期需重新确认

/** 授权确认状态。 */
export type LicenseStatus = ConfirmStatus

/** 上传约束。前端用它做格式与大小前置校验，避免无效上传。 */
export interface UploadConstraints {
  allowedFormats: AudioFormat[]
  /** 单文件大小上限（字节）。 */
  maxSizeBytes: number
  /** 单条录音时长上限（毫秒）。 */
  maxDurationMs: number
  /** 最短时长，过短视为无效录音。 */
  minDurationMs: number
  /** 分片大小（字节）。 */
  chunkSizeBytes: number
}

/** 同名 / 重复文件命中结果。 */
export interface DuplicateHit {
  interviewId: string
  title: string
  fileName: string
  /** ISO 8601。 */
  uploadedAt: string
  uploadedBy: OperatorInfo
  /** 内容指纹相似度 0~1。 */
  similarity: number
  /** 后端建议：跳过 / 覆盖 / 仍然新建。 */
  suggestion: 'skip' | 'overwrite' | 'create_new'
}

/* ---------------- POST /interviews/uploads:init ---------------- */

export interface UploadInitRequest {
  title: string
  /** 讲述人姓名。 */
  narrator: string
  interviewer: string
  fileName: string
  sizeBytes: number
  mimeType: string
  /** 前端预读的时长（毫秒），浏览器不支持时传 undefined。 */
  durationMs?: number
  /** 内容指纹（如 sha256 前 16 位），用于重复检测。 */
  checksum?: string
  /** ISO 8601 采录日期。 */
  recordedAt: string
  /** 采录地点，例如「三坊七巷·水榭戏台」。 */
  recordedPlace: string
  /** 采录语言/方言，例如 '闽东语·福州话'。 */
  dialect?: string
  /** 项目归属。 */
  projectId?: string
  /** 授权类型（此时仅为声明，最终以授权确认为准）。 */
  licenseType: LicenseType
}

export interface UploadInitResponse {
  uploadId: string
  interviewId: string
  /** 后端下发的分片大小（字节），可能覆盖前端默认值。 */
  chunkSizeBytes: number
  totalChunks: number
  /** 预签名直传地址（若后端采用直传方案，TODO-UP-2 待确认）。 */
  chunkUrls?: string[]
  /** ISO 8601 上传会话过期时间。 */
  expiresAt: string
  /** 命中重复文件时返回，前端需弹窗让用户选择。 */
  duplicate?: DuplicateHit | null
  constraints: UploadConstraints
}

/* ---------------- POST /interviews/uploads/{uploadId}/chunks ---------------- */

export interface ChunkUploadRequest {
  uploadId: string
  chunkIndex: number
  totalChunks: number
  /** 分片校验和，用于服务端校验完整性。 */
  checksum?: string
  /** 分片二进制。真实实现为 multipart/form-data 或直传。 */
  blob?: Blob
}

export interface ChunkUploadResponse {
  uploadId: string
  chunkIndex: number
  /** 累计已接收分片数。 */
  received: number
  total: number
  /** 0~1。 */
  progress: number
  uploadedBytes: number
  /** 预估剩余时间（毫秒），无法估算时为 null。 */
  remainingMs: number | null
}

/* ---------------- GET /interviews/uploads/{uploadId} ---------------- */

export interface UploadStatusResponse {
  uploadId: string
  status: RemoteTaskStatus | 'merging'
  uploadedBytes: number
  totalBytes: number
  /** 0~1。 */
  progress: number
  remainingMs: number | null
  /** 失败的分片下标，前端据此做断点重传。 */
  failedChunks: number[]
  message?: string
}

/* ---------------- POST /interviews/uploads/{uploadId}:complete ---------------- */

export interface UploadCompleteResponse {
  interviewId: string
  audioUrl: string
  durationMs: number
  status: RemoteTaskStatus
  licenseStatus: LicenseStatus
}

/* ---------------- POST /interviews/{interviewId}/license ---------------- */

export interface LicenseConfirmRequest {
  interviewId: string
  decision: 'confirmed' | 'rejected'
  licenseType: LicenseType
  /** 授权人（讲述人或其代理人）。 */
  signer: string
  /** ISO 8601 签署时间。 */
  signedAt: string
  note?: string
  /** 授权书扫描件地址。 */
  attachments?: string[]
  operator: OperatorInfo
}

export interface LicenseConfirmResponse {
  interviewId: string
  licenseStatus: LicenseStatus
  licenseType: LicenseType
  confirmedBy?: string
  confirmedAt?: string
  /** 授权凭证编号。 */
  certificateNo?: string
  aiMeta?: AiMeta
}

/* ---------------- GET /interviews ---------------- */

export interface InterviewSummary {
  interviewId: string
  title: string
  narrator: string
  interviewer: string
  recordedAt: string
  recordedPlace: string
  durationMs: number
  fileName: string
  format: AudioFormat
  sizeBytes: number
  licenseStatus: LicenseStatus
  licenseType: LicenseType
  /** 已推进到的流程编号 1~7。 */
  stage: number
  createdAt: string
}

export interface InterviewListResponse {
  list: InterviewSummary[]
  total: number
}
```

### `src/types/domain.ts`

```ts
/**
 * 领域模型定义。
 *
 * 约定：所有时间统一使用毫秒（number，整数），所有日期使用 ISO 8601 字符串。
 * 前端不假设后端字段命名，本文件的类型即为前后端契约的**单一事实来源**。
 */

/** 来源类型。用于来源标签配色、筛选与图标。 */
export type SourceKind = 'interview' | 'document' | 'dataset' | 'media' | 'official'

/** 来源在原始载体中的定位信息。字段可选，取决于来源类型。 */
export interface SourceLocator {
  /** 文档页码。 */
  page?: number
  /** 原始链接。 */
  url?: string
  /** 音视频时间点（毫秒）。 */
  timecodeMs?: number
  /** 文档行号或表格行号。 */
  line?: number
}

/** 来源标签。审校过程中所有结论都可回溯到若干 SourceTag。 */
export interface SourceTag {
  id: string
  /** 展示名，短。 */
  label: string
  kind: SourceKind
  /** 发布方 / 提供方。 */
  publisher: string
  /** ISO 8601 日期。 */
  publishedAt: string
  /** 可信度 0~1，由检索或人工标注给出。 */
  confidence: number
  /** 是否已人工核实。 */
  verified: boolean
  /** 摘要原文片段，用于悬浮提示与检索结果展示。 */
  excerpt: string
  locator: SourceLocator
}

/** 论断核查结论。 */
export type ClaimVerdict = 'supported' | 'partial' | 'contradicted' | 'unverified'

/** 待核查的论断。 */
export interface Claim {
  id: string
  text: string
  /** 论断提出者，例如受访人。 */
  speaker?: string
  /** 已关联的来源 id。 */
  sourceIds: string[]
}

/** 单条论断的核查评估结果（compare_claims 的产出单元）。 */
export interface ClaimAssessment {
  claimId: string
  verdict: ClaimVerdict
  /** 0~1。 */
  confidence: number
  rationale: string
  supportingSourceIds: string[]
  contradictingSourceIds: string[]
}

/** 转写文本片段。音频文本联动的最小单元。 */
export interface TranscriptSegment {
  id: string
  /** 相对音频起点的起始时间（毫秒）。 */
  startMs: number
  /** 结束时间（毫秒），恒大于 startMs。 */
  endMs: number
  speaker: string
  text: string
  /** 该片段涉及的论断 id。 */
  claimIds: string[]
  /** 该片段引用的来源 id。 */
  sourceIds: string[]
}

/** 一份完整转写稿。 */
export interface Transcript {
  id: string
  title: string
  /** 音频地址；支持静态资源路径或 blob: URL。 */
  audioUrl: string
  /** BCP 47，例如 zh-CN。 */
  language: string
  segments: TranscriptSegment[]
}

/** 审校单元状态。 */
export type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'flagged'

/** 批注严重级别。 */
export type AnnotationSeverity = 'info' | 'warning' | 'critical'

/** 审校批注。 */
export interface Annotation {
  id: string
  author: string
  /** ISO 8601 时间戳。 */
  createdAt: string
  severity: AnnotationSeverity
  body: string
  status: ReviewStatus
}

/** 审校单元：原文与修订稿成对出现，是审校对照视图的数据单元。 */
export interface ReviewUnit {
  id: string
  /** 对应的转写片段 id，用于反向定位音频。 */
  segmentId: string
  original: string
  revised: string
  status: ReviewStatus
  annotations: Annotation[]
  claimIds: string[]
}

/** 故事卡时间线条目。 */
export interface StoryTimelineEntry {
  id: string
  /** ISO 8601 时间戳。 */
  at: string
  title: string
  detail: string
}

/** 故事卡：由若干已核查论断聚合而成的可发布结构。 */
export interface StoryCard {
  id: string
  headline: string
  summary: string
  timeline: StoryTimelineEntry[]
  keyClaimIds: string[]
  sourceIds: string[]
  /** 发布风险等级。 */
  riskLevel: 'low' | 'medium' | 'high'
  /** ISO 8601 时间戳。 */
  generatedAt: string
}
```

### `src/types/tools.ts`

```ts
/**
 * 四个工具的调用契约。
 *
 * 这些类型是前端与工具实现之间唯一的约定层：
 * - `services/mock` 用它构造假数据；
 * - `services/http` 用它做 DTO 映射（字段名待后端确认，见该文件 TODO）。
 *
 * 组件不得直接引用本文件的 Input/Output 类型以外的工具细节。
 */
import type {
  Annotation,
  Claim,
  ClaimAssessment,
  ClaimVerdict,
  ReviewStatus,
  SourceKind,
  SourceTag,
  StoryCard,
} from './domain'

/** 工具名联合类型。新增工具时必须同时扩展 ToolContract。 */
export type ToolName =
  'retrieve_local_sources' | 'compare_claims' | 'build_story_card' | 'submit_review'

/* ------------------------------------------------------------------ */
/* 1. retrieve_local_sources                                          */
/* ------------------------------------------------------------------ */

export interface RetrieveLocalSourcesInput {
  /** 检索词，支持空格分隔的多关键词。 */
  query: string
  /** 仅检索这些类型；不传表示不过滤。 */
  kinds?: SourceKind[]
  /** 返回条数上限，默认 10。 */
  limit?: number
  /** 可信度下限 0~1，默认 0。 */
  minConfidence?: number
}

/** 单条检索命中。 */
export interface RetrievedSource {
  source: SourceTag
  /** 相关性得分，0~1，降序返回。 */
  score: number
  /** 命中的关键词，用于结果高亮。 */
  matchedTerms: string[]
}

export interface RetrieveLocalSourcesOutput {
  query: string
  /** 命中总数（不受 limit 影响）。 */
  total: number
  items: RetrievedSource[]
  /** 服务端耗时（毫秒）。 */
  tookMs: number
}

/* ------------------------------------------------------------------ */
/* 2. compare_claims                                                  */
/* ------------------------------------------------------------------ */

export interface CompareClaimsInput {
  /** 待核查论断 id。 */
  claimIds: string[]
  /**
   * 论断正文。当论断尚未持久化（例如用户在编辑器中临时新增）时，
   * 与 claimIds 一起提交，由工具决定以哪份为准。
   */
  claims?: Claim[]
  /** 严格模式：证据不足时直接判定为 unverified 而非 partial。 */
  strictMode?: boolean
}

export interface CompareClaimsOutput {
  assessments: ClaimAssessment[]
  summary: Record<ClaimVerdict, number>
  tookMs: number
}

/* ------------------------------------------------------------------ */
/* 3. build_story_card                                                */
/* ------------------------------------------------------------------ */

export interface BuildStoryCardInput {
  /** 拟定标题。 */
  title: string
  /** 纳入故事卡的关键论断 id。 */
  claimIds: string[]
  /** 允许引用的来源 id，用于约束引用范围。 */
  sourceIds: string[]
  tone?: 'neutral' | 'alert'
}

export interface BuildStoryCardOutput {
  card: StoryCard
  /** 因证据不足未被采纳的论断 id，供前端提示。 */
  omittedClaimIds: string[]
}

/* ------------------------------------------------------------------ */
/* 4. submit_review                                                   */
/* ------------------------------------------------------------------ */

/** 单个审校单元的提交决议。 */
export interface ReviewDecisionInput {
  unitId: string
  status: Exclude<ReviewStatus, 'pending'>
  /** 提交时附带的说明。 */
  note?: string
  /** 本次提交新增的批注。 */
  annotations?: Omit<Annotation, 'id' | 'createdAt'>[]
}

export interface SubmitReviewInput {
  reviewId: string
  reviewer: string
  decisions: ReviewDecisionInput[]
  /** 整单评论。 */
  comment?: string
}

export interface SubmitReviewOutput {
  receiptId: string
  reviewId: string
  /** ISO 8601 时间戳。 */
  submittedAt: string
  accepted: number
  rejected: number
  flagged: number
  status: 'queued' | 'committed'
}

/* ------------------------------------------------------------------ */
/* 契约表                                                              */
/* ------------------------------------------------------------------ */

/** 工具名 → 入参/出参 的映射。ToolTransport 与 ToolClient 都基于它做类型推导。 */
export interface ToolContract {
  retrieve_local_sources: {
    input: RetrieveLocalSourcesInput
    output: RetrieveLocalSourcesOutput
  }
  compare_claims: {
    input: CompareClaimsInput
    output: CompareClaimsOutput
  }
  build_story_card: {
    input: BuildStoryCardInput
    output: BuildStoryCardOutput
  }
  submit_review: {
    input: SubmitReviewInput
    output: SubmitReviewOutput
  }
}

/* ------------------------------------------------------------------ */
/* 错误与结果统一包装                                                  */
/* ------------------------------------------------------------------ */

export type ToolErrorCode =
  'network' | 'timeout' | 'invalid_input' | 'not_found' | 'server' | 'cancelled' | 'unknown'

/** 归一化后的工具错误。所有失败路径都必须收敛到这个形状。 */
export interface ToolError {
  tool: ToolName | 'unknown'
  code: ToolErrorCode
  /** 可直接展示给用户的中文描述。 */
  message: string
  /** 是否值得重试（network / timeout / server 为 true）。 */
  retryable: boolean
  /** 原始错误细节，仅用于日志。 */
  details?: Record<string, unknown>
}

/** 工具调用结果。调用方必须先判 ok 再取 data。 */
export type ToolResult<T> =
  { ok: true; data: T; tookMs: number } | { ok: false; error: ToolError; tookMs: number }

/**
 * 便捷判定：非空结果。
 * @param result 待判断的工具调用结果
 * @returns 是否为成功结果；为真时可安全访问 data
 */
export function isToolOk<T>(
  result: ToolResult<T>,
): result is { ok: true; data: T; tookMs: number } {
  return result.ok
}
```


<!-- END GENERATED: models -->

---

## 九、四工具契约（通路 B）

四处工具是「AI 能力」的另一种调用形态，前端已有类型化门面与调用面板。**先确认是否需要（D-01）**，再实现。

| 工具名 | 用途 | 入参要点 | 出参要点 | 前端调用位置 |
| --- | --- | --- | --- | --- |
| `retrieve_local_sources` | 按关键词检索本地资料库 | `query` / `kinds?` / `limit?`（默认 10）/ `minConfidence?`（默认 0） | `query` / `total`（不受 limit 影响）/ `items[]{ source, score, matchedTerms }` / `tookMs` | 流程 4 |
| `compare_claims` | 逐条核查论断 | `claimIds[]` / `claims?`（未持久化的正文）/ `strictMode?`（证据不足直接判 unverified） | `assessments[]` / `summary`（按判定计数）/ `tookMs` | 流程 5 |
| `build_story_card` | 把已确认论断聚合成可发布结构 | `title` / `claimIds[]` / `sourceIds[]`（约束引用范围）/ `tone?` | `card` / `omittedClaimIds[]`（因证据不足被丢弃的论断，**必须返回**，否则用户不知道故事卡为什么少了内容） | 流程 5、6 |
| `submit_review` | 提交审校决议 | `reviewId` / `reviewer` / `decisions[]{ unitId, status, note?, annotations? }` / `comment?` | `receiptId` / `submittedAt` / `accepted` / `rejected` / `flagged` / `status`（`queued|committed`） | 流程 5、7 |

**统一返回形状**（前端强制遵守，后端请照此返回）：

```ts
type ToolResult<T> =
  | { ok: true;  data: T;          tookMs: number }
  | { ok: false; error: ToolError; tookMs: number }

interface ToolError {
  tool: ToolName | 'unknown'
  code: 'network' | 'timeout' | 'invalid_input' | 'not_found' | 'server' | 'cancelled' | 'unknown'
  message: string      // 可直接展示给用户的中文
  retryable: boolean   // network / timeout / server 为 true
  details?: Record<string, unknown>   // 仅用于日志
}
```

调用方式：`POST /tools/{toolName}`（占位，路径与字段名待确认，见 `services/http/httpTransport.ts`）。

---

## 十、Mock 数据说明与联调注意事项

### 10.1 mock 分布在哪

| 层 | 位置 | 后端就绪后 |
| --- | --- | --- |
| 数据与状态 | `src/mock/dataset.ts`（演示数据）、`store.ts`（可变状态）、`scenario.ts`（场景） | 可整体删除 |
| REST 接口的 mock | **各接口文件内的 `mock:` resolver**，例如 `src/api/upload.ts` 里每个方法都带一个 `mock` | 可删，但**建议保留**用于回归 |
| 工具层 mock | `src/services/mock/mockTransport.ts`、`random.ts` | 同上 |

### 10.2 6 种 mock 场景

| 场景 | 效果 | 对应界面状态 |
| --- | --- | --- |
| `normal` 成功 | 返回正常数据 | success |
| `empty` 空数据 | 返回空列表，验证空状态 | empty |
| `failure` 失败 | 抛可重试错误（**第 1 次失败、重试即成功**，用于走通「失败→重试中→成功」） | error → retrying → success |
| `slow` 加载中 | 延迟 ×5，验证骨架屏 | loading |
| `unavailable` 不可用 | 抛不可重试错误（503 / `CAPABILITY_OFFLINE`） | unavailable |
| `needsConfirm` 需人工确认 | 返回待确认标记 | confirm |

**切换方式**：报头右侧 **「开发者」** 开关 → Mock 场景下拉（默认收起，避免干扰使用者）。
失败场景的实现细节：同一接口第 1 次抛「AI 服务返回 500（首次失败，重试可成功）」，第 2 次返回正常数据（`mock/scenario.ts` 的 `nextAttempt()`）。

### 10.3 联调 checklist

1. `.env.local` 里 `VITE_USE_MOCK=false`，`VITE_API_BASE_URL` 指向你的服务；
2. 先确认 **CORS**：开发地址是 `http://localhost:5174`，需要允许该 origin；
3. 打开浏览器控制台 Network，逐个接口对照 §7 的**请求字段表**——前端发出的键名就是表里的键名；
4. 检查响应是否符合 §4.1 信封与 §4.2 分页；
5. 故意让一个接口返回 500、一个返回 503、一个返回空数组，确认界面分别显示 **失败（可重试）/ 不可用 / 空数据**——这三个状态最容易接错；
6. 让一个 AI 接口返回 `needsHumanConfirm: true`，确认进入 **需人工确认** 态；
7. 确认所有 AI 响应都带 `AiMeta`（`model` / `modelVersion` / `confidence` / `generatedAt` / `tookMs`），流程 2、3 会直接展示这些值；
8. 检查 `traceId` 是否返回（报错时需要）；
9. 每接好一个流程跑一次 `pnpm smoke`，确认前端调用路径未被改坏；
10. 上传链路请优先联调（它依赖 D-04 的协议决定，是唯一需要前端改代码的部分）。

---

## 十一、待确认事项

### 11.0 来自接口目录的全部待确认项（自动生成）

<!-- BEGIN GENERATED: todos -->

共 **28 项**，按端点归类。

| 端点 | 用途 | 待确认内容 |
| --- | --- | --- |
| `upload.init` | 初始化上传 | TODO-UP-2：分片是直传（预签名 URL）还是后端转发，直接影响前端进度计算方式。 |
| `upload.init` | 初始化上传 | TODO-UP-1：允许格式白名单最终以哪份清单为准（当前为 mp3/wav/m4a/aac/flac/ogg）。 |
| `upload.init` | 初始化上传 | 重复判定依据是文件名、指纹还是两者结合？ |
| `upload.chunk` | 上传分片 | 分片失败时后端返回什么错误结构？前端需要据此做单分片重传。 |
| `upload.status` | 查询上传状态 | 是否需要服务端主动推送（SSE/WebSocket）替代轮询？轮询间隔待定。 |
| `upload.license` | 提交授权确认 | TODO-AUTH-4：授权书文件是否走同一套上传会话？ |
| `upload.list` | 采访列表 | 是否需要服务端分页与筛选（按讲述人 / 授权状态 / 流程阶段）？ |
| `transcribe.start` | 发起转写 | TODO-ASR-1：任务是轮询还是支持 SSE 推送？轮询间隔与最大时长待定。 |
| `transcribe.get` | 拉取转写结果 | TODO-ASR-2：低置信度是后端标记还是前端按阈值计算？当前约定后端标记、前端只展示。 |
| `transcribe.get` | 拉取转写结果 | 词级时间戳（words）是否一定返回？决定文本高亮粒度。 |
| `transcribe.suggestions` | 获取校正建议 | 词表由后端维护还是前端配置？当前 mock 在前端。 |
| `transcribe.corrections` | 保存校正 | TODO-CONFLICT-1：版本冲突时后端是自动合并还是直接拒绝？前端目前按「拒绝并提示刷新」处理。 |
| `transcribe.rollback` | 回滚版本 | 回滚是「恢复到旧内容并新建版本」还是「删除中间版本」？当前按前者实现。 |
| `extract.get` | 拉取抽取结果 | 同义项分组由后端算还是前端算？当前 mock 在前端按名称相似度计算。 |
| `extract.delete` | 删除实体 | 删除是软删除还是硬删除？审计要求待确认。 |
| `extract.merge` | 合并同义项 | 合并是否可撤销？若需要，后端应保留合并前后的实体快照。 |
| `search.sources` | 组合检索资料 | TODO-SEARCH-1：多关键词是 AND 还是 OR？是否支持引号短语与排除词语法？ |
| `search.sources` | 组合检索资料 | 扩展词与重排是否计费/限流？需要前端做节流提示。 |
| `search.detail` | 资料详情 | 受版权限制的资料，后端是否返回全文？前端需按授权范围降级展示。 |
| `compare.start` | 发起比对 | AI 初判是否允许「弃权」（insufficient）？前端已按四态渲染。 |
| `compare.annotations` | 提交标注 | 增量保存的频率上限？是否需要防抖与并发合并策略？ |
| `generate.create` | 生成初稿 | TODO-GEN-1：生成是同步返回还是异步任务？长文可能超时，需确认是否走任务轮询。 |
| `generate.create` | 生成初稿 | 引用角标编号由后端给定还是前端渲染时生成？当前约定后端给定。 |
| `generate.save` | 保存草稿 | 是否需要自动保存（如每 30 秒）？届时 createVersion 应固定为 false。 |
| `publish.transition` | 状态流转 | TODO-WF-1：状态机的合法流转表需与后端完全对齐（当前定义见 src/api/publish.ts 的 TRANSITIONS）。 |
| `publish.transition` | 状态流转 | 并发流转冲突的返回码与结构待确认。 |
| `publish.riskCheck` | AI 风险检查 | 风险项是否允许「忽略并说明」？当前设计为必须逐条确认知晓（acknowledged）。 |
| `publish.rollback` | 回滚版本 | 已发布内容回滚后，线上是否立即下线？需要与后端确认缓存刷新策略。 |

<!-- END GENERATED: todos -->

### 11.1 需要后端决策的关键项与建议处理方式

| 编号 | 待确认 | 前端现状 | 建议处理方式 |
| --- | --- | --- | --- |
| **D-01** | 通路 A（REST）还是 B（四工具契约）？ | 两条都在跑，业务流程以 A 为主 | **只实现 A**，除非后端是 Agent/工具平台；若选 B，前端会把 33 个 REST 调用改为工具调用 |
| **D-02** | 响应信封与错误体的字段名 | 兼容 `code/success/message/msg/data/traceId/requestId`，成功码兼容 `0/200/OK/SUCCESS/缺省` | 直接沿用现有兼容集即可零改动；若不同，请给出**一个真实响应样例**，前端在 `unwrapEnvelope` 与 `normalize` 里收敛 |
| **D-03** | 分页字段名与起始页码 | 期望 `{{ list, total, page, pageSize, hasMore }}`，`page` 从 1 开始 | 若用 `records/size/current/pages`，请告知，前端加一层映射 |
| **D-04** | 上传协议：预签名直传 or 后端转发？分片如何传字节？ | **只发 `{ chunkIndex, totalChunks }`，没有真实字节** | 二选一并给出：预签名 URL 获取方式 + 分片 PUT 约定；或后端转发时的 `multipart/form-data` 字段名。**这是唯一需要前端改代码的 P0 项** |
| **D-05** | 任务进度：轮询还是 SSE？间隔？ | 未实现，进度是前端模拟 | 建议：短任务（<10s）同步返回；长任务返回 `taskId` + 轮询（间隔 1~2s，带最大时长与退避），前端已预留 `taskId` 字段 |
| **D-06** | 鉴权方案 | 仅占位：localStorage + Bearer + 演示 token | 建议 Bearer JWT，给出登录/登出/刷新三个接口；若用 httpOnly Cookie，需去掉前端的 token 注入并加 CSRF 处理 |
| **D-07** | 是否需要权限模型（RBAC）？ | `role` 仅展示用，前端不做鉴权 | 若需要，请给出「角色 → 可执行动作」矩阵；建议由后端在接口层拒绝，前端只做按钮置灰 |
| **D-08** | 哪些 `POST` 不幂等？ | 默认自动重试 2 次 | 给出清单，前端为这些接口设 `maxRetries: 0`，或后端支持 `Idempotency-Key` |
| **D-09** | 乐观锁冲突的语义 | 流程 7 提交带 `expectedFrom`，冲突按「拒绝 + 提示刷新」 | 明确冲突错误码/HTTP 状态；若要自动合并请说明 |
| **D-10** | 音频时间码与置信度口径 | 流程 2 展示后端返回的 `lowConfidenceThreshold`，前端不重复判断 | 明确 `startMs/endMs` 单位（毫秒）与是否含端点；明确阈值由谁计算 |

---

## 十二、已知问题与风险点

| # | 问题 | 影响 | 建议 |
| --- | --- | --- | --- |
| 1 | **本仓库未初始化 git** | 所有改动无法回滚；协作困难 | 立即 `git init` 并提交基线 |
| 2 | **无单元测试 / E2E** | 重构无回归保护（本次拆分了 6 个大型视图共 106 个新文件） | 优先补关键路径的组件测试；短期靠 `pnpm smoke` + 手工核对 |
| 3 | **`Flow1UploadView.vue` 995 行** | 其余 6 个视图已拆到 ~450 行，仅此一个仍偏大 | 按同一约定拆分（已有 `components/flowN/` 先例） |
| 4 | **双通路并存（D-01）** | 后端可能做了两套 | 先决策，再删未用通路 |
| 5 | **mock 通过 ≠ 联调通过** | mock 数据字段齐全，后端若缺字段，前端不会报错，只会显示为空 | 逐接口对照 §7 字段表；对关键接口加 `normalize()` 兜底 |
| 6 | **空数据被误判为失败** | 后端对「无结果」返回 404 会让界面显示**失败**而非**空数据** | 无结果请返回 `200 + 空数组` |
| 7 | **自动重试可能重复提交** | 见 D-08 | 给出非幂等清单或支持幂等键 |
| 8 | **默认超时 15s 对 AI 接口偏短** | ASR/长文生成会触发超时与重试 | 长任务改异步（D-05），不要靠调大超时 |
| 9 | **TS 类型在运行时不生效** | 字段名不一致不会报错，只会静默变空 | 联调时以 Network 面板的实际响应为准核对 |
| 10 | **本文档 §7 的字段表是「前端假设」** | 不是后端已实现契约 | 逐条确认后回写 `endpointCatalog.ts` 并重新生成文档 |

---

## 附：文档维护

```bash
pnpm docs:handoff   # 重新生成 §5.0 / §7 / §8 / §11.0（由代码派生，勿手工编辑这三节）
pnpm docs:api       # 重新生成 docs/API-CONTRACT.md（更详细的字段表版本）
```

改接口的正确顺序：先改 `src/api/endpointCatalog.ts` 与 `src/types/api/*.ts` → 再改 `src/api/*.ts` → 跑 `pnpm typecheck`、`pnpm smoke` → 最后跑 `pnpm docs:handoff`。


