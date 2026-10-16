# 乡音有据 · 前端开发指南

> 配套文档：`README.md`（项目总览与运行方式）、`docs/API-CONTRACT.md`（接口字段表，自动生成）。
> 本文回答四件事：**目录怎么分、路由怎么走、状态放哪里、每个模块的代码长什么样**，以及接手时最容易踩的坑。

---

## 一、技术栈与工程约定

| 项 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3.5，`<script setup lang="ts">` | 全部组合式 API，不使用 Options API |
| 语言 | TypeScript 5.8 | `strict` 全开 |
| 构建 | Vite 6 | 别名 `@` 指向 `src`，dev 端口 5174 |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite` 插件） | 设计令牌在 `src/style.css` 的 `@theme` 块 |
| 运行时依赖 | **仅 `vue`** | 无 vue-router / pinia / axios / UI 库 / 图标库；图标一律用 emoji |
| 包管理 | pnpm | `pnpm-workspace.yaml` 的 `nodeLinker: hoisted` 用于规避路径含非 ASCII 字符时 isolated 链接器生成乱码 junction |

`tsconfig.app.json` 里有四个开关会直接影响写法：

- `noUnusedLocals` / `noUnusedParameters`：不能留未使用的变量与参数（模板里用到的算「已使用」）。
- `verbatimModuleSyntax`：**类型导入必须写 `import type`**，否则编译报错。
- `noImplicitOverride`：覆写成员需显式 `override`。
- `isolatedModules`：单文件转译，禁止「再导出类型」这类跨文件写法。

两条团队约定：**注释与界面文案一律中文**；**业务代码禁止直接读 `import.meta.env`**，一律走 `src/config/env.ts`。

### 1.1 代码规范工具链

| 工具 | 配置文件 | 职责 |
| --- | --- | --- |
| ESLint 9（扁平配置） | `eslint.config.js` | 正确性与 Vue 语义规则：`consistent-type-imports`（强制 `import type`）、`no-explicit-any`、`no-unused-vars`、`eqeqeq`、`prefer-const` |
| Prettier 3 | `.prettierrc.json` | 纯格式：无分号、单引号、100 列、尾随逗号、LF |
| EditorConfig | `.editorconfig` | 编辑器即时行为；其中 `.cmd` 强制 CRLF（cmd.exe 用 LF 会解析错行） |
| eslint-plugin-jsdoc | `eslint.config.js` | JSDoc 完整性：已写文档块的函数必须交代清参数与返回值 |

两者用 `eslint-config-prettier` 解耦：**格式问题只由 Prettier 报告，ESLint 不重复报**。
TypeScript 文件关闭了 ESLint 的 `no-undef`——标识符解析由 TS 负责，否则 `ScrollBehavior` 这类 DOM 类型会被误报。

#### 1.1.1 JSDoc 约定

作用域刻意收窄成「**已经有文档块的函数**」：

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| `jsdoc/require-param` | error（可自动修复） | 有文档块就必须为每个参数写 `@param` |
| `jsdoc/require-returns` | error（可自动修复） | 有返回值的函数必须写 `@returns` |
| `jsdoc/check-param-names` | error | `@param` 名称必须与形参一致 |
| `jsdoc/require-param-description` | error | `@param` 必须带描述 |
| `jsdoc/require-returns-description` | error | `@returns` 必须带描述 |

三条设计选择：

1. **不强制「每个函数都必须有文档」**（即不开 `require-jsdoc`）。只要求已存在的文档别缺项，
   这样公开 API 的文档不会烂，内部小函数也不会被逼着写废话。
2. **JSDoc 里不写类型**（`require-param-type` / `require-returns-type` 关闭）。
   类型由 TypeScript 承担，写两遍必然出现不一致。
3. **描述要写「为什么」和边界行为**，不要复述参数名。
   例如 `@param ms 毫秒；负数与非法值按 0 处理`，而不是 `@param ms 毫秒数`。

缺少的**标签**可以自动补，**描述**必须人来写，所以流程是两步：

```bash
pnpm lint:fix     # 第一步：自动补上缺失的 @param / @returns 标签
pnpm lint         # 第二步：剩下的 error 就是缺描述，逐条补齐
```

五条规则全部为 `error`，因此 `pnpm lint` 为 0 才算通过——「标签补上了、描述空着」无法混进主干。

当前状态：**163 个 `@param` + 119 个 `@returns`，全部带描述，0 缺失**。

常用命令：

```bash
pnpm lint          # 检查
pnpm lint:fix      # 自动修复可修复项
pnpm format        # 用 Prettier 写入格式
pnpm format:check  # 只检查不写入（CI 用）
```

**中文内容的编辑约定**：涉及中文文案或注释的改动，一律用编辑器（IDE / 本项目的编辑工具）完成，
不要用 `sed`、`echo`、`cat` 重定向等命令行方式写入——这类方式容易因编码或转义问题把中文写坏。
格式化器（Prettier / ESLint `--fix`）不在此限：它们基于 AST 重写、对字符串内容无损。
即便如此，批量格式化后仍应校验中文未被改动（本项目的做法是按文件抽取全部中文片段做 SHA-256 比对）。

---

## 二、目录结构与职责

~~~
src/
├─ api/                     业务接口层：每个方法 = 一个后端端点
│  ├─ upload.ts            流程 1（6 个端点）
│  ├─ transcribe.ts        流程 2（6 个端点）
│  ├─ extract.ts           流程 3（6 个端点）
│  ├─ search.ts            流程 4（2 个端点）
│  ├─ compare.ts           流程 5（3 个端点）
│  ├─ generate.ts          流程 6（4 个端点）
│  ├─ publish.ts           流程 7（6 个端点，含状态机 TRANSITIONS）
│  ├─ endpointCatalog.ts   ★ 接口衔接点目录：字段表 + 待确认项（界面与文档共用）
│  └─ index.ts             统一出口
├─ components/
│  ├─ common/              与业务无关的通用件（状态边界、弹窗、按钮、字段表…）
│  ├─ review/              审校对照视图（ReviewDiffViewer，流程 2 / 5 共用）
│  ├─ tools/               AI 能力面板（ToolInvokePanel，流程 4~7 共用）
│  └─ flow1…flow7/         各流程页私有的子组件，只被对应那个视图引用（合计 67 个）
├─ composables/
│  ├─ useAsyncTask.ts      ★ 7 态异步状态机（全站唯一的 loading 来源）
│  ├─ useAppShell.ts       ★ 应用壳状态：项目信息 / 操作人 / Mock 场景 / 全局提示 / 鉴权占位
│  └─ useReviewDiff.ts     文本差异计算
├─ config/env.ts           ★ 环境变量集中出口（唯一允许读 import.meta.env 的文件）
├─ mock/
│  ├─ dataset.ts           ★ 福州地方文化演示数据（同时是接口字段的活样例）
│  ├─ store.ts             可变 mock 状态：编辑后真的会变，刷新回到初始值
│  ├─ scenario.ts          Mock 场景开关（成功/空/失败/慢/不可用/需确认）
│  └─ helpers.ts           场景判定与 id / 相似度工具
├─ services/
│  ├─ api/                 ★ 统一请求封装
│  │  ├─ httpClient.ts     fetch 封装 + 拦截器 + 超时 + 重试 + 401 + 错误归一
│  │  ├─ auth.ts           token 存取 / Bearer 注入 / 401 广播（鉴权占位）
│  │  ├─ errors.ts         ApiError 与错误码映射
│  │  ├─ types.ts          协议层类型（信封 / 分页 / RequestConfig / MockScenario）
│  │  └─ index.ts          导出统一的 request()
│  ├─ toolClient.ts        四工具的类型化门面（契约层）
│  ├─ transport.ts         transport 抽象（mock / http 可替换）
│  ├─ mock/ http/          两种 transport 实现
│  └─ index.ts             默认导出 toolClient（按 VITE_TOOL_BASE_URL 选实现）
├─ types/
│  ├─ api/                 ★ 7 个模块的请求/响应契约 + common.ts
│  ├─ domain.ts            领域模型（复用组件库用）
│  └─ tools.ts             四工具契约（复用组件库用）
├─ router/index.ts         40 行 hash 路由（零依赖，可替换为 vue-router）
├─ views/                  8 个页面（概览 + 7 个流程）
└─ utils/
   ├─ format.ts            时间码 / 时长 / 日期 / 百分比 / 字节 / clamp / uid
   └─ diff.ts              字符级差异（供 ReviewDiffViewer 使用）
~~~

★ 标记的 6 处是接手时必须先看的文件：`endpointCatalog.ts`、`useAsyncTask.ts`、`useAppShell.ts`、`config/env.ts`、`mock/dataset.ts`、`services/api/`。

---

## 三、路由设计

### 3.1 路由表（8 条平级路由，无嵌套、无参数、无守卫）

| 路径 | name | 页面 | 流程 |
| --- | --- | --- | --- |
| `/` | `overview` | `OverviewView.vue` | 概览（站内文档） |
| `/upload` | `upload` | `Flow1UploadView.vue` | 1 上传已授权采访录音 |
| `/transcribe` | `transcribe` | `Flow2TranscribeView.vue` | 2 转写与人工校正 |
| `/extract` | `extract` | `Flow3ExtractView.vue` | 3 提取地点 / 人物 / 事件 |
| `/search` | `search` | `Flow4SearchView.vue` | 4 检索地方资料 |
| `/compare` | `compare` | `Flow5CompareView.vue` | 5 标注一致与差异 |
| `/generate` | `generate` | `Flow6GenerateView.vue` | 6 生成故事卡 / 讲稿 |
| `/publish` | `publish` | `Flow7PublishView.vue` | 7 审核发布 |

### 3.2 为什么自研而不用 vue-router

只有 8 条平级路由，没有嵌套路由、路由参数、导航守卫与命名视图；自研 40 行可避免引入依赖。此外 `RouteDef` 还额外承载**侧边栏元数据**（`step` 流程编号、`title`、`description`），这些在 vue-router 里要另开 meta 字段。

### 3.3 约定与懒加载

`useRouter()` 只暴露 5 个成员，替换实现时保持这 5 个签名即可：

~~~ts
export interface RouterApi {
  currentPath: Ref<string>
  currentRoute: ComputedRef<RouteDef>
  push(path: string): void
  replace(path: string): void
  goToStep(step: number): void   // 按流程编号跳转，供「下一步」按钮使用
}
~~~

页面组件按需加载，并在 `App.vue` 里以 `route.path` 作为 `key`：

~~~vue
<component :is="currentComponent" :key="currentRoute.path" />
~~~

以 path 作 key 的好处是**切换流程即重置页面状态**，不会残留上一个流程的编辑草稿与错误态。

### 3.4 换成 vue-router 的步骤

1. `pnpm add vue-router`；
2. 把 `routes` 转成 `createRouter({ history: createWebHashHistory(), routes })`；
3. 重写 `src/router/index.ts` 的 `useRouter()`，保持 §3.3 的 5 个成员签名；
4. `App.vue` 把 `<component :is>` 换成 `<RouterView>`，侧边栏按钮换成 `<RouterLink>`。

业务组件与 views 一行都不用改。

---

## 四、状态管理方案

刻意不引入 Pinia。状态按**生命周期与作用域**分三层，避免「什么都往全局塞」：

| 层 | 载体 | 管什么 | 生命周期 |
| --- | --- | --- | --- |
| 应用壳层 | `useAppShell()`（模块级单例） | 项目信息、当前操作人、Mock 场景、全局提示、鉴权占位 | 整个会话 |
| 流程内层 | `useAsyncTask()`（每页可多个实例） | 把**一次接口调用**建模成 8 态状态机 | 页面级（切路由即销毁） |
| 组件内层 | `ref` / `reactive` | 纯 UI 状态：展开折叠、筛选条件、编辑草稿、临时选中 | 组件级 |

### 4.1 唯一的 loading 来源：useAsyncTask

禁止在业务组件里写 `isLoading = ref(false)` 这类散装布尔量。所有异步都收敛成 `TaskPhase`：

~~~ts
export type TaskPhase =
  | 'idle'         // 未开始
  | 'loading'      // 加载中
  | 'retrying'     // 重试中（第 N/M 次自动重试）
  | 'success'      // 成功
  | 'empty'        // 空数据（必须给出「为什么空」与可执行动作）
  | 'error'        // 失败（按错误码分类，只在可重试时给按钮）
  | 'confirm'      // 需人工确认（返回 ConfirmPrompt，用户确认或拒绝）
  | 'unavailable'  // 不可用（重试无意义，必须给人工兜底路径）
~~~

### 4.2 数据流

~~~
用户操作
  └─ 视图调用 @/api 的方法（如 searchApi.search(body)）
       └─ request(config)            ← src/services/api/httpClient.ts
            ├─ VITE_USE_MOCK=true → config.mock(ctx)   读 src/mock/store.ts
            └─ 否则 → fetch + 请求拦截器 + 超时 + 指数退避重试 + 响应拦截器
       ↓ 成功返回 ApiResponse<T>；失败抛 ApiError
  └─ useAsyncTask 把它落成 TaskPhase
       └─ AsyncStateBoundary 按 phase 渲染对应 UI
~~~

关键点：**视图层永远不需要写 try/catch，也不需要判断 HTTP 状态码**。

### 4.3 换成 Pinia 的方式

把 `useAppShell` 的内部实现换成 `defineStore` 即可，组件调用方式（解构出 refs 与方法）不变。流程内状态不建议上 Pinia —— 它天然属于页面生命周期。

---

## 五、组件清单

下表由各组件自身的头部注释自动生成（`node scripts/gen-component-doc.mjs`），保证与代码一致。

**通用组件**（src/components/common）

| 组件 | 说明 |
| --- | --- |
| `ApiContractPanel.vue` | 接口衔接点面板。 每个流程页底部都会挂这个组件：把该流程涉及的**全部后端接口**、 请求/响应字段表、前端… |
| `AppIcon.vue` | 自绘 SVG 图标集。 为什么不用 emoji 或 Unicode 符号：emoji 是操作系统字体渲染的彩… |
| `AppToasts.vue` | 全局提示条。 形态是「勘误条」：纸面 + 1px 界行 + 一个描边图标，不用彩色整块背景、 不用模糊、不用… |
| `AsyncStateBoundary.vue` | 7 态渲染边界。 每个流程页面都用它包住内容区：成功时渲染默认插槽，其余 6 种状态由本组件统一提供。 印刷… |
| `BaseButton.vue` | 通用按钮。 印刷世界的控件是「印上去的矩形」：0 圆角、1px 界行、按下不加阴影。 加载态用下划线扫过而不… |
| `EmptyState.vue` | 空状态占位。统一「无数据 / 无搜索结果 / 未执行」三类空场景。 |
| `FieldTable.vue` | 接口字段表。 渲染 endpointCatalog 里的 FieldDoc，是前后端对齐字段时的直接依据。 |
| `FlowHeader.vue` | 流程页头部，按「版心」组织：道次 + 标题 + 说明构成主栏， 状态条与涉及的接口构成下栏，两栏之间是一道通… |
| `JsonPreview.vue` | JSON 预览块，用于展示 mock 数据 / 响应样例。 |
| `ModalDialog.vue` | 通用模态框。 用于「授权确认」「重复文件处理」「发布前最终确认」等需要阻断式决策的场景。 遮罩是实心墨色（不… |
| `PanelSection.vue` | 分区。 刻意**不是**卡片：印刷世界用通栏界行 + 留白分区，而不是圆角容器。 这样也天然避免了「卡片套卡… |
| `PhaseStrip.vue` | 状态条：把 7 种界面状态列为可核验的清单，高亮当前状态。 作用有两个： 1. 开发与联调时一眼看出当前处于… |
| `ProgressBar.vue` | 进度条。印刷世界的进度就是一道界行的填充，不用圆角与阴影。 |
| `StatusPill.vue` | 状态胶囊。 印刷世界里的标记是「钤印 / 批注色块」：0 圆角、1px 界行、极浅的洗色。 语义色只有三个（… |

**审校对照**（src/components/review）

| 组件 | 说明 |
| --- | --- |
| `ReviewDiffViewer.vue` | 审校对照视图（原文 vs 修订稿）。 采用 git 风格的左右并排：`equal` 块两侧内容相同，`cha… |

