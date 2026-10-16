/**
 * 从 src/api/endpointCatalog.ts 生成 docs/API-CONTRACT.md。
 *
 * 为什么要有这个脚本：接口目录（endpointCatalog）同时是界面「接口衔接点」面板
 * 与交接文档的数据源。只要目录更新、重新生成文档，两处字段表就不会不一致。
 *
 * 用法：node scripts/gen-api-doc.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 注意：这里刻意不用 esbuild —— 它会 spawn 子进程（在受限沙箱下会 EPERM）。
// typescript 的 transpileModule 在同一进程内完成转译，无需子进程。
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 行内代码标记，避免在源码里直接写反引号。 */
const BT = String.fromCharCode(96)
const c = (text) => BT + text + BT
const fence = BT + BT + BT

/** 把 TS 目录文件转成可被 Node 直接 import 的 ESM。 */
async function loadCatalog() {
  const source = await readFile(resolve(root, 'src/api/endpointCatalog.ts'), 'utf8')
  const { outputText: code } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
    fileName: 'endpointCatalog.ts',
  })

  const tempDir = resolve(root, 'node_modules/.tmp')
  await mkdir(tempDir, { recursive: true })
  const tempFile = resolve(tempDir, 'endpointCatalog.mjs')
  await writeFile(tempFile, code, 'utf8')

  const mod = await import(pathToFileURL(tempFile).href)
  return mod.ENDPOINT_CATALOG
}

const REQUIRED = { M: '必填', O: '可选', C: '条件必填' }

function fieldTable(lines, fields, caption) {
  lines.push('**' + caption + '**', '')
  lines.push('| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const field of fields) {
    lines.push(
      '| ' +
        c(field.name) +
        ' | ' +
        c(field.type) +
        ' | ' +
        REQUIRED[field.requirement] +
        ' | ' +
        field.desc +
        ' | ' +
        (field.fallback === undefined ? '—' : field.fallback) +
        ' |',
    )
  }
  lines.push('')
}

const catalog = await loadCatalog()

const FLOW_TITLES = {
  1: '上传已授权采访录音',
  2: '转写并支持人工校正',
  3: '提取地点 / 人物 / 事件',
  4: '检索地方资料',
  5: '标注一致或有差异之处',
  6: '生成故事卡或研学讲稿',
  7: '审核发布',
}

const L = []
const p = (...items) => L.push(...items)

p('# 乡音有据 · 前后端接口契约', '')
p(
  '> 本文件由 ' +
    c('node scripts/gen-api-doc.mjs') +
    ' 从 ' +
    c('src/api/endpointCatalog.ts') +
    ' **自动生成**，请勿手工编辑。',
  '',
)
p('> 接口目录是唯一事实来源：界面上的「接口衔接点」面板与本文档读取的是同一份数据。', '')
p('', '---', '')
p('## 一、全局约定', '')
p('### 1.1 请求封装', '')
p(
  '业务代码统一通过 ' +
    c("import { request } from '@/services/api'") +
    ' 发起调用，禁止直接使用 ' +
    c('fetch') +
    '。',
  '',
)
p(
  '封装层（' +
    c('src/services/api/httpClient.ts') +
    '）负责：路径参数替换、查询串拼装、鉴权头注入、',
  '',
)
p(
  '超时（默认 ' +
    c('VITE_REQUEST_TIMEOUT_MS') +
    '）、自动重试（指数退避，仅 ' +
    c('network / timeout / server') +
    ' 会重试）、',
  '',
)
p('请求与响应拦截器、统一错误归一。', '')
p('### 1.2 响应信封（TODO-API-2 待确认字段名）', '')
p('当前兼容两种形态，后端取其一即可，前端均已支持：', '')
p(fence + 'jsonc')
p('// A. 带信封')
p('{ "code": 0, "message": "ok", "data": { }, "traceId": "..." }')
p('')
p('// B. 直接返回数据')
p('{ }')
p(fence, '')
p(
  '成功判定：' +
    c('code') +
    ' 为 ' +
    c('0 / 200 / "OK" / "SUCCESS"') +
    ' 之一，或 ' +
    c('success === true') +
    '，或 ' +
    c('code') +
    ' 缺省。',
  '',
)
p(c('traceId') + ' 会透传到界面错误提示中，便于与后端日志对齐。', '')
p('### 1.3 错误码映射', '')
p('| 前端 ' + c('ApiError.code') + ' | HTTP | 是否自动重试 | 界面表现 |')
p('| --- | --- | --- | --- |')
p('| ' + c('network') + ' | — | 是 | 「网络连接失败，请检查网络后重试。」+ 重试按钮 |')
p('| ' + c('timeout') + ' | 408 / 504 | 是 | 「请求超时」+ 重试按钮 |')
p('| ' + c('auth') + ' | 401 | 否 | 清空 token、广播鉴权失效、展示跳转登录页占位 |')
p('| ' + c('forbidden') + ' | 403 | 否 | 无权限提示，不给重试按钮 |')
p('| ' + c('notFound') + ' | 404 | 否 | 资源不存在，给出返回入口 |')
p('| ' + c('validation') + ' | 400 / 422 | 否 | 字段级错误就地标红 |')
p('| ' + c('business') + ' | 200 | 否 | 业务规则拒绝，展示后端 message |')
p('| ' + c('server') + ' | 5xx | 是 | 服务端错误 + 重试按钮 |')
p('| ' + c('unavailable') + ' | 503 | **否** | 「能力不可用，重试不会成功」+ 人工兜底路径 |')
p('| ' + c('cancelled') + ' | 499 | 否 | 静默回到未开始状态 |')
p('')
p('### 1.4 分页（TODO-API-1 待确认字段名）', '')
p(
  '请求：' +
    c('page') +
    '（默认 1）、' +
    c('pageSize') +
    '（默认 10）、' +
    c('sort') +
    '、' +
    c('order') +
    '。',
  '',
)
p(
  '响应：' +
    c('list') +
    ' / ' +
    c('total') +
    ' / ' +
    c('page') +
    ' / ' +
    c('pageSize') +
    ' / ' +
    c('hasMore') +
    '。',
  '',
)
p('### 1.5 鉴权（TODO-AUTH-1 待确认鉴权方式）', '')
p(
  c('Authorization: Bearer <token>') +
    '；token 存于 ' +
    c('localStorage[VITE_AUTH_TOKEN_KEY]') +
    '，',
  '',
)
p(
  '由 ' +
    c('src/services/api/auth.ts') +
    ' 统一管理；401 时清空会话并广播 ' +
    c('xiangyin:auth-expired') +
    '，',
  '',
)
p('App 层负责跳转 ' + c('VITE_LOGIN_PATH') + '。', '')
p('### 1.6 Mock 与场景开关', '')
p(c('VITE_USE_MOCK=true') + ' 时全部接口走各端点的内联 mock，无需后端即可开发。', '')
p(
  '顶栏「Mock 场景」可切换：成功 / 空数据 / 失败 / 加载中 / 不可用 / 需人工确认，用于验证 7 种界面状态。',
  '',
)
p('「失败」场景下**首次调用必失败、重试即可成功**，以便真实走通「失败 → 重试中 → 成功」链路。', '')
p('### 1.7 界面状态机', '')
p(
  '7 种界面状态由 ' +
    c('src/composables/useAsyncTask.ts') +
    ' 统一定义，组件用 ' +
    c('AsyncStateBoundary') +
    ' 渲染，',
  '',
)
p('禁止各页面自行维护 loading 布尔量。状态取值：', '')
p(
  c('idle') +
    ' / ' +
    c('loading') +
    ' / ' +
    c('retrying') +
    ' / ' +
    c('success') +
    ' / ' +
    c('empty') +
    ' / ' +
    c('error') +
    ' / ' +
    c('confirm') +
    ' / ' +
    c('unavailable') +
    '。',
  '',
)
p('', '---', '')
p('## 二、接口清单', '')

