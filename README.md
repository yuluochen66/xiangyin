# 乡音有据 · 福州地方文化口述整理与共创智能体（前端原型）

纯前端高保真原型。技术栈限定为 **Vue 3 + TypeScript + Vite + Tailwind CSS v4**，
不引入任何额外运行时依赖（无 vue-router / pinia / axios / 图标库）。

产品目标：解决福州地方文化资料分散、口述材料难以整理，以及 **AI 创作容易混淆传说、个人记忆与史实** 的问题。
原型把这三类内容拆成可标注、可回溯、可拦截的数据节点，并让 AI 能力嵌在流程的关键环节，而不是独立成一个模块。

---

## 一、快速开始

```bash
pnpm install
pnpm dev           # 默认 http://localhost:5174
pnpm typecheck     # vue-tsc 类型检查
pnpm lint          # ESLint（正确性 + Vue 语义规则）
pnpm format:check  # Prettier 格式检查
pnpm build         # 类型检查 + 生产构建
```

代码规范工具链：**ESLint 9（扁平配置）+ Prettier 3 + EditorConfig**，配置文件为
`eslint.config.js` / `.prettierrc.json` / `.editorconfig`。
分工是 ESLint 管正确性、Prettier 管格式，两者用 `eslint-config-prettier` 解耦，不会互相打架。
当前状态：`pnpm lint` 与 `pnpm format:check` 均为 0 问题。

默认 `VITE_USE_MOCK=true`，**无需后端即可完整运行全部 7 个流程**。
要接真实后端：复制 `.env.example` 为 `.env.local`，把 `VITE_USE_MOCK` 改为 `false` 并配置 `VITE_API_BASE_URL`。

### 校验脚本

```bash
pnpm docs:api   # 由 src/api/endpointCatalog.ts 生成 docs/API-CONTRACT.md（勿手工编辑该文档）
pnpm smoke      # Mock 接口层端到端冒烟测试：真实执行 src/api/*，覆盖 7 个流程 + 6 种场景
```

`pnpm smoke` 用 Vite 的 SSR 模块加载器在 Node 里真实跑一遍接口层（**56 项断言，当前全部通过**），覆盖：
上传初始化与重复文件命中、转写结果与低置信度标记、AI 校正建议、版本回滚、实体抽取与同义项合并、
组合检索与 AI 扩展词、比对初判与「差异必填原因」校验、生成参数生效与保留人工编辑、
审核状态机与乐观锁、发布三项确认，以及 6 种 Mock 场景。

改接口后先跑 `pnpm smoke`，再跑 `pnpm typecheck`。

### 一键本地预览（Windows）

双击 `启动网站.cmd`：它会自动找 `pnpm`（或 `node`），必要时先装依赖，再起服务并打开
`http://localhost:5174/`。若你机器上 `pnpm` 不在 PATH，可用环境变量指定：

```bat
set XIANGYIN_PNPM=C:\path\to\pnpm.cjs
```

该脚本**不含任何本机绝对路径或用户名**，可安全公开。

### 环境变量与机密

| 规则 | 说明 |
| --- | --- |
| 只提交 `.env.example` | `.env`、`.env.*` 已在 `.gitignore` 中排除，不会进入仓库 |
| 前端不需要任何密钥 | 鉴权用「用户登录后拿到的 token」，存浏览器 localStorage，从不写进代码 |
| `VITE_` 变量等于公开 | 它们会被**打包进前端产物**，因此绝不可放密钥、令牌、密码或连接串 |
| 生产环境变量需自行创建 | `.env.production` 同样被排除；部署时按 `.env.example` 末尾说明创建 |

**注意**：因为 `.env.production` 不入库，本地直接 `pnpm build` 会使用代码内默认值
（`VITE_USE_MOCK` 默认 `true`），即产物以 mock 模式发布。正式部署请显式创建该文件并设
`VITE_USE_MOCK=false`。

---

## 二、7 个核心流程与 7 种界面状态