**AI 能力面板**（src/components/tools）

| 组件 | 说明 |
| --- | --- |
| `ToolInvokePanel.vue` | AI 工具调用面板（工具契约层）。 与 src/api/* 的分工： - \`src/api/*\` 是「R… |

**流程 2 · 转写与人工校正**（src/components/flow2）

| 组件 | 说明 |
| --- | --- |
| `AudioPlayerPanel.vue` | 流程 2：音频播放与文本联动面板。 唯一职责：渲染 <audio> 与播放控制条（跟随开关、上/下一段、时间… |
| `CorrectionOverviewPanel.vue` | 流程 2：「校正概览与保存」分区。 唯一职责：汇总片段 / 段落 / 校正 / 低置信度 / 待提交等计数，… |
| `ParagraphList.vue` | 流程 2：段落视图列表。 唯一职责：把后端合并好的段落渲染成可通读的列表， 并提供「跳到该段」与「在时间轴中… |
| `RollbackConfirmDialog.vue` | 流程 2：回滚二次确认弹窗。 唯一职责：把「将要回滚到哪个版本、会发生什么、有多少未提交修改会被清空」讲清楚… |
| `SegmentCard.vue` | 流程 2：单个转写片段卡片。 唯一职责：渲染一段转写（时间码 / 说话人 / 置信度 / 校正痕迹 / 正文… |
| `SegmentTimeline.vue` | 流程 2：时间轴视图的片段列表。 唯一职责：提供可滚动的片段列表容器（音频联动据此滚动定位）并逐段渲染 Se… |
| `SuggestionCard.vue` | 流程 2：单条 AI 校正建议卡片。 唯一职责：展示一条建议的类型、置信度、词表命中、原文 → 建议文与理由… |
| `SuggestionPanel.vue` | 流程 2：「AI 校正建议」分区。 唯一职责：承载建议分区的 7 态边界、按片段分组的建议列表与「已忽略」折… |
| `TranscribeHeaderActions.vue` | 流程 2：页头操作组。 唯一职责：提供「重置 / 取消请求 / 模拟不可用 / 发起转写 / 拉取转写结果」… |
| `TranscribeMetaPanel.vue` | 流程 2：AI 转写元信息与低置信度阈值。 唯一职责：只读展示主任务返回的模型信息、调用统计与阈值口径， 以… |
| `TranscriptConfirmPrompt.vue` | 流程 2：需人工确认（confirm 态）的提示块。 唯一职责：展示状态机给出的确认标题、说明与低置信度明细… |
| `TranscriptContentPanel.vue` | 流程 2：「转写内容」分区。 唯一职责：承载时间轴 / 段落两种视图的切换与「定位当前」入口， 并把两个视图… |
| `TranscriptIdlePanel.vue` | 流程 2：未开始转写时的空态引导。 唯一职责：说明「发起转写 → 拉取结果 → 逐段校正」的推荐顺序， 并提… |
| `TranscriptUnavailablePanel.vue` | 流程 2：ASR 能力不可用时的兜底说明。 唯一职责：解释不可用原因，并强调「人工听录仍可继续」的三条出路 … |
| `VersionHistoryDialog.vue` | 流程 2：版本记录弹窗。 唯一职责：在模态框里承载版本列表的 7 态边界与版本条目（来源、作者、变更段数、备… |

**流程 3 · 提取地点人物事件**（src/components/flow3）

| 组件 | 说明 |
| --- | --- |
| `AiOverviewPanel.vue` | AI 抽取概览与批量确认面板。 唯一职责：展示模型版本 / 耗时 / 自评置信度 / 待确认数量与待确认实体… |
| `DeleteEntityDialog.vue` | 删除实体二次确认弹窗。 唯一职责：说明将删除的实体、其原文依据条数与删除后果，并展示删除失败原因； 实际删除… |
| `DuplicateMergePanel.vue` | 疑似同义项合并面板。 唯一职责：列出后端返回的同义项候选分组（相似度、建议主实体、成员摘要）与最近一次合并 … |
| `EntityCard.vue` | 单条抽取实体卡片。 唯一职责：渲染一条 ExtractedEntity 的全部展示信息（名称、规范名、确认状… |
| `EntityFilterPanel.vue` | 筛选与分组统计面板。 唯一职责：渲染「全部 + 六类实体」的类别按钮、确认状态按钮与关键词输入框，并把这三项… |
| `EntityFormDialog.vue` | 手工新增 / 编辑实体弹窗。 唯一职责：渲染实体表单（类别、原文形式、规范名、别名、不确定性说明），把字段改… |
| `EntityGroupList.vue` | 按实体类别分组的卡片列表。 唯一职责：把已分组的实体渲染成若干 PanelSection（标题带数量），并在… |
| `EvidencePanel.vue` | 原文对应关系面板。 唯一职责：展示当前选中的「实体 → 转写片段」对应关系——说话人、字符区间、命中引文、 … |
| `ExtractionConfirmPanel.vue` | 「需人工确认」提示块。 唯一职责：渲染状态机给出的 confirmPrompt（标题、说明、逐条细节、确认 … |
| `ExtractionIdlePanel.vue` | 空闲态（尚未发起抽取）面板。 唯一职责：在状态机处于 idle 时说明将抽取什么，并提供「发起抽取」「直接拉… |
| `ExtractionResultPanel.vue` | 成功态结果区（流程 3）。 唯一职责：编排成功态的展示布局——AI 概览与批量确认、筛选统计、实体分组卡片、… |
| `ExtractionUnavailablePanel.vue` | 不可用态（NER 未部署）面板。 唯一职责：说明抽取能力不可用，并提供「手工新增实体」「再试一次」「重置流程… |
| `MergePrimaryDialog.vue` | 同义项合并弹窗（选择保留哪个主实体）。 唯一职责：列出候选分组的全部成员及其置信度、依据条数，标注 AI 建… |
| `WriteErrorBanner.vue` | 写操作失败统一提示条。 唯一职责：在任一写操作失败时提示「本地数据未被修改」，并在发起抽取失败时提供重试入口… |

**流程 4 · 检索地方资料**（src/components/flow4）

| 组件 | 说明 |
| --- | --- |
| `EntityFilterPanel.vue` | 流程 4 左栏「实体过滤」面板（来自流程 3）。 唯一职责：渲染流程 3 抽取出的实体清单，提供「全选已确认… |
| `ExpandedKeywordsPanel.vue` | 流程 4 的「AI 检索增强 · 扩展检索词」面板。 唯一职责：展示 AI 扩展出的检索词（词 / 权重 /… |
| `RelatedLeadsPanel.vue` | 流程 4 的「关联线索」面板。 唯一职责：渲染由命中结果推出的关联线索卡片（标题、类别、置信度、提示语）， … |
| `RiskConfirmNotice.vue` | 流程 4 的低可信来源提示。 唯一职责：在「需人工确认」态渲染确认提示（标题 / 说明 / 风险明细 / 确… |
| `SearchConditionPanel.vue` | 流程 4 左栏「检索条件」面板。 唯一职责：渲染检索条件表单——关键词输入与已选关键词、来源类型多选、可信度… |
| `SearchFacetPanel.vue` | 流程 4 的「分面筛选」面板。 唯一职责：渲染后端返回的分面桶（来源类型 / 可信度 / 年代计数），点击非… |
| `SearchFallbackActions.vue` | 流程 4 的空数据 / 不可用状态动作组。 唯一职责：为 7 态里的「空数据」与「不可用」两种状态渲染可执行… |
| `SearchIdlePanel.vue` | 流程 4 的 idle 引导面板。 唯一职责：在「尚未发起检索」时给出推荐检索词与「浏览全部资料」入口， 把… |
| `SearchResultList.vue` | 流程 4 的检索结果列表。 唯一职责：渲染命中列表——可信度分级配色与分值、命中词高亮、定位信息、相关度条、… |
| `SearchStatsBar.vue` | 流程 4 的检索结果统计条。 唯一职责：在结果区顶部展示一次检索的规模与耗时——命中数、页码与每页条数、 界… |
| `SourceDetailDrawer.vue` | 流程 4 的资料详情侧栏。 唯一职责：渲染单条资料的详情抽屉——标题与出版信息、可信度与定位、完整摘录、 引… |

**流程 5 · 标注一致与差异**（src/components/flow5）

| 组件 | 说明 |
| --- | --- |
| `AiVerdictPanel.vue` | 单条比对项的 AI 判定区。 唯一职责：展示 AI 初判结论 / 置信度 / 分类标签 / 理由与最近标注时… |
| `AnnotationProgressPanel.vue` | 标注进度面板。 唯一职责：展示比对任务的进度——进度条、7 张统计卡、服务端统计说明与筛选按钮， 并把筛选模… |
| `AnnotationSubmitBar.vue` | 标注提交条。 唯一职责：固定在页面底部的提交区——汇总本次变更 / 未标注 / 缺原因 / 调用次数， 展示… |
| `ClaimSegmentBlock.vue` | 论断的原文回跳片段。 唯一职责：就地展示某条论断关联的采访转写原句（片段 id / 讲述人 / 起点 / 正… |
| `ClaimSourceCompare.vue` | 单条比对项的左右对照。 唯一职责：左侧展示 AI 创作内容，右侧展示配对资料（标题 / 出版方 / 可信度 … |
| `ComparisonConfirmBanner.vue` | 需人工确认的状态提示条。 唯一职责：把 7 态状态机「confirm」这一态的提示内容（标题 / 说明 / … |
| `ComparisonItemCard.vue` | 单条比对项的标注卡片。 唯一职责：把一条比对项编排成完整的工作单元——状态头、左右对照、原文回跳 / 字符级… |
| `ComparisonTaskEntry.vue` | 比对任务非成功态的操作入口。 唯一职责：按当前界面状态（idle / empty / unavailable… |
| `HumanVerdictPanel.vue` | 单条比对项的人工判定区。 唯一职责：让标注人选择最终结论、在「差异 / 待核实」时必填差异原因并可选分类标签… |
| `SubmitAllConfirmDialog.vue` | 提交整批前的二次确认框。 唯一职责：在还有未标注条目时，把「本次将提交哪些结论」与提交体的约定摊开给用户， … |

**流程 6 · 生成故事卡 / 讲稿**（src/components/flow6）

| 组件 | 说明 |
| --- | --- |
| `CitationPanel.vue` | 流程 6 的引用来源标注面板（右栏第一块）。 唯一职责：展示角标数 / 实际引用资料数 / 因风险排除数的概… |
| `DraftBlockList.vue` | 流程 6 的草稿区块列表。 唯一职责：逐个渲染可编辑的正文区块——标题、正文、角标可点击的正文预览与关联风险… |
| `DraftInfoPanel.vue` | 流程 6 的草稿与版本信息面板（右栏第三块）。 唯一职责：填写本次变更说明，并展示草稿编号、已保存版本、修改… |
| `GenerationParamPanel.vue` | 流程 6 的生成参数面板。 唯一职责：铺开输出类型 / 语气 / 篇幅 / 创作自由度 / 两个开关 / 标… |
| `GenerationResultArea.vue` | 流程 6 的结果区。 唯一职责：用 AsyncStateBoundary 组织结果区的 7 态——成功或需人… |
| `GenerationResultPanel.vue` | 流程 6 的生成结果面板。 唯一职责：承载「生成结果 / 人工撰写结果」分区——结果标题与版本 / 未保存标… |
| `IncludeScopeSelector.vue` | 流程 6 的纳入范围选择器。 唯一职责：勾选本次生成纳入的论断（claimIds）与允许引用的资料（sour… |
| `RegenerateConfirmDialog.vue` | 流程 6 的「重新生成会覆盖未保存编辑」确认框。 唯一职责：把 ModalDialog 包装成覆盖确认——统… |
| `RiskPanel.vue` | 流程 6 的 AI 风险提示面板（右栏第二块）。 唯一职责：按等级配色逐条列出风险提示（等级、分类、说明与建… |

**流程 7 · 审核发布**（src/components/flow7）

| 组件 | 说明 |
| --- | --- |
| `PublishConfirmModal.vue` | 发布前最终确认弹窗。 唯一职责：以三项勾选（授权范围 / 引用标注 / 审核完成）做阻断式发布确认， 并把确… |
| `PublishConfirmPanel.vue` | 发布前最终确认面板。 唯一职责：逐条列出当前不能发布的原因、提供发布入口，并在发布成功后展示回执字段； 发布… |
| `ReviewCommentPanel.vue` | 审核意见面板。 唯一职责：收集审核意见文本、展示审核人身份与风险确认进度， 触发「审核通过 / 驳回」两个提… |
| `RiskCheckPanel.vue` | AI 风险提醒面板。 唯一职责：触发并呈现 AI 风险检查的 7 态结果（含严重风险人工确认弹层、汇总等级、… |
| `RiskItemCard.vue` | 单条 AI 风险项卡片。 唯一职责：渲染一条风险项的等级、分类、说明、处理建议与「已确认知晓」勾选， 并把勾… |
| `RollbackConfirmModal.vue` | 回滚二次确认弹窗。 唯一职责：在选定回滚目标后，展示目标版本号、状态与风险等级并做二次确认； 回滚接口调用由… |
| `TransitionPanel.vue` | 审核状态流转面板。 唯一职责：渲染审核状态步骤条、分支状态提示、当前可执行动作、流转备注、 乐观锁冲突恢复区… |
| `VersionHistoryPanel.vue` | 版本记录与回滚面板。 唯一职责：以 AsyncStateBoundary 渲染版本记录列表、标记当前版本、 … |

**页面**（views）

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| `Flow1UploadView.vue` | `/upload` | 流程 1：上传已授权采访录音。 交互覆盖： - 文件选择（点击 + 拖拽）与前置校验（格式白名单 / 大小上… |
| `Flow2TranscribeView.vue` | `/transcribe` | 流程 2：转写并支持人工校正。 设计要点： 1) 7 种界面状态由 useAsyncTask + Async… |
| `Flow3ExtractView.vue` | `/extract` | 流程 3：提取地点 / 人物 / 事件。 设计要点： 1) 7 种界面状态由 useAsyncTask + … |
| `Flow4SearchView.vue` | `/search` | 流程 4：检索地方资料。 本视图是流程 4 的编排层：持有接口调用入口（searchApi.search 与… |
| `Flow5CompareView.vue` | `/compare` | 流程 5：标注一致或有差异之处（编排层）。 本文件只保留 imports、接口调用入口、顶层布局与编排：7 … |
| `Flow6GenerateView.vue` | `/generate` | 流程 6：生成故事卡 / 研学讲稿。 设计要点： - 参数选择（输出类型 / 语气 / 篇幅 / 创作自由度… |
| `Flow7PublishView.vue` | `/publish` | 流程 7：审核发布（主视图）。 设计要点： - 审核状态机 draft → pending_review →… |
| `OverviewView.vue` | `/` | 项目概览（面向使用者与项目干系人）。 这一页只回答四件事：这是什么、能做什么、怎么用、现在能用的是什么。 面… |
---

## 六、按模块的关键代码示例

字段的完整清单在 `docs/API-CONTRACT.md`。本节只讲**代码形状**：类型怎么定义、api 怎么封装、视图怎么消费。

### 6.1 流程 1 · 上传已授权采访录音

**类型**（`src/types/api/upload.ts`）：

~~~ts
export type LicenseType =
  | 'public'          // 公开授权，可对外发布
  | 'research_only'   // 仅研究使用，不得公开发布
  | 'internal'        // 仅项目内部使用
  | 'limited_time'    // 限时授权，到期需重新确认

export interface UploadInitRequest {
  title: string
  narrator: string
  interviewer: string
  fileName: string
  sizeBytes: number
  mimeType: string
  durationMs?: number          // 浏览器不支持预读时为 undefined
  checksum?: string            // 内容指纹，用于重复检测
  recordedAt: string           // ISO 8601
  recordedPlace: string
  dialect?: string
  projectId?: string
  licenseType: LicenseType
}

export interface UploadInitResponse {
  uploadId: string
  interviewId: string
  chunkSizeBytes: number
  totalChunks: number
  chunkUrls?: string[]              // 预签名直传地址；为空表示走后端转发
  expiresAt: string
  duplicate?: DuplicateHit | null   // 命中重复文件时返回
  constraints: UploadConstraints    // 后端下发的格式与大小白名单
}
~~~

**接口封装**（`src/api/upload.ts`）—— mock 与真实实现写在同一个 `RequestConfig` 里，接后端时只需把 `VITE_USE_MOCK` 置为 false，这个文件不用改：

~~~ts
init(body: UploadInitRequest): Promise<ApiResponse<UploadInitResponse>> {
  return request<UploadInitRequest, UploadInitResponse>({
    label: '初始化上传',
    method: 'POST',
    url: '/interviews/uploads:init',
    body,
    mock: (ctx) => {
      const uploadId = mockId('UP')
      const interviewId = mockId('INT')
      const totalChunks = Math.max(1, Math.ceil(body.sizeBytes / UPLOAD_CONSTRAINTS.chunkSizeBytes))
      // …写入 mockStore.uploads，便于 getStatus / complete 复用同一会话
      return { uploadId, interviewId, chunkSizeBytes, totalChunks, expiresAt, duplicate, constraints }
    },
  })
}
~~~

**视图消费**（`Flow1UploadView.vue`）—— 「需人工确认」直接由 `needsConfirm` 声明，不用自己写弹窗逻辑；分片上传用普通循环 + 本地进度状态，支持从失败分片续传：

~~~ts
const { state, isBusy, canRetry, run, retry, respondConfirm } =
  useAsyncTask<UploadInitResponse, []>(() => uploadApi.init(buildInitRequest()), {
    needsConfirm: (data) =>
      data.duplicate
        ? {
            title: '检测到同名 / 重复录音',
            message: data.duplicate.title + ' 已存在，相似度 ' + data.duplicate.similarity,
            confirmText: '仍然新建',
            cancelText: '取消上传',
          }
        : null,
  })

// 分片循环：session.doneChunks 是断点，失败重传从这里继续
for (let index = session.doneChunks; index < init.totalChunks; index += 1) {
  const res = await uploadApi.uploadChunk(init.uploadId, index, init.totalChunks)
  session.doneChunks = index + 1
  session.progress = res.data.progress
  session.remainingMs = res.data.remainingMs
}
~~~

### 6.2 流程 2 · 转写与人工校正

**类型要点**：片段同时带 `originalText`（AI 原文）与 `text`（当前版本），这是「版本对比」能成立的前提；`lowConfidence` 由后端按 `lowConfidenceThreshold` 标记，**前端不重复判断**（TODO-ASR-2）：

~~~ts
export interface TranscriptSegmentDTO {
  id: string
  index: number
  startMs: number
  endMs: number
  speaker: string
  text: string            // 当前版本（可能已被人工校正）
  originalText: string    // AI 原始文本
  confidence: number      // 0~1
  lowConfidence: boolean  // 后端按阈值判定，前端只展示
  edited: boolean
  editedBy?: OperatorInfo // 「记录修改人」
  editedAt?: string       // 「记录修改时间」
}
~~~

**音频文本联动**是本流程的核心：

~~~ts
const audioEl = ref<HTMLAudioElement | null>(null)
const currentMs = ref(0)

// 播放进度 → 当前片段（文本高亮的唯一依据）
const activeSegmentId = computed(
  () => segments.value.find((s) => currentMs.value >= s.startMs && currentMs.value < s.endMs)?.id ?? null,
)

function onTimeUpdate(): void {
  const el = audioEl.value
  if (el) currentMs.value = el.currentTime * 1000
}

// 文本 → 音频：点击片段跳转
function seekTo(segment: TranscriptSegmentDTO): void {
  const el = audioEl.value
  if (!el) return
  const target = segment.startMs / 1000
  // 演示音源短于转写时间轴时夹取到真实时长，避免设置越界值
  const duration = Number.isFinite(el.duration) ? el.duration : target
  el.currentTime = Math.min(target, duration)
  void el.play()
}
~~~

**校正提交**：`baseVersionId` 是乐观锁，冲突时后端返回 `conflict`，前端只提示刷新、不自动合并（TODO-CONFLICT-1）：

~~~ts
await transcribeApi.submitCorrections({
  transcriptId: state.value.data.transcriptId,
  baseVersionId: state.value.data.version.versionId,
  editor: CURRENT_OPERATOR,
  corrections: changedSegments.map((s) => ({ segmentId: s.id, text: s.text, speaker: s.speaker })),
  saveAsDraft,      // true = 只存草稿，不生成新版本
})
~~~

### 6.3 流程 3 · 提取地点 / 人物 / 事件

**类型要点**：`evidence` 是「抽取结果 → 原文」的可追溯链路，没有它就无法人工复核；`confirmStatus === 'pending'` 就是界面上的「需人工确认」：

~~~ts
export interface EvidenceRef {
  segmentId: string
  charStart: number      // 原文中的字符区间，用于精确高亮
  charEnd: number
  quote: string          // 命中的原文片段
  startMs: number        // 片段起始时间，用于回跳音频
}

export interface ExtractedEntity {
  id: string
  kind: 'place' | 'person' | 'event' | 'organization' | 'artifact' | 'time'
  name: string              // 原文形式，如「三坊巷」
  normalizedName: string    // 规范名，如「三坊七巷」
  aliases: string[]
  confidence: number
  confirmStatus: 'not_required' | 'pending' | 'confirmed' | 'rejected'
  uncertaintyNote?: string  // 不确定性说明
  evidence: EvidenceRef[]
  createdByHuman: boolean
}
~~~

**同义项合并**必须展示合并结果，否则用户不知道别名去了哪里：

~~~ts
const merged = await extractApi.mergeEntities({
  extractionId: 'EXT-2024-0312',
  primaryId: 'ENT-P-001',        // 保留哪个
  mergedIds: ['ENT-P-005'],      // 合并掉哪些
  operator: CURRENT_OPERATOR,
})
// merged.data.mergedAliases → 合并后的别名集合
// merged.data.removedIds     → 被移除的实体
~~~

**原文高亮**：不要用 `v-html` 拼字符串，用切分渲染生成 `<mark>`，避免注入风险：

~~~ts
const parts = computed(() => {
  const quote = activeEvidence.value?.quote ?? ''
  const text = activeSegment.value?.text ?? ''
  const index = text.indexOf(quote)
  if (index < 0) return [{ text, hit: false }]
  return [
    { text: text.slice(0, index), hit: false },
    { text: quote, hit: true },
    { text: text.slice(index + quote.length), hit: false },
  ]
})
~~~

片段已被删除时给出降级提示（「原文片段不存在」），而不是渲染成空白。

### 6.4 流程 4 · 检索地方资料

**类型要点**：可信度是**分级 + 分值**双字段——界面用 `credibility` 上色、用 `credibilityScore` 排序；`expandedKeywords` 让 AI 的扩展行为可解释、可撤销：

~~~ts
export interface SearchSourcesRequest extends PageQuery {
  keywords: string[]
  entityIds?: string[]
  sourceTypes?: SourceType[]
  credibility?: CredibilityLevel[]
  timeRange?: TimeRange
  enableQueryExpansion: boolean   // 是否启用 AI 智能扩展检索词
  enableReRank: boolean           // 是否启用 AI 相关度重排
  sort?: SearchSort
}

export interface ExpandedKeyword {
  term: string
  weight: number    // 0~1
  reason: string    // 扩展理由，必须展示，避免黑箱
  hitCount: number
}
~~~

**调用与消费**：

~~~ts
const res = await searchApi.search({
  keywords: keywords.value,
  entityIds: checkedEntityIds.value,
  sourceTypes: selectedTypes.value,
  credibility: selectedCredibility.value,
  sort: sort.value,
  page: page.value,
  pageSize: 10,
  enableQueryExpansion: true,
  enableReRank: true,
})

res.data.hits             // 结果列表
res.data.expandedKeywords // AI 扩展词，逐条可「加入检索」或「忽略」
res.data.facets           // 分面计数，点击即切换筛选
res.data.leads            // 关联线索，点击追加为关键词继续深挖
~~~

### 6.5 流程 5 · 标注一致或有差异之处

**类型要点**：`aiVerdict` 与 `humanVerdict` 分开存。**AI 初判绝不覆盖人工结论**，两者不一致本身就是最有价值的信息：

~~~ts
export type CompareVerdict = 'consistent' | 'conflict' | 'needs_verification' | 'insufficient'

export interface ComparisonItem {
  itemId: string
  claimText: string                    // 左侧：AI 创作内容
  source: { sourceId: string; title: string; excerpt: string; credibility: string } | null
  aiVerdict: CompareVerdict            // AI 初判
  aiConfidence: number
  aiReason: string                     // AI 理由，必须展示
  humanVerdict: CompareVerdict | null  // 人工最终结论
  humanReason: string | null
  annotationState: 'unannotated' | 'annotated'
}
~~~

**提交标注**：业务校验（判定为差异 / 待核实必须填原因）**放在服务端**，前端只做即时提示；服务端返回的 `invalid` 数组要就地标红，且**保存失败不能丢用户输入**（草稿与已保存基线分离）：

~~~ts
const res = await compareApi.submitAnnotations({
  comparisonId: 'CMP-2024-0007',
  annotator: CURRENT_OPERATOR,
  submitAll: false,          // false = 增量保存，true = 整批提交
  annotations: changedItems.map((item) => ({
    itemId: item.itemId,
    verdict: item.humanVerdict,
    reason: item.humanReason,
    reasonTags: item.humanReasonTags,
  })),
})
// res.data.invalid → [{ itemId, message }]：按 itemId 就地标红
// res.data.stats   → 标注进度统计（progress / consistent / conflict / …）
~~~

### 6.6 流程 6 · 生成故事卡 / 研学讲稿

**类型要点**：`citations` 是独立的引用数组，正文区块只保存 `citationIndexes` 角标序号。这样「正文怎么改」都不影响引用来源的准确性：

~~~ts
export interface DraftBlock {
  id: string
  heading: string
  body: string
  citationIndexes: number[]   // 引用的角标序号，如 [1, 3]
  edited: boolean             // 是否被人工编辑过
}

export interface Citation {
  index: number               // 正文角标 [index]
  sourceId: string
  sourceTitle: string
  locatorText: string         // 「第 12 页」「00:08.8」「在线文档」
  quote: string
  credibility: CredibilityLevel
}
~~~

**生成 + 风险提示 + 保留人工编辑**：

~~~ts
const res = await generateApi.create({
  outputType: 'story_card',   // 'story_card' | 'study_script'
  tone: 'narrative',          // plain | narrative | academic | child | official
  length: 'medium',           // short | medium | long
  title: title.value,
  claimIds: selectedClaimIds.value,   // 通常来自流程 5 标注为「一致」的条目
  sourceIds: allowedSourceIds.value,  // 约束引用范围
  requireCitation: true,
  allowUnverified: false,     // 是否允许收录「待核实」内容
  creativity: 0.2,            // 0 = 严格复述资料
  operator: CURRENT_OPERATOR,
})
// res.data.blocks  → 正文区块
// res.data.citations → 引用明细
// res.data.riskNotes → 风险提示：传说当史实 / 无来源 / 低可信来源 / 授权范围

// 重新生成：保留人工编辑过的区块，响应回传 preservedBlockIds 供界面标出
await generateApi.regenerate({ draftId, tone: nextTone, keepEditedBlocks: true, operator: CURRENT_OPERATOR })
~~~

### 6.7 流程 7 · 审核发布

**状态机定义在 `src/api/publish.ts` 的 `TRANSITIONS` 里**，不散落到组件中。界面按钮直接由「当前状态允许的动作」驱动，因此不会出现非法流转按钮（TODO-WF-1 需与后端对齐）：

~~~ts
const TRANSITIONS: Record<PublishStatus, Partial<Record<ReviewAction, PublishStatus>>> = {
  draft:          { submit: 'pending_review' },
  pending_review: { approve: 'approved', reject: 'rejected', withdraw: 'draft' },
  approved:       { publish: 'published', reject: 'rejected' },
  rejected:       { submit: 'pending_review', withdraw: 'draft' },
  published:      { archive: 'archived' },
  archived:       { publish: 'published' },
}
~~~

**乐观锁**：`expectedFrom` 传当前状态，不匹配即拒绝，避免两人同时审核造成状态覆盖：

~~~ts
const res = await publishApi.transition({
  contentId: 'CONTENT-0007',
  action: 'approve',
  expectedFrom: currentStatus.value,   // 乐观锁
  operator: REVIEWER_OPERATOR,
  comment: reviewComment.value,
  checklist: checklist.value,
})
// res.data.status         → 流转后的状态
// res.data.allowedActions → 当前状态允许的下一步，直接驱动按钮
~~~

**发布前三项确认**由接口自身兜底（缺一即报错），前端同时用 disabled 阻止无效提交：

~~~ts
await publishApi.publish({
  contentId,
  operator: REVIEWER_OPERATOR,
  confirmLicense: true,    // 已确认授权范围
  confirmCitation: true,   // 已确认引用标注完整
  confirmReviewed: true,   // 已确认完成审核
})
~~~

### 6.8 四个 AI 工具（工具契约层）

四个工具 `retrieve_local_sources`、`compare_claims`、`build_story_card`、`submit_review` 各有两种到达方式：
①主体通路走 `src/api/*`（REST，流程页主数据）；②工具通路走 `src/services/toolClient.ts`（契约层）。
流程 4/5/6/7 页面里内嵌的 `ToolInvokePanel` 走第 ② 条，让工具调用在界面里**真的被触发并可观测**。

**调用分派**（按工具名走类型化方法，保留完整类型推导）：

~~~ts
function invokeTyped(input: unknown): Promise<ToolResult<unknown>> {
  switch (props.tool) {
    case 'retrieve_local_sources':
      return toolClient.retrieveLocalSources(input as RetrieveLocalSourcesInput)
    case 'compare_claims':
      return toolClient.compareClaims(input as CompareClaimsInput)
    case 'build_story_card':
      return toolClient.buildStoryCard(input as BuildStoryCardInput)
    case 'submit_review':
      return toolClient.submitReview(input as SubmitReviewInput)
  }
}
~~~

**把 ToolResult 适配成 ApiResponse**，从而复用同一套 7 态状态机与错误 UI。关键：工具层的 `ToolErrorCode` 与接口层的 `ApiErrorCode` **不是同一套枚举**，必须显式映射：

~~~ts
const TOOL_ERROR_TO_API: Record<ToolErrorCode, ApiErrorCode> = {
  network: 'network',
  timeout: 'timeout',
  invalid_input: 'validation',
  not_found: 'notFound',
  server: 'server',
  cancelled: 'cancelled',
  unknown: 'unknown',
}

async function callTool(): Promise<ApiResponse<unknown>> {
  const parsed: unknown = JSON.parse(draftJson.value)
  const result = await invokeTyped(parsed)
  if (!result.ok) {
    throw new ApiError({
      code: TOOL_ERROR_TO_API[result.error.code],
      message: result.error.message,
      label: props.title,
    })
  }
  return { data: result.data, status: 200, fromMock: true, tookMs: result.tookMs, empty: false }
}
~~~

**「需人工确认」用真实语义触发**：`build_story_card` 会排除证据不足的论断，只要有排除就进入 confirm 态，让人看见「故事卡为什么少了内容」：

~~~ts
needsConfirm: (data) => {
  if (props.tool !== 'build_story_card') return null
  const output = data as BuildStoryCardOutput
  if (output.omittedClaimIds.length === 0) return null
  return {
    title: '部分论断被排除，需人工确认',
    message: output.omittedClaimIds.length + ' 条论断因证据不足或与来源冲突被排除。',
    details: output.omittedClaimIds,
    confirmText: '已知晓，接受该结果',
    cancelText: '放弃本次结果',
  }
}
~~~

`submit_review` 是唯一的写操作工具，调用前强制二次确认。

---

## 七、新增一个接口 / 一个流程的标准步骤

### 7.1 新增一个接口（改已有模块）

1. `src/types/api/<module>.ts` 加请求 / 响应类型（每个字段写清必填性与默认值）。
2. `src/api/<module>.ts` 加方法：填 `RequestConfig`（`label / method / url / body / mock`），mock 用 `ctx.scenario` 处理空数据与需确认分支。
3. `src/api/endpointCatalog.ts` 登记该端点（方法、路径、类型名、字段表、待确认项）——**不登记视为接口未定义**。
4. `pnpm docs:api` 重新生成 `docs/API-CONTRACT.md`。
5. `pnpm typecheck` 与 `pnpm smoke`。

### 7.2 新增一个流程页

1. `src/views/FlowNxxxView.vue`，以 `FlowHeader` 开头并传入 `step / title / description / phase / endpoints`。
2. 用 `useAsyncTask` 包住每一个接口调用，不要写散装 `isLoading`。
3. 用 `AsyncStateBoundary` 渲染 7 态，并为 `empty` / `unavailable` 提供**可执行动作**。
4. `src/router/index.ts` 的 `routes` 加一条（`step` 决定侧边栏编号与排序）。
5. 页脚的 `ApiContractPanel` 由 `App.vue` 统一挂载，页面本身不用重复挂。

---

## 八、容易踩的坑

| 坑 | 现象 | 正确做法 |
| --- | --- | --- |
| `SourceKind` 与 `SourceType` 混淆 | 工具层 `kinds` 用五值枚举（interview / document / dataset / media / official），REST 层 `sourceTypes` 用九值枚举（gazetteer / academic / heritage_list…）。**传错不报错，只会静默筛成空结果** | 按所在层选枚举；这是 TODO-ARCH-1 待统一项 |
| 工具校验曾会抛异常 | `toolClient` 文档承诺「永不抛错」，但入参前置校验原本是同步 `throw`，调用方拿不到 `ToolResult` | 已修：`guarded()` 把校验异常也收敛为 `ok:false` |
| 在模板里内联对象字面量传给可编辑面板 | 每次渲染生成新对象，覆盖用户正在编辑的 JSON | 定义模块级常量保证引用稳定 |
| 演示音源短于转写时间轴 | 设置 `currentTime` 越界抛错 | 用 `Math.min(目标, el.duration)` 夹取 |
| `lowConfidence` 重复判断 | 前后端阈值不一致，标记结果对不上 | 后端下发 `lowConfidenceThreshold`，前端只展示 |
| 破坏性操作无二次确认 | 误合并实体、误回滚版本、误提交整批 | 合并 / 回滚 / 提交整批 / 发布都必须 `ModalDialog` 确认 |
| 直接 `v-html` 渲染高亮 | XSS 风险 | 字符串切分后渲染 `<mark>` |
| `import.meta.env` 散落各处 | 变量缺省时行为不可预期 | 一律走 `src/config/env.ts`，所有字段有默认值 |
| Mock 场景的「失败」只失败一次 | 点重试一直失败，无法演示成功路径 | `nextAttempt()` 按「接口 + 第几次调用」计数：首次失败、重试成功（设计如此，勿改） |

---

## 九、视觉系统：志书校样

前端 UI 已按 impeccable 技能的流程整体重做。产品事实见 `PRODUCT.md`，耐久视觉决策见 `DESIGN.md`。

一句话：**这是一张校样纸，不是一块仪表盘。** 界面被当作一份待校的地方志书稿处理——纸、界行、校勘标记、编号、钤印。

### 9.1 令牌

全部令牌在 `src/style.css` 的 `@theme` 块。**不要再写死颜色**，也不要用 Tailwind 默认色阶（`slate-800` 之类）。

| 令牌 | 用途 |
| --- | --- |
| `paper` / `paper-2` / `paper-3` / `sheet` | 页底纸 / 元信息条 / 次级填充 / 校样纸面 |
| `ink` / `ink-2` / `ink-3` / `ink-4` | 正文 / 二级 / 三级 / 最小号；`ink-4` 是正文允许的最浅值（≥4.5:1） |
| `rule` / `rule-soft` / `rule-strong` | 1px 界行，三档分量 |
| `seal` / `seal-2` / `seal-ink` | **唯一的非语义强调**：焦点、选中、当前流程 |
| `vermilion` | **只**表示差异 / 风险 / 驳回 / 错误 |
| `verified` | **只**表示已核实 / 一致 / 通过 |
| `attention` | **只**表示存疑 / 待确认 / 低置信度 |

语义色各配一个 `-wash` 极浅底，用于行内标记。

### 9.2 七条版式纪律

1. **圆角为 0**。控件是「印上去的矩形」，不是软糖。
2. **界行分区，不用卡片**。`PanelSection` 默认是一道通栏界行 + 留白，不是圆角容器。
3. **禁止卡片套卡片**。这是最常见的模板化痕迹。
4. **等宽只用于数据**：编号、时间码、置信度、计数、字节、类型名、端点路径、JSON。中文标签用正文字体。
5. **不用 emoji 当图标**。一律 `<AppIcon name="..." />`。
6. **语义色只有三个**，不要给「来源类型」这类非语义分类分配颜色——用图标与文字区分。
7. **只允许一处动效**：内容落版的 `.sweep-in`（一次性 180ms）。禁止无限循环动画与逐节入场。

### 9.3 图标集

`src/components/common/AppIcon.vue` 是自绘 SVG 图标集，统一 24 网格 / 1.5px 描边 / `currentColor`。

新增图标两步：在 `ICONS` 里加一组 `path d`；不必改类型——`IconName` 由 `ICONS` 自动推导。

**`IconName` 类型的价值**：它把「字形当图标」变成编译错误。迁移时它一次抓出了 `⏳`、`≠`、`?`、`ℹ`、`🃏` 五处漏网的符号——这些在运行时只会静默渲染成字体字形。

### 9.4 浏览器表面

以下都由调色板主题化（这是「做过设计」而不是「拼装页面」最便宜的证据，也是最容易被跳过的一项）：
文本选择、插入符、滚动条、焦点环、下划线偏移、`::placeholder`、表单控件的 `accent-color`、`color-scheme`、表格数字的 `tabular-nums`。

### 9.5 暗色变体

明暗是由**使用场景**选的（办公室白天、连续数小时的文本比对），所以默认浅色。
令牌层已隔离，切换只需给 `<html>` 加 `data-theme="dark"`。

### 9.6 自查

```bash
pnpm typecheck
pnpm build
pnpm smoke
node .dsh/skills/impeccable/scripts/impeccable.cmd detect dist/index.html
```

最后一条是 impeccable 的确定性检测器（59 条规则）。当前结果：**0 条反模式、0 条建议**。
它曾真实拦下两处问题：无限循环的加载下划线（marquee），以及用斜纹纹理表达「进行中」（repeating-stripes-gradient）。两处都已改为静止实线 + 文字说明。
