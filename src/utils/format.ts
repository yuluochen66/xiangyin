/**
 * 数值与时间的展示格式化工具。
 *
 * 约定：本模块每个导出函数都标注 **参数含义、返回值形态与边界行为**
 * （负数、非法输入、超范围值如何处理），因为这些函数直接决定界面上的数字呈现。
 */

/**
 * 把毫秒格式化为时间码。
 *
 * @param ms 毫秒，负数按 0 处理
 * @param withMillis 是否保留一位小数秒（转写列表默认保留，进度条默认不保留）
 * @returns `mm:ss.s`，超过一小时返回 `hh:mm:ss.s`
 */
export function formatTimecode(ms: number, withMillis = true): string {
  const safe = Math.max(0, Number.isFinite(ms) ? ms : 0)
  const totalSeconds = safe / 1000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const tenths = Math.floor((safe % 1000) / 100)

  const pad = (value: number, size = 2): string => String(value).padStart(size, '0')
  const base =
    hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`

  return withMillis ? `${base}.${tenths}` : base
}

/**
 * 把毫秒格式化为「X 分 Y 秒」这类自然语言时长，用于进度与耗时文案。
 *
 * @param ms 毫秒；负数与非法值按 0 处理
 * @returns 例如「45 秒」「2 分」「3 分 20 秒」
 */
export function formatDurationText(ms: number): string {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} 秒`
  if (seconds === 0) return `${minutes} 分`
  return `${minutes} 分 ${seconds} 秒`
}

/**
 * 把 ISO 8601 字符串格式化为本地时区的 `YYYY-MM-DD HH:mm`。
 *
 * @param iso ISO 8601 字符串，例如 `2024-03-13T10:12:00+08:00`
 * @returns 格式化结果；**无法解析时原样返回入参**，避免界面上出现 `Invalid Date`
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * 把 ISO 8601 字符串格式化为本地时区的 `YYYY-MM-DD`。
 *
 * @param iso ISO 8601 字符串
 * @returns 格式化结果；无法解析时原样返回入参
 */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 把 0~1 的比值格式化为百分比字符串。
 *
 * @param value 比值，正常范围 0~1；非法值按 0 处理（不裁剪超过 1 的值，以免掩盖数据问题）
 * @param fractionDigits 小数位数，默认 0
 * @returns 例如 `0.86` + 默认参数 → `"86%"`
 */
export function formatPercent(value: number, fractionDigits = 0): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${(safe * 100).toFixed(fractionDigits)}%`
}

/**
 * 把字节数格式化为 `12.4 MB` 这类可读文本，用于上传体积展示。
 *
 * @param bytes 字节数；`0`、负数与非法值一律返回 `"0 B"`
 * @returns 单位自动落在 B / KB / MB / GB / TB；`B` 不带小数，其余保留一位
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/**
 * 把数值夹取到闭区间 `[min, max]`。用于进度、音量与比例计算。
 *
 * @param value 待夹取的数值
 * @param min 下界
 * @param max 上界
 * @returns 落入区间的数值；若 `min > max`，返回 `max`（Math.max 的语义），调用方需自行保证区间合法
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

let uidCounter = 0

/**
 * 生成短生命周期的唯一 id，仅用于前端本地对象（列表 key、临时实体）。
 *
 * **不要**用它做持久化主键——它由时间戳与自增计数器拼成，跨设备不保证唯一。
 *
 * @param prefix id 前缀，便于在调试时辨认来源
 * @returns 形如 `uid-m1x2y3-1` 的字符串
 */
export function uid(prefix = 'uid'): string {
  uidCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}`
}