| # | 流程 | 页面文件 | 涉及接口数 |
| --- | --- | --- | --- |
| 1 | 上传已授权采访录音 | `src/views/Flow1UploadView.vue` | 6 |
| 2 | 转写并支持人工校正 | `src/views/Flow2TranscribeView.vue` | 6 |
| 3 | 提取地点 / 人物 / 事件 | `src/views/Flow3ExtractView.vue` | 6 |
| 4 | 检索地方资料 | `src/views/Flow4SearchView.vue` | 2 |
| 5 | 标注一致或有差异之处 | `src/views/Flow5CompareView.vue` | 3 |
| 6 | 生成故事卡或研学讲稿 | `src/views/Flow6GenerateView.vue` | 4 |
| 7 | 审核发布 | `src/views/Flow7PublishView.vue` | 6 |

**每个流程都实现同样的 8 个状态取值**（需求里的 7 种界面状态 + 未开始）：

| 状态 | 取值 | 复现方式（顶栏「Mock 场景」） |
| --- | --- | --- |
| 未开始 | `idle` | 默认 |
| 加载中 | `loading` | 加载中 |
| 重试中 | `retrying` | 失败 → 点「重试」 |
| 成功 | `success` | 成功 |
| 空数据 | `empty` | 空数据 |
| 失败 | `error` | 失败（首次调用必失败，重试成功） |
| 需人工确认 | `confirm` | 需人工确认 |
| 不可用 | `unavailable` | 不可用（重试不会成功，提供人工兜底） |

实现集中在一处，避免 7 个页面各写一套：

- 状态机：`src/composables/useAsyncTask.ts`
- 渲染：`src/components/common/AsyncStateBoundary.vue`
- 状态可视化：`src/components/common/PhaseStrip.vue`（每个流程页头部都会显示当前状态）

---

## 三、6 类 AI 介入点

AI 能力不单独成页，而是嵌在各流程的关键环节，且都可干预、可撤回、可记录。

| 流程 | 介入点 | 接口 | 用户可做什么 |
| --- | --- | --- | --- |
| 2 | 转写校正建议 | `POST /transcripts/{id}/suggestions` | 逐段「采纳」写入编辑态 / 「忽略」折叠保留（可撤销） |
| 3 | 信息抽取辅助 | `POST /extractions:start` | 查看置信度与建议标签，一键采纳、批量确认、手动改或删除 |
| 4 | 资料检索增强 | `POST /sources/search` | 扩展词逐条「加入检索」/「忽略」，可关闭重排回退纯关键词 |
| 5 | 差异比对提示 | `POST /comparisons:start` | 「采纳 AI 初判」或「请求 AI 重判」；人工结论可与 AI 不一致并被标注 |
| 6 | 内容生成草稿 | `POST /generations:create` | 逐区块编辑；重新生成时可选择保留人工编辑（`preservedBlockIds`） |
| 7 | 审核风险提醒 | `POST /contents/{contentId}/risk-check` | 逐条确认知晓；存在 critical 风险时禁止发布 |

---

## 四、4 个 AI 工具的集成落点

工具契约层完整保留在 `src/types/tools.ts` + `src/services/toolClient.ts`
（含 mock / http 两种 transport，可整体替换），界面层通过 `src/api/*` 调用同等能力：

| 工具 | 落点流程 | REST 对应端点 |
| --- | --- | --- |
| `retrieve_local_sources` | 流程 4 检索 | `POST /sources/search` |
| `compare_claims` | 流程 5 比对 | `POST /comparisons:start` |
| `build_story_card` | 流程 6 生成 | `POST /generations:create` |
| `submit_review` | 流程 7 审核 | `POST /contents/{contentId}/review-comments` |

> ❓ **TODO-ARCH-1（待确认）**：AI 能力对前端暴露为「工具调用」还是「REST 端点」？
> 两条路都保留了；后端定稿后建议只留一条，避免同一能力维护两套字段。

---

## 五、前后端协作与解耦约定

1. **统一请求封装**（`src/services/api/httpClient.ts`，基于 fetch）：
   路径参数替换、查询串拼装、超时、自动重试（指数退避）、请求/响应拦截器、
   401 处理、统一错误归一。业务模块只填写 `RequestConfig`。
2. **mock 数据层 + 开关**：`VITE_USE_MOCK=true` 时 `request` 自动走各端点内联的 mock；
   顶栏「Mock 场景」可切换 6 种场景，用于验证 7 种界面状态。
