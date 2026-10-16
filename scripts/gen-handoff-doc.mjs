/**
 * 生成 docs/BACKEND-HANDOFF.md 中的「代码派生」章节。
 *
 * 生成范围（这四节禁止手工编辑，改动会被下次生成覆盖）：
 *   1. §5.0 客观覆盖情况 —— 每个流程的视图文件、行数、私有组件数、端点数
 *   2. §7   接口明细 —— 33 个端点的请求/响应字段表与待确认项
 *   3. §8   数据模型 —— src/types/api/*.ts 与 src/types/domain.ts 的类型源码
 *   4. §11.0 全部待确认项
 *
 * 为什么必须生成：这些内容要和代码严格一致，手抄必然过期。交接文档一旦与代码不符，
 * 后端会照错的字段开发。
 *
 * 用法：pnpm docs:handoff
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 刻意不用 esbuild：它会 spawn 子进程（受限沙箱下 EPERM）。
// typescript 的 transpileModule 在同进程内完成，足够转译本项目这些纯类型 + 常量的模块。
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 行内代码标记，避免在源码里直接写反引号。 */
const BT = String.fromCharCode(96)
const c = (text) => BT + text + BT
const fence = BT + BT + BT

/**
 * 把 TS 模块转译后加载为 ESM。
 * @param relPath 相对仓库根的 TS 文件路径
 * @param outName 转译产物在 node_modules/.tmp 下的文件名
 * @returns 模块导出对象
 */
async function loadTsModule(relPath, outName) {
  const source = await readFile(resolve(root, relPath), 'utf8')
  const { outputText: code } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
    fileName: relPath,
  })
  const tempDir = resolve(root, 'node_modules/.tmp')
  await mkdir(tempDir, { recursive: true })
  const tempFile = resolve(tempDir, outName)
  await writeFile(tempFile, code, 'utf8')
  return import(pathToFileURL(tempFile).href)
}

/** 字段表。 */
function fieldTable(fields) {
  const lines = [
    '| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const f of fields) {
    lines.push(
      '| ' +
        c(f.name) +
        ' | ' +
        c(f.type) +
        ' | ' +
        f.requirement +
        ' | ' +
        f.desc +
        ' | ' +
        (f.fallback === undefined ? '—' : f.fallback) +
        ' |',
    )
  }
  return lines
}

/* ------------------------------------------------------------------ */
/* 1. 客观覆盖情况                                                      */
/* ------------------------------------------------------------------ */

/**
 * 统计文件行数。用于报告视图规模；文件不存在时返回 0 而不是抛错。
 * @param path 文件绝对路径
 * @returns 行数
 */
async function countLines(path) {
  try {
    return (await readFile(path, 'utf8')).split('\n').length
  } catch {
    return 0
  }
}

/**
 * 统计目录下的 .vue 文件数。目录不存在时返回 0（例如某个流程还没拆分）。
 * @param path 目录绝对路径
 * @returns .vue 文件数量
 */
async function countVueFiles(path) {
  try {
    return (await readdir(path)).filter((n) => n.endsWith('.vue')).length
  } catch {
    return 0
  }
}