const flows = [...new Set(catalog.map((item) => item.flow))].sort((a, b) => a - b)

for (const flow of flows) {
  const items = catalog.filter((item) => item.flow === flow)
  p('')
  p('## 流程 ' + flow + '：' + (FLOW_TITLES[flow] || ''))
  p('')
  p('本流程共 ' + items.length + ' 个接口：' + items.map((item) => c(item.id)).join('、') + '。')
  p('')
  items.forEach((item, index) => {
    p('### ' + flow + '.' + (index + 1) + ' ' + item.label)
    p('')
    p('- **请求**：' + c(item.method + ' ' + item.url))
    p('- **请求类型**：' + c(item.requestType || '（无请求体）'))
    p('- **响应类型**：' + c(item.responseType))
    p('- **前端调用**：' + c(item.caller))
    p('- **mock 实现**：' + c(item.mockFile))
    p('')
    if (item.requestFields && item.requestFields.length > 0)
      fieldTable(L, item.requestFields, '请求字段')
    if (item.responseFields && item.responseFields.length > 0)
      fieldTable(L, item.responseFields, '响应字段')
    if (item.todos && item.todos.length > 0) {
      p('**待确认项**', '')
      for (const todo of item.todos) p('- ❓ ' + todo)
      p('')
    }
  })
}

const todoList = []
for (const item of catalog) {
  for (const todo of item.todos || []) todoList.push({ id: item.id, label: item.label, todo })
}

p('', '---', '')
p('## 三、待确认项清单', '')
p('共 ' + todoList.length + ' 项。这些都是前端无法单方面决定、必须由后端确认的接口细节。', '')
p('| 接口 | 名称 | 待确认内容 |')
p('| --- | --- | --- |')
for (const item of todoList) p('| ' + c(item.id) + ' | ' + item.label + ' | ' + item.todo + ' |')
p('')
p('## 四、类型定义索引', '')
p('| 内容 | 位置 |')
p('| --- | --- |')
const INDEX = [
  ['协议层（信封、分页、错误码、请求配置、mock 场景）', 'src/services/api/types.ts'],
  ['统一请求封装（拦截器 / 超时 / 重试 / 401）', 'src/services/api/httpClient.ts'],
  ['鉴权占位（token 存取 / 请求头注入 / 401 广播）', 'src/services/api/auth.ts'],
  ['错误归一（ApiError）', 'src/services/api/errors.ts'],
  ['公共业务类型（AiMeta / OperatorInfo / VersionRef / 任务状态）', 'src/types/api/common.ts'],
  [
    '流程 1~7 请求与响应类型',
    'src/types/api/{upload,transcribe,extract,search,compare,generate,publish}.ts',
  ],
  ['接口目录（本文件数据源）', 'src/api/endpointCatalog.ts'],
  ['7 态状态机', 'src/composables/useAsyncTask.ts'],
  ['环境变量出口', 'src/config/env.ts（配合 .env.example）'],
]
for (const row of INDEX) p('| ' + row[0] + ' | ' + c(row[1]) + ' |')
p('')
p('生成时间：' + new Date().toISOString())
p('')

const markdown = L.join('\n')

await mkdir(resolve(root, 'docs'), { recursive: true })
await writeFile(resolve(root, 'docs/API-CONTRACT.md'), markdown, 'utf8')

console.log('已生成 docs/API-CONTRACT.md')
console.log('接口数：' + catalog.length + '；待确认项：' + todoList.length)