3. **错误处理分级**：`ApiError.code` ∈
   `network / timeout / auth / forbidden / notFound / validation / business / server / unavailable / cancelled / unknown`；
   自动重试只覆盖 `network / timeout / server`，`unavailable` 明确不重试并给人工兜底。
4. **loading 约定**：不写零散 `isLoading` 布尔量，统一用 `useAsyncTask` 的 `TaskPhase`。
5. **鉴权占位**（`src/services/api/auth.ts`）：token 存 `localStorage`（键名 `VITE_AUTH_TOKEN_KEY`）、
   注入 Bearer 头、401 广播 `xiangyin:auth-expired`，App 层展示跳转登录页的占位位置
   （顶栏「写入演示 Token / 登出」可模拟登录态）。
6. **环境变量**：只读 `src/config/env.ts`，业务代码禁止直接读 `import.meta.env`；命名规范见 `.env.example`。
7. **不确定性处理**：可选字段在类型上标注并可缺省；`RequestConfig.normalize` 补齐后端可能缺失/改名的字段；
   空数组走空状态而非成功态；合并/回滚等破坏性操作都有二次确认。

---

## 六、目录结构

```
src/
├─ api/                     业务接口层（每个方法 = 一个后端端点）
│  ├─ upload.ts transcribe.ts extract.ts search.ts compare.ts generate.ts publish.ts
│  ├─ endpointCatalog.ts    ★ 接口衔接点目录（字段表 + 待确认项，界面上可直接查看）
│  └─ index.ts
├─ components/
│  ├─ common/               AsyncStateBoundary / PhaseStrip / FlowHeader / PanelSection
│  │                        BaseButton / StatusPill / ModalDialog / ProgressBar
│  │                        FieldTable / JsonPreview / ApiContractPanel / AppToasts / EmptyState
│  ├─ audio/                音频播放器、转写片段、转写面板（音频↔文本联动）
│  ├─ sources/              来源标签、来源筛选栏、来源面板
│  ├─ review/               对照视图、审校单元卡片、审校面板
│  └─ tools/                论断核查面板、故事卡面板
├─ composables/
│  ├─ useAsyncTask.ts       ★ 7 态异步状态机
│  ├─ useAppShell.ts        全局壳状态（提示 / Mock 场景 / 鉴权占位）
│  └─ useAudioSync.ts useReviewDiff.ts useSourceFilter.ts useToolRunner.ts
├─ config/env.ts            ★ 环境变量集中出口
├─ mock/                    ★ 演示数据（数据集 / 可变 store / 场景开关 / 工具）
├─ services/
│  ├─ api/                  ★ 统一请求封装（httpClient / auth / errors / types）
│  └─ toolClient.ts transport.ts errors.ts mock/ http/   （四工具契约层）
├─ types/
│  ├─ api/                  ★ 7 个模块的请求/响应契约类型
│  └─ domain.ts tools.ts    （领域模型与四工具契约）
├─ router/index.ts          极简 hash 路由（40 行，零依赖，可替换为 vue-router）
├─ views/                   8 个页面（概览 + 7 个流程）
└─ utils/                   format.ts（时间码/字节/百分比）diff.ts（差异高亮）
docs/API-CONTRACT.md        ★ 自动生成的接口契约（33 个端点 / 28 项待确认）
scripts/gen-api-doc.mjs     契约文档生成器
```

---

## 七、演示数据

数据集在 `src/mock/dataset.ts`，同时充当**接口字段的活样例**（后端实现接口时可直接参照数据形状）：

- 采访：林水妹《塔巷里的漆器铺与坊巷生活》（福州话，含方言用字与低置信度片段）
- 实体：三坊七巷 / 塔巷 / 王审知 / 林依妹 / 脱胎漆器 / 茉莉花茶 …（含 4 条「需人工确认」）
- 资料：福州市志、三坊七巷志、闽都别记、非遗名录、福建日报、林氏宗谱 …（可信度分高/中/低）
- 比对：6 条论断，AI 初判覆盖一致 / 差异 / 待核实三类，其中包含
  **「闽王建塔得名」这类传说被写成史实**、**「窨制八至十次」这类个人记忆被放大** 的典型问题

