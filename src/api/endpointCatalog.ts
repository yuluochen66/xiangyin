/**
 * 接口衔接点目录（前后端协作的单一事实来源）。
 *
 * 用途：
 * 1. 界面上「接口衔接点」面板直接渲染这里的数据，前端开发时无需翻文档；
 * 2. `scripts/gen-api-doc.mjs` 可据此生成 docs/API-CONTRACT.md 的字段表；
 * 3. 后端实现接口时逐条对照，`todos` 字段即为**待确认项清单**。
 *
 * 维护约定：新增端点时必须同时补充本目录，否则视为接口未定义。
 */
import type { HttpMethod } from '@/services/api/types'

/** 字段必填性。 */
export type Requirement = 'M' | 'O' | 'C'

export interface FieldDoc {
  name: string
  type: string
  /** M=必填，O=可选，C=条件必填 */
  requirement: Requirement
  desc: string
  /** 默认值 / 缺省行为。 */
  fallback?: string
}

export interface EndpointDoc {
  id: string
  /** 所属流程 1~7。 */
  flow: number
  module: string
  label: string
  method: HttpMethod
  url: string
  /** 前端请求类型名。 */
  requestType?: string
  responseType: string
  requestFields?: FieldDoc[]
  responseFields?: FieldDoc[]
  /** 前端调用位置。 */
  caller: string
  /** mock 实现位置（后端就绪后此文件可删）。 */
  mockFile: string
  /** 待后端确认项。 */
  todos?: string[]
}

/**
 * 字段简写构造器，保持目录可读的同时减少冗余。
 * @param name 字段名
 * @param type 字段类型
 * @param requirement 是否必填
 * @param desc 字段说明
 * @param fallback 后端未提供时前端使用的兜底值
 * @returns 组装好的字段文档对象
 */
function f(
  name: string,
  type: string,
  requirement: Requirement,
  desc: string,
  fallback?: string,
): FieldDoc {
  const field: FieldDoc = { name, type, requirement, desc }
  if (fallback !== undefined) field.fallback = fallback
  return field
}

/** 必填性中文标签。 */
export const REQUIREMENT_LABEL: Record<Requirement, string> = {
  M: '必填',
  O: '可选',
  C: '条件必填',
}

