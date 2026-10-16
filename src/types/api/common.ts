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
