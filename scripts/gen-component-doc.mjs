/**
 * 重新生成 docs/FRONTEND-GUIDE.md 的「五、组件清单」章节。
 *
 * 组件说明直接取自各 .vue 文件头部的块注释，因此清单不会与代码脱节。
 * 用法：node scripts/gen-component-doc.mjs   （或 pnpm docs:components）
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const BT = String.fromCharCode(96)
const c = (t) => BT + t + BT
const ROOT = process.cwd()

async function describe(file) {
  const text = await readFile(file, 'utf8')
  const lines = text.split(/\r?\n/).slice(0, 18)
  const start = lines.findIndex((l) => l.trim().startsWith('/**'))
  if (start === -1) return '—'
  const parts = []
  for (let i = start; i < lines.length; i += 1) {
    let t = lines[i].trim()
    if (i === start) t = t.replace(/^\/\*\*/, '').trim()
    if (t.endsWith('*/')) t = t.slice(0, -2).trim()
    t = t.replace(/^\*\s?/, '').trim()
    if (t) parts.push(t)
    if (lines[i].includes('*/')) break
  }
  const s = parts.join(' ')
  return s.length > 54 ? s.slice(0, 54) + '…' : s
}

/**
 * 目录名 → 中文分组标题。新增目录时在此登记，未登记的目录直接以目录名作标题。
 *
 * `flow1`~`flow7` 是各流程页私有的子组件目录：它们只被对应的那个视图引用，
 * 与 `common` 里的跨流程通用件区分开。
 */
const GROUP_LABELS = {
  common: '通用组件',
  review: '审校对照',
  tools: 'AI 能力面板',
  flow1: '流程 1 · 上传采访录音',
  flow2: '流程 2 · 转写与人工校正',
  flow3: '流程 3 · 提取地点人物事件',
  flow4: '流程 4 · 检索地方资料',
  flow5: '流程 5 · 标注一致与差异',
  flow6: '流程 6 · 生成故事卡 / 讲稿',
  flow7: '流程 7 · 审核发布',
}
/** 视图私有目录的排序权重：common 优先，其后按流程序号。 */
const GROUP_ORDER = [
  'common',
  'review',
  'tools',
  'flow1',
  'flow2',
  'flow3',
  'flow4',
  'flow5',
  'flow6',
  'flow7',
]

// 动态扫描实际存在的组件目录，避免目录增删后脚本因硬编码路径而报错
const componentRoot = join(ROOT, 'src/components')
const GROUPS = (await readdir(componentRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a)
    const ib = GROUP_ORDER.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
  })
  .map((name) => ['components/' + name, GROUP_LABELS[name] ?? name])

const rows = []
for (const [dir, label] of GROUPS) {
  const names = (await readdir(join(ROOT, 'src', dir))).filter((n) => n.endsWith('.vue')).sort()
  rows.push('**' + label + '**（src/' + dir + '）', '', '| 组件 | 说明 |', '| --- | --- |')
  for (const n of names)
    rows.push('| ' + c(n) + ' | ' + (await describe(join(ROOT, 'src', dir, n))) + ' |')
  rows.push('')
}

const ROUTE = {
  OverviewView: '/',
  Flow1UploadView: '/upload',
  Flow2TranscribeView: '/transcribe',
  Flow3ExtractView: '/extract',
  Flow4SearchView: '/search',
  Flow5CompareView: '/compare',
  Flow6GenerateView: '/generate',
  Flow7PublishView: '/publish',
}
const views = (await readdir(join(ROOT, 'src/views'))).filter((n) => n.endsWith('.vue')).sort()
rows.push('**页面**（views）', '', '| 页面 | 路由 | 说明 |', '| --- | --- | --- |')
for (const n of views) {
  rows.push(
    '| ' +
      c(n) +
      ' | ' +
      c(ROUTE[n.replace(/\.vue$/, '')] || '-') +
      ' | ' +
      (await describe(join(ROOT, 'src/views', n))) +
      ' |',
  )
}

const guidePath = join(ROOT, 'docs/FRONTEND-GUIDE.md')
const guide = await readFile(guidePath, 'utf8')
const s = guide.indexOf('## 五、组件清单')
const e = guide.indexOf('\n---\n', s)
if (s === -1 || e === -1) {
  console.error('未找到「## 五、组件清单」章节，未做修改。')
  process.exit(1)
}
const head =
  '## 五、组件清单\n\n下表由各组件自身的头部注释自动生成（' +
  c('node scripts/gen-component-doc.mjs') +
  '），保证与代码一致。\n\n'

await writeFile(guidePath, guide.slice(0, s) + head + rows.join('\n') + guide.slice(e), 'utf8')
console.log('组件清单已重建：' + views.length + ' 个页面 + ' + GROUPS.length + ' 个组件目录')