`src/mock/store.ts` 是可变状态：人工校正、实体合并、标注提交、版本回滚都会真的写入，
刷新页面后回到初始值。

---

## 八、接口契约（前后端对接入口）

- **前端开发指南**：[docs/FRONTEND-GUIDE.md](docs/FRONTEND-GUIDE.md)
  —— 目录结构、路由设计、状态管理方案、组件清单（由组件头注释自动汇总）与分模块关键代码示例。
- **交接文档**：[`docs/API-CONTRACT.md`](docs/API-CONTRACT.md)
  —— 全局约定（信封 / 错误码 / 分页 / 鉴权 / mock 场景）+ 33 个端点的请求响应字段表 + 28 项待确认清单。
- **代码内数据源**：`src/api/endpointCatalog.ts`
  —— 每个流程页底部的「接口衔接点」面板直接渲染它，可展开查看字段表、前端调用位置、mock 位置与待确认项，
  并可一键复制该流程的契约 JSON。
- **类型定义**：`src/types/api/*.ts`（7 个模块 + 公共类型）。

改接口时的正确顺序：改 `endpointCatalog.ts` → 改 `src/api/<module>.ts` 与 `src/types/api/<module>.ts`
→ 跑 `node scripts/gen-api-doc.mjs` → 提交。

---

## 九、已知限制与后续工作

- 路由是自研的 40 行 hash 路由（`src/router/index.ts`），无嵌套路由与守卫；
  需要时可直接替换为 vue-router，`useRouter()` 的四个导出保持不变即可。
- 全局状态用模块级单例 composable（`useAppShell`），未引入 Pinia；替换方式同上。
- 音频文本联动使用 `public/demo/audio-demo.wav` 作为占位音源，其时长与转写片段时间轴不一致，
  代码里已做兜底（不会因超出时长而报错）；接入真实录音后即可严格对齐。
- `src/services/toolClient.ts` 与 `src/api/*` 目前并存（见 TODO-ARCH-1）。
- 未实现真实的登录、上传鉴权签名与断点续传持久化（刷新后需重新上传）。

---

## 十、待确认项

全部 28 项见 [`docs/API-CONTRACT.md` 第三节](docs/API-CONTRACT.md)，概览页底部也有汇总。
其中最需要优先确认的：

1. **TODO-API-2**：响应信封结构（`{code,message,data}` 还是直接返回数据）。
2. **TODO-AUTH-1**：鉴权方式（Bearer / Cookie / 签名）与是否需要 refreshToken。
3. **TODO-UP-2**：分片是预签名直传还是后端转发（影响前端进度计算）。
4. **TODO-SEARCH-1**：多关键词是 AND 还是 OR，是否支持短语与排除语法。
5. **TODO-WF-1**：审核状态机的合法流转表（当前定义见 `src/api/publish.ts` 的 `TRANSITIONS`）。
6. **TODO-GEN-1**：长文生成是同步返回还是异步任务。

---

## 十一、视觉系统

UI 已按 [impeccable](https://github.com/pbakaus/impeccable) 技能的流程整体重做，视觉世界是「**志书校样**」：把界面当作一份待校的地方志书稿——纸、界行、校勘标记、编号、钤印。

- 产品事实：`PRODUCT.md`（用户、目的、定位、约束、原则）
- 视觉决策：`DESIGN.md`（色板、字体、排版尺度、结构手法、唯一动效、浏览器表面）
- 令牌与基础层：`src/style.css`（`@theme` 块；含可选暗色变体 `html[data-theme="dark"]`）
- 自绘图标集：`src/components/common/AppIcon.vue`（替代全部 emoji；`IconName` 类型在编译期拦住「字形当图标」）

设计纪律（改 UI 时请遵守）：0 圆角 · 界行分区不用卡片 · 禁止卡片套卡片 · 等宽只用于数据 · 语义色只有三个（朱=差异/风险、绿=已核实、褐=存疑）· 唯一的非语义强调是钤印淡紫 · 全站只有一处动效。

确定性自查（59 条规则）：

```bash
node .dsh/skills/impeccable/scripts/impeccable.cmd detect dist/index.html
```

当前结果：0 条反模式、0 条建议。