async function buildFeatures(catalog) {
  const views = await readdir(resolve(root, 'src/views'))
  const flowView = new Map()
  for (const name of views) {
    const m = name.match(/^Flow(\d)/)
    if (m) flowView.set(Number(m[1]), name)
  }
  const lines = [
    '| 流程 | 视图文件 | 行数 | 私有子组件 | 端点数 | 端点 id |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  for (let flow = 1; flow <= 7; flow += 1) {
    const name = flowView.get(flow) ?? '（未找到）'
    const rowCount = await countLines(resolve(root, 'src/views', name))
    const compCount = await countVueFiles(resolve(root, 'src/components', 'flow' + flow))
    const eps = catalog.filter((e) => e.flow === flow)
    lines.push(
      '| ' +
        flow +
        ' | ' +
        c(name) +
        ' | ' +
        rowCount +
        ' | ' +
        compCount +
        ' | ' +
        eps.length +
        ' | ' +
        eps.map((e) => c(e.id)).join('、') +
        ' |',
    )
  }
  const total = catalog.length
  lines.push('', '合计 **' + total + ' 个端点**（含概览页无端点）。\n')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* 2. 接口明细                                                          */
/* ------------------------------------------------------------------ */

function buildEndpoints(catalog) {
  const lines = []
  const flows = [1, 2, 3, 4, 5, 6, 7]
  for (const flow of flows) {
    const eps = catalog.filter((e) => e.flow === flow)
    if (eps.length === 0) continue
    lines.push('### 流程 ' + flow + '（' + eps.length + ' 个端点）', '')
    lines.push(
      '| id | 用途 | 方法 | 路径 | 请求类型 | 响应类型 |',
      '| --- | --- | --- | --- | --- | --- |',
    )
    for (const e of eps) {
      lines.push(
        '| ' +
          c(e.id) +
          ' | ' +
          e.label +
          ' | ' +
          c(e.method) +
          ' | ' +
          c(e.url) +
          ' | ' +
          (e.requestType ? c(e.requestType) : '—') +
          ' | ' +
          c(e.responseType) +
          ' |',
      )
    }
    lines.push('')
    for (const e of eps) {
      lines.push('#### ' + c(e.id + ' · ' + e.label), '')
      lines.push('**接口**：' + c(e.method + ' ' + e.url), '')
      lines.push('- 前端调用位置：' + c(e.caller))
      lines.push('- mock 实现位置：' + c(e.mockFile), '')
      if (e.requestFields && e.requestFields.length) {
        lines.push('**请求字段**', '', ...fieldTable(e.requestFields), '')
      }
      if (e.responseFields && e.responseFields.length) {
        lines.push('**响应字段**', '', ...fieldTable(e.responseFields), '')
      }
      if (e.todos && e.todos.length) {
        lines.push('**待确认**', '')
        for (const t of e.todos) lines.push('- ' + t)
        lines.push('')
      }
    }
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* 3. 数据模型                                                          */
/* ------------------------------------------------------------------ */

async function buildModels() {
  const apiDir = resolve(root, 'src/types/api')
  const files = (await readdir(apiDir)).filter((n) => n.endsWith('.ts')).sort()
  const lines = []
  for (const f of files) {
    const source = await readFile(resolve(apiDir, f), 'utf8')
    lines.push('### ' + c('src/types/api/' + f), '', fence + 'ts', source.trimEnd(), fence, '')
  }
  for (const rel of ['src/types/domain.ts', 'src/types/tools.ts']) {
    const source = await readFile(resolve(root, rel), 'utf8')
    lines.push('### ' + c(rel), '', fence + 'ts', source.trimEnd(), fence, '')
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* 4. 待确认事项                                                        */
/* ------------------------------------------------------------------ */

function buildTodos(catalog) {
  const rows = []
  for (const e of catalog) {
    for (const t of e.todos ?? []) rows.push([e.id, e.label, t])
  }
  const lines = ['共 **' + rows.length + ' 项**，按端点归类。', '']
  lines.push('| 端点 | 用途 | 待确认内容 |', '| --- | --- | --- |')
  for (const [id, label, todo] of rows)
    lines.push('| ' + c(id) + ' | ' + label + ' | ' + todo + ' |')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

const mod = await loadTsModule('src/api/endpointCatalog.ts', 'endpointCatalog.handoff.mjs')
const catalog = mod.ENDPOINT_CATALOG
const LABEL = mod.REQUIREMENT_LABEL
const localized = catalog.map((e) => ({
  ...e,
  requestFields: (e.requestFields ?? []).map((f) => ({ ...f, requirement: LABEL[f.requirement] })),
  responseFields: (e.responseFields ?? []).map((f) => ({
    ...f,
    requirement: LABEL[f.requirement],
  })),
}))

const guidePath = resolve(root, 'docs/BACKEND-HANDOFF.md')
let doc = await readFile(guidePath, 'utf8')

/**
 * 替换 BEGIN/END 标记之间的内容。
 * @param text 原文档
 * @param key 标记名
 * @param body 新内容
 * @returns 替换后的文档
 */
function replaceSection(text, key, body) {
  const begin = '<!-- BEGIN GENERATED: ' + key + ' -->'
  const end = '<!-- END GENERATED: ' + key + ' -->'
  const s = text.indexOf(begin)
  const e = text.indexOf(end)
  if (s === -1 || e === -1) throw new Error('文档缺少生成标记：' + key)
  return text.slice(0, s + begin.length) + '\n\n' + body + '\n\n' + text.slice(e)
}

doc = replaceSection(doc, 'features', await buildFeatures(localized))
doc = replaceSection(doc, 'endpoints', buildEndpoints(localized))
doc = replaceSection(doc, 'models', await buildModels())
doc = replaceSection(doc, 'todos', buildTodos(localized))

await writeFile(guidePath, doc, 'utf8')
console.log(
  '交接文档已生成：' +
    catalog.length +
    ' 个端点 · ' +
    catalog.reduce((n, e) => n + (e.todos?.length ?? 0), 0) +
    ' 项待确认 · ' +
    doc.split('\n').length +
    ' 行',
)