export const ENDPOINT_CATALOG: EndpointDoc[] = [
  /* ============================ 流程 1 · 上传 ============================ */
  {
    id: 'upload.init',
    flow: 1,
    module: 'upload',
    label: '初始化上传',
    method: 'POST',
    url: '/interviews/uploads:init',
    requestType: 'UploadInitRequest',
    responseType: 'UploadInitResponse',
    caller: 'src/api/upload.ts · uploadApi.init',
    mockFile: 'src/api/upload.ts（内联 mock）+ src/mock/dataset.ts',
    requestFields: [
      f('title', 'string', 'M', '采访标题'),
      f('narrator', 'string', 'M', '讲述人姓名'),
      f('interviewer', 'string', 'M', '采访人姓名'),
      f('fileName', 'string', 'M', '原始文件名，用于重复检测'),
      f('sizeBytes', 'number', 'M', '文件大小（字节），前端先做上限校验'),
      f('mimeType', 'string', 'M', 'audio/mpeg 等'),
      f('durationMs', 'number', 'O', '前端预读时长；浏览器不支持时为 undefined', 'undefined'),
      f('checksum', 'string', 'O', '内容指纹（sha256 前 16 位），用于判定重复', 'undefined'),
      f('recordedAt', 'string', 'M', 'ISO 8601 采录日期'),
      f('recordedPlace', 'string', 'M', '采录地点'),
      f('dialect', 'string', 'O', '方言/语言，如「闽东语·福州话」', 'undefined'),
      f('projectId', 'string', 'O', '项目归属', '当前项目 id'),
      f(
        'licenseType',
        'LicenseType',
        'M',
        '授权类型声明：public / research_only / internal / limited_time',
      ),
    ],
    responseFields: [
      f('uploadId', 'string', 'M', '上传会话 id'),
      f('interviewId', 'string', 'M', '预分配的采访记录 id'),
      f('chunkSizeBytes', 'number', 'M', '后端下发分片大小', '前端默认 4MiB'),
      f('totalChunks', 'number', 'M', '总分片数'),
      f('chunkUrls', 'string[]', 'O', '预签名直传地址；为空表示走后端转发'),
      f('expiresAt', 'string', 'M', '上传会话过期时间（ISO 8601）'),
      f('duplicate', 'DuplicateHit | null', 'M', '重复文件命中；无重复时为 null'),
      f('constraints', 'UploadConstraints', 'M', '后端下发的格式与大小白名单'),
    ],
    todos: [
      'TODO-UP-2：分片是直传（预签名 URL）还是后端转发，直接影响前端进度计算方式。',
      'TODO-UP-1：允许格式白名单最终以哪份清单为准（当前为 mp3/wav/m4a/aac/flac/ogg）。',
      '重复判定依据是文件名、指纹还是两者结合？',
    ],
  },
  {
    id: 'upload.chunk',
    flow: 1,
    module: 'upload',
    label: '上传分片',
    method: 'POST',
    url: '/interviews/uploads/{uploadId}/chunks',
    requestType: 'ChunkUploadRequest',
    responseType: 'ChunkUploadResponse',
    caller: 'src/api/upload.ts · uploadApi.uploadChunk',
    mockFile: 'src/api/upload.ts（内联 mock）',
    requestFields: [
      f('uploadId', 'string', 'M', '上传会话 id（路径参数）'),
      f('chunkIndex', 'number', 'M', '分片下标，从 0 开始'),
      f('totalChunks', 'number', 'M', '总分片数'),
      f('checksum', 'string', 'O', '分片校验和'),
      f('blob', 'Blob', 'M', '分片二进制（multipart/form-data 或直传 body）'),
    ],
    responseFields: [
      f('received', 'number', 'M', '累计已接收分片数'),
      f('progress', 'number', 'M', '0~1 总进度'),
      f('uploadedBytes', 'number', 'M', '已上传字节数'),
      f('remainingMs', 'number | null', 'M', '预估剩余时间，无法估算为 null'),
    ],
    todos: ['分片失败时后端返回什么错误结构？前端需要据此做单分片重传。'],
  },
  {
    id: 'upload.status',
    flow: 1,
    module: 'upload',
    label: '查询上传状态',
    method: 'GET',
    url: '/interviews/uploads/{uploadId}',
    responseType: 'UploadStatusResponse',
    caller: 'src/api/upload.ts · uploadApi.getStatus',
    mockFile: 'src/api/upload.ts（内联 mock）',
    responseFields: [
      f('status', "RemoteTaskStatus | 'merging'", 'M', '上传/合并状态'),
      f('progress', 'number', 'M', '0~1'),
      f('failedChunks', 'number[]', 'M', '失败分片下标，前端据此断点续传'),
      f('message', 'string', 'O', '失败原因'),
    ],
    todos: ['是否需要服务端主动推送（SSE/WebSocket）替代轮询？轮询间隔待定。'],
  },
  {
    id: 'upload.complete',
    flow: 1,
    module: 'upload',
    label: '合并分片',
    method: 'POST',
    url: '/interviews/uploads/{uploadId}:complete',
    responseType: 'UploadCompleteResponse',
    caller: 'src/api/upload.ts · uploadApi.complete',
    mockFile: 'src/api/upload.ts（内联 mock）',
    responseFields: [
      f('interviewId', 'string', 'M', '正式采访记录 id'),
      f('audioUrl', 'string', 'M', '可播放地址（需支持 Range 请求）'),
      f('durationMs', 'number', 'M', '服务端解析出的时长'),
      f('licenseStatus', 'LicenseStatus', 'M', '授权状态，合并后初始为 pending'),
    ],
  },
  {
    id: 'upload.license',
    flow: 1,
    module: 'upload',
    label: '提交授权确认',
    method: 'POST',
    url: '/interviews/{interviewId}/license',
    requestType: 'LicenseConfirmRequest',
    responseType: 'LicenseConfirmResponse',
    caller: 'src/api/upload.ts · uploadApi.confirmLicense',
    mockFile: 'src/api/upload.ts（内联 mock）',
    requestFields: [
      f('decision', "'confirmed' | 'rejected'", 'M', '授权结论'),
      f('licenseType', 'LicenseType', 'M', '最终授权类型，可与上传时声明不同'),
      f('signer', 'string', 'M', '授权人（讲述人或代理人）'),
      f('signedAt', 'string', 'M', 'ISO 8601 签署时间'),
      f('attachments', 'string[]', 'O', '授权书扫描件地址'),
      f('operator', 'OperatorInfo', 'M', '录入人'),
    ],
    responseFields: [
      f('licenseStatus', 'LicenseStatus', 'M', '确认后的授权状态'),
      f('certificateNo', 'string', 'O', '授权凭证编号'),
      f('confirmedAt', 'string', 'O', '确认时间'),
    ],
    todos: ['TODO-AUTH-4：授权书文件是否走同一套上传会话？'],
  },
  {
    id: 'upload.list',
    flow: 1,
    module: 'upload',
    label: '采访列表',
    method: 'GET',
    url: '/interviews',
    responseType: 'InterviewListResponse',
    caller: 'src/api/upload.ts · uploadApi.listInterviews',
    mockFile: 'src/api/upload.ts（内联 mock）',
    responseFields: [
      f('list', 'InterviewSummary[]', 'M', '采访记录列表'),
      f('list[].stage', 'number', 'M', '已推进到的流程编号 1~7，用于概览页进度展示'),
      f('total', 'number', 'M', '总数'),
    ],
    todos: ['是否需要服务端分页与筛选（按讲述人 / 授权状态 / 流程阶段）？'],
  },

  /* ============================ 流程 2 · 转写 ============================ */
  {
    id: 'transcribe.start',
    flow: 2,
    module: 'transcribe',
    label: '发起转写',
    method: 'POST',
    url: '/transcripts:start',
    requestType: 'StartTranscribeRequest',
    responseType: 'StartTranscribeResponse',
    caller: 'src/api/transcribe.ts · transcribeApi.start',
    mockFile: 'src/api/transcribe.ts（内联 mock）',
    requestFields: [
      f('interviewId', 'string', 'M', '采访记录 id'),
      f('language', 'string', 'M', 'BCP 47，如 zh-CN'),
      f('enableDiarization', 'boolean', 'M', '是否启用说话人分离', 'true'),
      f('vocabularyHints', 'string[]', 'O', '领域词表，提升方言与专名识别率'),
      f('modelHint', "'fast' | 'balanced' | 'accurate'", 'O', '模型档位', 'balanced'),
      f('operator', 'OperatorInfo', 'M', '发起人'),
    ],
    responseFields: [
      f('taskId', 'string', 'M', '异步任务 id，用于轮询'),
      f('transcriptId', 'string', 'M', '转写稿 id'),
      f('status', "'queued' | 'running'", 'M', '任务初始状态'),
      f('estimatedMs', 'number', 'M', '预估耗时，用于进度文案'),
      f('aiMeta', 'AiMeta', 'M', '模型版本、置信度、是否需人工确认'),
    ],
    todos: ['TODO-ASR-1：任务是轮询还是支持 SSE 推送？轮询间隔与最大时长待定。'],
  },
  {
    id: 'transcribe.get',
    flow: 2,
    module: 'transcribe',
    label: '拉取转写结果',
    method: 'GET',
    url: '/transcripts/{transcriptId}',
    responseType: 'GetTranscriptResponse',
    caller: 'src/api/transcribe.ts · transcribeApi.getTranscript',
    mockFile: 'src/api/transcribe.ts（内联 mock）',
    responseFields: [
      f('segments', 'TranscriptSegmentDTO[]', 'M', '时间轴片段，音频文本联动的数据基础'),
      f('segments[].confidence', 'number', 'M', '0~1 置信度'),
      f('segments[].lowConfidence', 'boolean', 'M', '是否低于阈值（后端按阈值判定）'),
      f('segments[].originalText', 'string', 'M', 'AI 原始文本，用于版本对比'),
      f('paragraphs', 'TranscriptParagraphDTO[]', 'M', '段落视图数据'),
      f('lowConfidenceThreshold', 'number', 'M', '阈值，后端下发以保证前后端判定一致', '0.72'),
      f('version', 'VersionRef', 'M', '当前版本'),
      f('failureReason', 'string', 'O', '失败原因'),
    ],
    todos: [
      'TODO-ASR-2：低置信度是后端标记还是前端按阈值计算？当前约定后端标记、前端只展示。',
      '词级时间戳（words）是否一定返回？决定文本高亮粒度。',
    ],
  },
  {
    id: 'transcribe.suggestions',
    flow: 2,
    module: 'transcribe',
    label: '获取校正建议',
    method: 'POST',
    url: '/transcripts/{transcriptId}/suggestions',
    responseType: 'SuggestCorrectionsResponse',
    caller: 'src/api/transcribe.ts · transcribeApi.suggestCorrections',
    mockFile: 'src/api/transcribe.ts（GLOSSARY 词表）',
    responseFields: [
      f('suggestions', 'CorrectionSuggestion[]', 'M', '逐段建议，含建议文本、类别与理由'),
      f(
        'suggestions[].category',
        "'typo' | 'dialect' | 'proper_noun' | 'segmentation' | 'other'",
        'M',
        '建议类型，用于分组展示',
      ),
      f('glossaryVersion', 'string', 'M', '词表版本，便于追溯建议来源'),
      f('aiMeta', 'AiMeta', 'M', '模型信息'),
    ],
    todos: ['词表由后端维护还是前端配置？当前 mock 在前端。'],
  },
  {
    id: 'transcribe.corrections',
    flow: 2,
    module: 'transcribe',
    label: '保存校正',
    method: 'POST',
    url: '/transcripts/{transcriptId}/corrections',
    requestType: 'SubmitCorrectionRequest',
    responseType: 'SubmitCorrectionResponse',
    caller: 'src/api/transcribe.ts · transcribeApi.submitCorrections',
    mockFile: 'src/api/transcribe.ts（内联 mock）',
    requestFields: [
      f('baseVersionId', 'string', 'M', '乐观锁：基于哪个版本修改'),
      f('editor', 'OperatorInfo', 'M', '修改人，用于「记录修改人与时间」'),
      f('corrections', 'SegmentCorrection[]', 'M', '本次提交的逐段校正'),
      f('corrections[].segmentId', 'string', 'M', '片段 id'),
      f('corrections[].text', 'string', 'M', '校正后文本'),
      f('corrections[].fromAiSuggestion', 'boolean', 'O', '是否采纳了 AI 建议', 'false'),
      f('saveAsDraft', 'boolean', 'M', 'true 只存草稿不生成版本', 'false'),
      f('note', 'string', 'O', '变更说明'),
    ],
    responseFields: [
      f('versionId', 'string', 'M', '新版本 id'),
      f('changedCount', 'number', 'M', '本次改动条数'),
      f('lowConfidenceRemaining', 'number', 'M', '剩余低置信度片段数'),
      f('conflict', 'object | null', 'M', '乐观锁冲突信息；无冲突为 null'),
    ],
    todos: [
      'TODO-CONFLICT-1：版本冲突时后端是自动合并还是直接拒绝？前端目前按「拒绝并提示刷新」处理。',
    ],
  },
  {
    id: 'transcribe.versions',
    flow: 2,
    module: 'transcribe',
    label: '版本列表',
    method: 'GET',
    url: '/transcripts/{transcriptId}/versions',
    responseType: 'TranscriptVersionListResponse',
    caller: 'src/api/transcribe.ts · transcribeApi.listVersions',
    mockFile: 'src/mock/store.ts',
    responseFields: [
      f('versions', 'TranscriptVersionRecord[]', 'M', '版本列表，倒序'),
      f('versions[].source', "'ai' | 'human' | 'rollback'", 'M', '版本来源，用于界面区分'),
      f('currentVersionId', 'string', 'M', '当前版本 id'),
    ],
  },
  {
    id: 'transcribe.rollback',
    flow: 2,
    module: 'transcribe',
    label: '回滚版本',
    method: 'POST',
    url: '/transcripts/{transcriptId}/rollback',
    requestType: 'RollbackTranscriptRequest',
    responseType: 'RollbackTranscriptResponse',
    caller: 'src/api/transcribe.ts · transcribeApi.rollback',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('targetVersionId', 'string', 'M', '回滚目标版本'),
      f('operator', 'OperatorInfo', 'M', '操作人'),
      f('note', 'string', 'O', '回滚原因'),
    ],
    responseFields: [
      f('currentVersionId', 'string', 'M', '回滚后生成的新版本 id'),
      f('segments', 'TranscriptSegmentDTO[]', 'M', '回滚后的完整片段，前端据此整体替换'),
    ],
    todos: ['回滚是「恢复到旧内容并新建版本」还是「删除中间版本」？当前按前者实现。'],
  },

  /* ============================ 流程 3 · 抽取 ============================ */
  {
    id: 'extract.start',
    flow: 3,
    module: 'extract',
    label: '发起信息抽取',
    method: 'POST',
    url: '/extractions:start',
    requestType: 'StartExtractionRequest',
    responseType: 'StartExtractionResponse',
    caller: 'src/api/extract.ts · extractApi.start',
    mockFile: 'src/api/extract.ts（内联 mock）',
    requestFields: [
      f('interviewId', 'string', 'M', '采访记录 id'),
      f('transcriptId', 'string', 'M', '转写稿 id（抽取基于校正后的文本）'),
      f(
        'kinds',
        'EntityKind[]',
        'M',
        '抽取类别：place / person / event / organization / artifact / time',
      ),
      f('minConfidence', 'number', 'M', '低于该置信度标记为「需人工确认」', '0.72'),
      f('operator', 'OperatorInfo', 'M', '发起人'),
    ],
    responseFields: [
      f('taskId', 'string', 'M', '异步任务 id'),
      f('extractionId', 'string', 'M', '抽取结果 id'),
      f('estimatedMs', 'number', 'M', '预估耗时'),
    ],
  },
  {
    id: 'extract.get',
    flow: 3,
    module: 'extract',
    label: '拉取抽取结果',
    method: 'GET',
    url: '/extractions/{extractionId}',
    responseType: 'GetExtractionResponse',
    caller: 'src/api/extract.ts · extractApi.getExtraction',
    mockFile: 'src/mock/store.ts',
    responseFields: [
      f('entities', 'ExtractedEntity[]', 'M', '实体列表'),
      f('entities[].evidence', 'EvidenceRef[]', 'M', '与原文的对应关系，支撑「跳转到原文」'),
      f('entities[].confirmStatus', 'ConfirmStatus', 'M', 'pending 即界面上的「需人工确认」'),
      f('entities[].uncertaintyNote', 'string', 'O', '不确定性说明'),
      f('pendingConfirmCount', 'number', 'M', '待确认数量'),
      f('duplicateGroups', 'DuplicateGroup[]', 'M', '疑似同义项分组'),
    ],
    todos: ['同义项分组由后端算还是前端算？当前 mock 在前端按名称相似度计算。'],
  },
  {
    id: 'extract.upsert',
    flow: 3,
    module: 'extract',
    label: '新增 / 更新实体',
    method: 'POST',
    url: '/extractions/{extractionId}/entities',
    requestType: 'UpsertEntityRequest',
    responseType: 'UpsertEntityResponse',
    caller: 'src/api/extract.ts · extractApi.upsertEntity',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('entityId', 'string', 'O', '不传=新增，传=更新'),
      f('kind', 'EntityKind', 'M', '类别'),
      f('name', 'string', 'M', '原文形式'),
      f('normalizedName', 'string', 'M', '规范名'),
      f('aliases', 'string[]', 'M', '别名列表'),
      f('confirmStatus', 'ConfirmStatus', 'O', '人工确认结果'),
      f('evidence', 'EvidenceRef[]', 'O', '人工补挂的原文依据'),
      f('operator', 'OperatorInfo', 'M', '操作人'),
    ],
    responseFields: [
      f('entity', 'ExtractedEntity', 'M', '保存后的实体'),
      f('pendingConfirmCount', 'number', 'M', '待确认数量'),
      f('versionNo', 'number', 'M', '数据版本号'),
    ],
  },
  {
    id: 'extract.delete',
    flow: 3,
    module: 'extract',
    label: '删除实体',
    method: 'DELETE',
    url: '/extractions/{extractionId}/entities/{entityId}',
    requestType: 'DeleteEntityRequest',
    responseType: '{ deletedId, pendingConfirmCount }',
    caller: 'src/api/extract.ts · extractApi.deleteEntity',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('entityId', 'string', 'M', '实体 id（路径参数）'),
      f('operator', 'OperatorInfo', 'M', '操作人'),
      f('reason', 'string', 'O', '删除原因，用于审计'),
    ],
    responseFields: [
      f('deletedId', 'string', 'M', '被删除的实体 id'),
      f('pendingConfirmCount', 'number', 'M', '删除后的待确认数量'),
    ],
    todos: ['删除是软删除还是硬删除？审计要求待确认。'],
  },
  {
    id: 'extract.merge',
    flow: 3,
    module: 'extract',
    label: '合并同义项',
    method: 'POST',
    url: '/extractions/{extractionId}/entities:merge',
    requestType: 'MergeEntitiesRequest',
    responseType: 'MergeEntitiesResponse',
    caller: 'src/api/extract.ts · extractApi.mergeEntities',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('primaryId', 'string', 'M', '合并后保留的实体 id'),
      f('mergedIds', 'string[]', 'M', '被合并的实体 id 列表'),
      f('operator', 'OperatorInfo', 'M', '操作人'),
      f('note', 'string', 'O', '合并说明'),
    ],
    responseFields: [
      f('entity', 'ExtractedEntity', 'M', '合并后的主实体'),
      f('mergedAliases', 'string[]', 'M', '合并后的别名集合'),
      f('removedIds', 'string[]', 'M', '被移除的实体 id'),
    ],
    todos: ['合并是否可撤销？若需要，后端应保留合并前后的实体快照。'],
  },
  {
    id: 'extract.batchConfirm',
    flow: 3,
    module: 'extract',
    label: '批量确认',
    method: 'POST',
    url: '/extractions/{extractionId}/entities:batchConfirm',
    requestType: 'BatchConfirmRequest',
    responseType: 'BatchConfirmResponse',
    caller: 'src/api/extract.ts · extractApi.batchConfirm',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('entityIds', 'string[]', 'M', '待确认的实体 id'),
      f('confirmStatus', "'confirmed' | 'rejected'", 'M', '确认结果'),
      f('operator', 'OperatorInfo', 'M', '操作人'),
    ],
    responseFields: [
      f('entities', 'ExtractedEntity[]', 'M', '更新后的实体'),
      f('confirmedCount', 'number', 'M', '本次确认数量'),
      f('pendingConfirmCount', 'number', 'M', '剩余待确认数量'),
    ],
  },

  /* ============================ 流程 4 · 检索 ============================ */
  {
    id: 'search.sources',
    flow: 4,
    module: 'search',
    label: '组合检索资料',
    method: 'POST',
    url: '/sources/search',
    requestType: 'SearchSourcesRequest',
    responseType: 'SearchSourcesResponse',
    caller: 'src/api/search.ts · searchApi.search',
    mockFile: 'src/api/search.ts（EXPANSION_RULES）+ src/mock/dataset.ts',
    requestFields: [
      f('keywords', 'string[]', 'M', '关键词；多词语义（AND/OR）待确认'),
      f('entityIds', 'string[]', 'O', '按流程 3 的实体过滤'),
      f('places', 'string[]', 'O', '地点自由输入'),
      f('persons', 'string[]', 'O', '人物自由输入'),
      f('events', 'string[]', 'O', '事件自由输入'),
      f('timeRange', 'TimeRange', 'O', '时间区间，支持历史纪年文本'),
      f('sourceTypes', 'SourceType[]', 'O', '来源类型过滤'),
      f('credibility', 'CredibilityLevel[]', 'O', '可信度过滤'),
      f('enableQueryExpansion', 'boolean', 'M', '是否启用 AI 智能扩展检索词', 'true'),
      f('enableReRank', 'boolean', 'M', '是否启用 AI 相关度重排', 'true'),
      f('page / pageSize', 'number', 'O', '分页', '1 / 10'),
      f('sort', "'relevance' | 'publishedAt' | 'credibility'", 'O', '排序方式', 'relevance'),
    ],
    responseFields: [
      f('hits', 'SearchHit[]', 'M', '命中结果'),
      f('hits[].credibility', "'high' | 'medium' | 'low' | 'unverified'", 'M', '可信度分级'),
      f('hits[].credibilityScore', 'number', 'M', '0~1 分值，用于排序与展示'),
      f('hits[].excerpt', 'string', 'M', '原文摘录'),
      f('hits[].locator', 'object', 'M', '页码 / 行号 / 链接'),
      f('expandedKeywords', 'ExpandedKeyword[]', 'M', 'AI 扩展词及理由；未启用时为空数组'),
      f('facets', 'SearchFacet[]', 'M', '分面统计，用于筛选栏数量'),
      f('leads', 'RelatedLead[]', 'M', '关联线索，供继续深挖'),
    ],
    todos: [
      'TODO-SEARCH-1：多关键词是 AND 还是 OR？是否支持引号短语与排除词语法？',
      '扩展词与重排是否计费/限流？需要前端做节流提示。',
    ],
  },
  {
    id: 'search.detail',
    flow: 4,
    module: 'search',
    label: '资料详情',
    method: 'GET',
    url: '/sources/{sourceId}',
    responseType: 'GetSourceDetailResponse',
    caller: 'src/api/search.ts · searchApi.getSourceDetail',
    mockFile: 'src/mock/dataset.ts',
    responseFields: [
      f('fullExcerpt', 'string', 'M', '完整摘录（受授权范围限制）'),
      f('citation', 'string', 'M', '引用格式文本，供生成流程直接使用'),
      f('relatedSources', 'SearchHit[]', 'M', '相关资料来源'),
      f('leads', 'RelatedLead[]', 'M', '关联线索'),
    ],
    todos: ['受版权限制的资料，后端是否返回全文？前端需按授权范围降级展示。'],
  },

  /* ============================ 流程 5 · 比对标注 ============================ */
  {
    id: 'compare.start',
    flow: 5,
    module: 'compare',
    label: '发起比对',
    method: 'POST',
    url: '/comparisons:start',
    requestType: 'StartComparisonRequest',
    responseType: 'StartComparisonResponse',
    caller: 'src/api/compare.ts · compareApi.start',
    mockFile: 'src/mock/dataset.ts · DEMO_COMPARISON_ITEMS',
    requestFields: [
      f('draftId', 'string', 'M', '待比对的创作草稿 id'),
      f('claimIds', 'string[]', 'O', '限定比对的论断；不传=全部'),
      f('enableAutoJudge', 'boolean', 'M', '是否启用 AI 自动初判', 'true'),
      f('maxSourcesPerClaim', 'number', 'O', '每条论断最多配对资料数', '1'),
      f('operator', 'OperatorInfo', 'M', '发起人'),
    ],
    responseFields: [
      f('items', 'ComparisonItem[]', 'M', '比对项列表（左：创作内容，右：资料）'),
      f(
        'items[].aiVerdict',
        'CompareVerdict',
        'M',
        'AI 初判：consistent / conflict / needs_verification / insufficient',
      ),
      f('items[].aiReason', 'string', 'M', 'AI 理由说明，必须展示以避免黑箱'),
      f('items[].annotationState', "'unannotated' | 'annotated'", 'M', '人工标注状态'),
      f('stats', 'AnnotationStats', 'M', '标注进度统计'),
    ],
    todos: ['AI 初判是否允许「弃权」（insufficient）？前端已按四态渲染。'],
  },
  {
    id: 'compare.annotations',
    flow: 5,
    module: 'compare',
    label: '提交标注',
    method: 'POST',
    url: '/comparisons/{comparisonId}/annotations',
    requestType: 'SubmitAnnotationsRequest',
    responseType: 'SubmitAnnotationsResponse',
    caller: 'src/api/compare.ts · compareApi.submitAnnotations',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('annotations', 'AnnotationInput[]', 'M', '标注列表'),
      f('annotations[].itemId', 'string', 'M', '比对项 id'),
      f('annotations[].verdict', 'CompareVerdict', 'M', '人工结论'),
      f('annotations[].reason', 'string', 'C', 'verdict 为 conflict / needs_verification 时必填'),
      f('annotations[].reasonTags', 'ConflictReasonTag[]', 'M', '差异原因分类'),
      f('annotator', 'OperatorInfo', 'M', '标注人'),
      f('submitAll', 'boolean', 'M', 'true=整批提交，false=增量保存'),
    ],
    responseFields: [
      f('savedCount', 'number', 'M', '实际写入条数'),
      f('stats', 'AnnotationStats', 'M', '更新后的进度统计'),
      f('invalid', 'object[]', 'M', '校验失败条目，前端需就地提示'),
    ],
    todos: ['增量保存的频率上限？是否需要防抖与并发合并策略？'],
  },
  {
    id: 'compare.rejudge',
    flow: 5,
    module: 'compare',
    label: '请求 AI 重判',
    method: 'POST',
    url: '/comparisons/{comparisonId}/items/{itemId}:rejudge',
    requestType: 'RejudgeItemRequest',
    responseType: 'RejudgeItemResponse',
    caller: 'src/api/compare.ts · compareApi.rejudgeItem',
    mockFile: 'src/api/compare.ts（内联 mock）',
    requestFields: [
      f('itemId', 'string', 'M', '比对项 id（路径参数）'),
      f('hints', 'string', 'O', '人工补充的上下文，用于提升重判质量'),
    ],
    responseFields: [
      f('item', 'ComparisonItem', 'M', '重判后的比对项'),
      f('aiMeta', 'AiMeta', 'M', '重判模型信息'),
    ],
  },

  /* ============================ 流程 6 · 生成 ============================ */
  {
    id: 'generate.create',
    flow: 6,
    module: 'generate',
    label: '生成初稿',
    method: 'POST',
    url: '/generations:create',
    requestType: 'CreateGenerationRequest',
    responseType: 'CreateGenerationResponse',
    caller: 'src/api/generate.ts · generateApi.create',
    mockFile: 'src/mock/dataset.ts · DEMO_GENERATION',
    requestFields: [
      f('outputType', "'story_card' | 'study_script'", 'M', '输出类型'),
      f('tone', 'Tone', 'M', '语气：plain / narrative / academic / child / official'),
      f('length', "'short' | 'medium' | 'long'", 'M', '篇幅'),
      f('title', 'string', 'M', '标题'),
      f('audience', 'string', 'O', '目标读者，如「小学四年级研学团」'),
      f('claimIds', 'string[]', 'M', '纳入的论断（通常来自流程 5 标注为「一致」的条目）'),
      f('sourceIds', 'string[]', 'M', '允许引用的资料 id，约束引用范围'),
      f('requireCitation', 'boolean', 'M', '是否强制逐句标注来源', 'true'),
      f('allowUnverified', 'boolean', 'M', '是否允许收录「待核实」内容', 'false'),
      f('creativity', 'number', 'M', '创作自由度 0~1，0=严格复述资料', '0.2'),
      f('extraInstruction', 'string', 'O', '附加要求'),
    ],
    responseFields: [
      f('blocks', 'DraftBlock[]', 'M', '正文区块'),
      f('blocks[].citationIndexes', 'number[]', 'M', '该区块引用的角标序号'),
      f('citations', 'Citation[]', 'M', '引用来源明细，含定位与摘录'),
      f('riskNotes', 'RiskNote[]', 'M', '生成期风险提示（传说当史实、无来源等）'),
      f('omittedSourceIds', 'string[]', 'M', '因风险被排除的资料，需向用户说明'),
      f('version', 'VersionRef', 'M', '版本信息'),
    ],
    todos: [
      'TODO-GEN-1：生成是同步返回还是异步任务？长文可能超时，需确认是否走任务轮询。',
      '引用角标编号由后端给定还是前端渲染时生成？当前约定后端给定。',
    ],
  },
  {
    id: 'generate.regenerate',
    flow: 6,
    module: 'generate',
    label: '重新生成',
    method: 'POST',
    url: '/generations/{draftId}:regenerate',
    requestType: 'RegenerateRequest',
    responseType: 'RegenerateResponse',
    caller: 'src/api/generate.ts · generateApi.regenerate',
    mockFile: 'src/mock/dataset.ts',
    requestFields: [
      f('tone / length / creativity', '各类型', 'O', '仅覆盖需要变化的参数'),
      f('extraInstruction', 'string', 'O', '附加要求'),
      f('keepEditedBlocks', 'boolean', 'M', '是否保留人工已编辑的区块', 'true'),
    ],
    responseFields: [
      f('blocks / citations / riskNotes', '各类型', 'M', '重新生成后的内容'),
      f('preservedBlockIds', 'string[]', 'M', '被保留的人工编辑区块，需在界面标出'),
    ],
  },
  {
    id: 'generate.save',
    flow: 6,
    module: 'generate',
    label: '保存草稿',
    method: 'PUT',
    url: '/generations/{draftId}',
    requestType: 'SaveDraftRequest',
    responseType: 'SaveDraftResponse',
    caller: 'src/api/generate.ts · generateApi.saveDraft',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('title', 'string', 'M', '标题'),
      f('blocks', 'DraftBlock[]', 'M', '完整正文区块'),
      f('createVersion', 'boolean', 'M', 'true=生成正式版本，false=仅存草稿'),
      f('note', 'string', 'O', '保存说明'),
      f('operator', 'OperatorInfo', 'M', '保存人'),
    ],
    responseFields: [
      f('version', 'VersionRef', 'M', '保存后的版本'),
      f('riskNotes', 'RiskNote[]', 'M', '编辑后重算的风险提示'),
    ],
    todos: ['是否需要自动保存（如每 30 秒）？届时 createVersion 应固定为 false。'],
  },
  {
    id: 'generate.get',
    flow: 6,
    module: 'generate',
    label: '拉取草稿',
    method: 'GET',
    url: '/generations/{draftId}',
    responseType: 'GetDraftResponse',
    caller: 'src/api/generate.ts · generateApi.getDraft',
    mockFile: 'src/mock/store.ts',
    responseFields: [
      f('blocks / citations', '各类型', 'M', '草稿内容'),
      f('status', 'PublishStatus', 'M', '草稿当前所处的发布状态'),
      f('updatedBy', 'OperatorInfo', 'M', '最后修改人'),
    ],
  },

  /* ============================ 流程 7 · 审核发布 ============================ */
  {
    id: 'publish.transition',
    flow: 7,
    module: 'publish',
    label: '状态流转',
    method: 'POST',
    url: '/contents/{contentId}/transitions',
    requestType: 'TransitionRequest',
    responseType: 'TransitionResponse',
    caller: 'src/api/publish.ts · publishApi.transition',
    mockFile: 'src/api/publish.ts（TRANSITIONS 状态机）',
    requestFields: [
      f('action', 'ReviewAction', 'M', 'submit / approve / reject / publish / archive / withdraw'),
      f('expectedFrom', 'PublishStatus', 'M', '乐观锁：期望的当前状态，不匹配则拒绝'),
      f('operator', 'OperatorInfo', 'M', '操作人'),
      f('comment', 'string', 'O', '流转说明 / 审核意见'),
      f('checklist', 'ChecklistItem[]', 'O', '发布前检查清单勾选结果'),
    ],
    responseFields: [
      f('status', 'PublishStatus', 'M', '流转后的状态'),
      f('versionNo', 'number', 'M', '本次流转生成的版本号'),
      f('allowedActions', 'ReviewAction[]', 'M', '当前状态下允许的下一步，前端据此渲染按钮'),
      f('publishedUrl', 'string', 'O', '发布后的对外地址'),
    ],
    todos: [
      'TODO-WF-1：状态机的合法流转表需与后端完全对齐（当前定义见 src/api/publish.ts 的 TRANSITIONS）。',
      '并发流转冲突的返回码与结构待确认。',
    ],
  },
  {
    id: 'publish.riskCheck',
    flow: 7,
    module: 'publish',
    label: 'AI 风险检查',
    method: 'POST',
    url: '/contents/{contentId}/risk-check',
    responseType: 'RiskCheckResponse',
    caller: 'src/api/publish.ts · publishApi.riskCheck',
    mockFile: 'src/api/publish.ts（内联 mock，综合比对与生成阶段数据）',
    responseFields: [
      f('risks', 'ReviewRisk[]', 'M', '风险项列表，含等级、分类、建议处理方式'),
      f(
        'risks[].category',
        'string',
        'M',
        'unsourced_claim / legend_as_fact / low_credibility_source / license_scope / sensitive_content / citation_missing',
      ),
      f('overallLevel', "'low' | 'medium' | 'high'", 'M', '综合风险等级'),
      f('publishable', 'boolean', 'M', '是否允许直接发布'),
      f('blockers', 'string[]', 'M', '阻止发布的原因，前端需逐条展示'),
    ],
    todos: ['风险项是否允许「忽略并说明」？当前设计为必须逐条确认知晓（acknowledged）。'],
  },
  {
    id: 'publish.reviewComment',
    flow: 7,
    module: 'publish',
    label: '提交审核意见',
    method: 'POST',
    url: '/contents/{contentId}/review-comments',
    requestType: 'ReviewCommentRequest',
    responseType: 'ReviewCommentResponse',
    caller: 'src/api/publish.ts · publishApi.reviewComment',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('decision', "'approved' | 'rejected'", 'M', '审核结论'),
      f('comment', 'string', 'C', '驳回时必填'),
      f('riskDecisions', 'object[]', 'O', '逐条风险项的确认结果'),
      f('reviewer', 'OperatorInfo', 'M', '审核人'),
    ],
    responseFields: [
      f('status', 'PublishStatus', 'M', '审核后的状态'),
      f('reviewedAt', 'string', 'M', '审核时间'),
      f('versionNo', 'number', 'M', '审核产生的版本号'),
    ],
  },
  {
    id: 'publish.publish',
    flow: 7,
    module: 'publish',
    label: '最终确认并发布',
    method: 'POST',
    url: '/contents/{contentId}/publish',
    requestType: 'FinalConfirmRequest',
    responseType: 'PublishResponse',
    caller: 'src/api/publish.ts · publishApi.publish',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('confirmLicense', 'boolean', 'M', '已确认授权范围', 'false'),
      f('confirmCitation', 'boolean', 'M', '已确认引用标注完整', 'false'),
      f('confirmReviewed', 'boolean', 'M', '已确认完成审核', 'false'),
      f('operator', 'OperatorInfo', 'M', '发布人'),
      f('note', 'string', 'O', '发布说明'),
    ],
    responseFields: [
      f('publishedUrl', 'string', 'M', '对外地址'),
      f('visibility', "'public' | 'internal'", 'M', '可见范围，由授权类型决定'),
      f('certificateNo', 'string', 'O', '发布凭证编号'),
    ],
  },
  {
    id: 'publish.versions',
    flow: 7,
    module: 'publish',
    label: '版本记录',
    method: 'GET',
    url: '/contents/{contentId}/versions',
    responseType: 'VersionListResponse',
    caller: 'src/api/publish.ts · publishApi.listVersions',
    mockFile: 'src/mock/store.ts',
    responseFields: [
      f('versions', 'ContentVersionRecord[]', 'M', '版本列表，倒序'),
      f('versions[].riskLevel', "'low' | 'medium' | 'high'", 'M', '该版本的风险等级快照'),
      f('currentVersionId', 'string', 'M', '当前版本 id'),
    ],
  },
  {
    id: 'publish.rollback',
    flow: 7,
    module: 'publish',
    label: '回滚版本',
    method: 'POST',
    url: '/contents/{contentId}/rollback',
    responseType: '{ status, versionNo, rolledBackTo }',
    caller: 'src/api/publish.ts · publishApi.rollback',
    mockFile: 'src/mock/store.ts',
    requestFields: [
      f('targetVersionId', 'string', 'M', '回滚目标版本'),
      f('operator', 'OperatorInfo', 'M', '操作人'),
      f('note', 'string', 'O', '回滚原因'),
    ],
    responseFields: [
      f('status', 'PublishStatus', 'M', '回滚后的状态'),
      f('versionNo', 'number', 'M', '新生成的版本号'),
      f('rolledBackTo', 'string', 'M', '实际回滚到的版本 id'),
    ],
    todos: ['已发布内容回滚后，线上是否立即下线？需要与后端确认缓存刷新策略。'],
  },
]

/**
 * 按流程取端点。
 * @param flow 流程序号（1~7）
 * @returns 该流程下的全部端点
 */
export function endpointsOfFlow(flow: number): EndpointDoc[] {
  return ENDPOINT_CATALOG.filter((item) => item.flow === flow)
}

/**
 * 全部待确认项。
 * @returns 全部待确认事项，含所属端点与原始说明
 */
export function allTodos(): Array<{ id: string; label: string; todo: string }> {
  return ENDPOINT_CATALOG.flatMap((item) =>
    (item.todos ?? []).map((todo) => ({ id: item.id, label: item.label, todo })),
  )
}
