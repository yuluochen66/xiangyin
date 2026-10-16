# 乡音有据 · 前后端接口契约

> 本文件由 `node scripts/gen-api-doc.mjs` 从 `src/api/endpointCatalog.ts` **自动生成**，请勿手工编辑。

> 接口目录是唯一事实来源：界面上的「接口衔接点」面板与本文档读取的是同一份数据。


---

## 一、全局约定

### 1.1 请求封装

业务代码统一通过 `import { request } from '@/services/api'` 发起调用，禁止直接使用 `fetch`。

封装层（`src/services/api/httpClient.ts`）负责：路径参数替换、查询串拼装、鉴权头注入、

超时（默认 `VITE_REQUEST_TIMEOUT_MS`）、自动重试（指数退避，仅 `network / timeout / server` 会重试）、

请求与响应拦截器、统一错误归一。

### 1.2 响应信封（TODO-API-2 待确认字段名）

当前兼容两种形态，后端取其一即可，前端均已支持：

```jsonc
// A. 带信封
{ "code": 0, "message": "ok", "data": { }, "traceId": "..." }

// B. 直接返回数据
{ }
```

成功判定：`code` 为 `0 / 200 / "OK" / "SUCCESS"` 之一，或 `success === true`，或 `code` 缺省。

`traceId` 会透传到界面错误提示中，便于与后端日志对齐。

### 1.3 错误码映射

| 前端 `ApiError.code` | HTTP | 是否自动重试 | 界面表现 |
| --- | --- | --- | --- |
| `network` | — | 是 | 「网络连接失败，请检查网络后重试。」+ 重试按钮 |
| `timeout` | 408 / 504 | 是 | 「请求超时」+ 重试按钮 |
| `auth` | 401 | 否 | 清空 token、广播鉴权失效、展示跳转登录页占位 |
| `forbidden` | 403 | 否 | 无权限提示，不给重试按钮 |
| `notFound` | 404 | 否 | 资源不存在，给出返回入口 |
| `validation` | 400 / 422 | 否 | 字段级错误就地标红 |
| `business` | 200 | 否 | 业务规则拒绝，展示后端 message |
| `server` | 5xx | 是 | 服务端错误 + 重试按钮 |
| `unavailable` | 503 | **否** | 「能力不可用，重试不会成功」+ 人工兜底路径 |
| `cancelled` | 499 | 否 | 静默回到未开始状态 |

### 1.4 分页（TODO-API-1 待确认字段名）

请求：`page`（默认 1）、`pageSize`（默认 10）、`sort`、`order`。

响应：`list` / `total` / `page` / `pageSize` / `hasMore`。

### 1.5 鉴权（TODO-AUTH-1 待确认鉴权方式）

`Authorization: Bearer <token>`；token 存于 `localStorage[VITE_AUTH_TOKEN_KEY]`，

由 `src/services/api/auth.ts` 统一管理；401 时清空会话并广播 `xiangyin:auth-expired`，

App 层负责跳转 `VITE_LOGIN_PATH`。

### 1.6 Mock 与场景开关

`VITE_USE_MOCK=true` 时全部接口走各端点的内联 mock，无需后端即可开发。

顶栏「Mock 场景」可切换：成功 / 空数据 / 失败 / 加载中 / 不可用 / 需人工确认，用于验证 7 种界面状态。

「失败」场景下**首次调用必失败、重试即可成功**，以便真实走通「失败 → 重试中 → 成功」链路。

### 1.7 界面状态机

7 种界面状态由 `src/composables/useAsyncTask.ts` 统一定义，组件用 `AsyncStateBoundary` 渲染，

禁止各页面自行维护 loading 布尔量。状态取值：

`idle` / `loading` / `retrying` / `success` / `empty` / `error` / `confirm` / `unavailable`。


---

## 二、接口清单


## 流程 1：上传已授权采访录音

本流程共 6 个接口：`upload.init`、`upload.chunk`、`upload.status`、`upload.complete`、`upload.license`、`upload.list`。

### 1.1 初始化上传

- **请求**：`POST /interviews/uploads:init`
- **请求类型**：`UploadInitRequest`
- **响应类型**：`UploadInitResponse`
- **前端调用**：`src/api/upload.ts · uploadApi.init`
- **mock 实现**：`src/api/upload.ts（内联 mock）+ src/mock/dataset.ts`

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

**待确认项**

- ❓ TODO-UP-2：分片是直传（预签名 URL）还是后端转发，直接影响前端进度计算方式。
- ❓ TODO-UP-1：允许格式白名单最终以哪份清单为准（当前为 mp3/wav/m4a/aac/flac/ogg）。
- ❓ 重复判定依据是文件名、指纹还是两者结合？

### 1.2 上传分片

- **请求**：`POST /interviews/uploads/{uploadId}/chunks`
- **请求类型**：`ChunkUploadRequest`
- **响应类型**：`ChunkUploadResponse`
- **前端调用**：`src/api/upload.ts · uploadApi.uploadChunk`
- **mock 实现**：`src/api/upload.ts（内联 mock）`

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

**待确认项**

- ❓ 分片失败时后端返回什么错误结构？前端需要据此做单分片重传。

### 1.3 查询上传状态

- **请求**：`GET /interviews/uploads/{uploadId}`
- **请求类型**：`（无请求体）`
- **响应类型**：`UploadStatusResponse`
- **前端调用**：`src/api/upload.ts · uploadApi.getStatus`
- **mock 实现**：`src/api/upload.ts（内联 mock）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `status` | `RemoteTaskStatus | 'merging'` | 必填 | 上传/合并状态 | — |
| `progress` | `number` | 必填 | 0~1 | — |
| `failedChunks` | `number[]` | 必填 | 失败分片下标，前端据此断点续传 | — |
| `message` | `string` | 可选 | 失败原因 | — |

**待确认项**

- ❓ 是否需要服务端主动推送（SSE/WebSocket）替代轮询？轮询间隔待定。

### 1.4 合并分片

- **请求**：`POST /interviews/uploads/{uploadId}:complete`
- **请求类型**：`（无请求体）`
- **响应类型**：`UploadCompleteResponse`
- **前端调用**：`src/api/upload.ts · uploadApi.complete`
- **mock 实现**：`src/api/upload.ts（内联 mock）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `interviewId` | `string` | 必填 | 正式采访记录 id | — |
| `audioUrl` | `string` | 必填 | 可播放地址（需支持 Range 请求） | — |
| `durationMs` | `number` | 必填 | 服务端解析出的时长 | — |
| `licenseStatus` | `LicenseStatus` | 必填 | 授权状态，合并后初始为 pending | — |

### 1.5 提交授权确认

- **请求**：`POST /interviews/{interviewId}/license`
- **请求类型**：`LicenseConfirmRequest`
- **响应类型**：`LicenseConfirmResponse`
- **前端调用**：`src/api/upload.ts · uploadApi.confirmLicense`
- **mock 实现**：`src/api/upload.ts（内联 mock）`

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

**待确认项**

- ❓ TODO-AUTH-4：授权书文件是否走同一套上传会话？

### 1.6 采访列表

- **请求**：`GET /interviews`
- **请求类型**：`（无请求体）`
- **响应类型**：`InterviewListResponse`
- **前端调用**：`src/api/upload.ts · uploadApi.listInterviews`
- **mock 实现**：`src/api/upload.ts（内联 mock）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `list` | `InterviewSummary[]` | 必填 | 采访记录列表 | — |
| `list[].stage` | `number` | 必填 | 已推进到的流程编号 1~7，用于概览页进度展示 | — |
| `total` | `number` | 必填 | 总数 | — |

**待确认项**

- ❓ 是否需要服务端分页与筛选（按讲述人 / 授权状态 / 流程阶段）？


## 流程 2：转写并支持人工校正

本流程共 6 个接口：`transcribe.start`、`transcribe.get`、`transcribe.suggestions`、`transcribe.corrections`、`transcribe.versions`、`transcribe.rollback`。

### 2.1 发起转写

- **请求**：`POST /transcripts:start`
- **请求类型**：`StartTranscribeRequest`
- **响应类型**：`StartTranscribeResponse`
- **前端调用**：`src/api/transcribe.ts · transcribeApi.start`
- **mock 实现**：`src/api/transcribe.ts（内联 mock）`

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

**待确认项**

- ❓ TODO-ASR-1：任务是轮询还是支持 SSE 推送？轮询间隔与最大时长待定。

### 2.2 拉取转写结果

- **请求**：`GET /transcripts/{transcriptId}`
- **请求类型**：`（无请求体）`
- **响应类型**：`GetTranscriptResponse`
- **前端调用**：`src/api/transcribe.ts · transcribeApi.getTranscript`
- **mock 实现**：`src/api/transcribe.ts（内联 mock）`

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

**待确认项**

- ❓ TODO-ASR-2：低置信度是后端标记还是前端按阈值计算？当前约定后端标记、前端只展示。
- ❓ 词级时间戳（words）是否一定返回？决定文本高亮粒度。

### 2.3 获取校正建议

- **请求**：`POST /transcripts/{transcriptId}/suggestions`
- **请求类型**：`（无请求体）`
- **响应类型**：`SuggestCorrectionsResponse`
- **前端调用**：`src/api/transcribe.ts · transcribeApi.suggestCorrections`
- **mock 实现**：`src/api/transcribe.ts（GLOSSARY 词表）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `suggestions` | `CorrectionSuggestion[]` | 必填 | 逐段建议，含建议文本、类别与理由 | — |
| `suggestions[].category` | `'typo' | 'dialect' | 'proper_noun' | 'segmentation' | 'other'` | 必填 | 建议类型，用于分组展示 | — |
| `glossaryVersion` | `string` | 必填 | 词表版本，便于追溯建议来源 | — |
| `aiMeta` | `AiMeta` | 必填 | 模型信息 | — |

**待确认项**

- ❓ 词表由后端维护还是前端配置？当前 mock 在前端。

### 2.4 保存校正

- **请求**：`POST /transcripts/{transcriptId}/corrections`
- **请求类型**：`SubmitCorrectionRequest`
- **响应类型**：`SubmitCorrectionResponse`
- **前端调用**：`src/api/transcribe.ts · transcribeApi.submitCorrections`
- **mock 实现**：`src/api/transcribe.ts（内联 mock）`

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

**待确认项**

- ❓ TODO-CONFLICT-1：版本冲突时后端是自动合并还是直接拒绝？前端目前按「拒绝并提示刷新」处理。

### 2.5 版本列表

- **请求**：`GET /transcripts/{transcriptId}/versions`
- **请求类型**：`（无请求体）`
- **响应类型**：`TranscriptVersionListResponse`
- **前端调用**：`src/api/transcribe.ts · transcribeApi.listVersions`
- **mock 实现**：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `versions` | `TranscriptVersionRecord[]` | 必填 | 版本列表，倒序 | — |
| `versions[].source` | `'ai' | 'human' | 'rollback'` | 必填 | 版本来源，用于界面区分 | — |
| `currentVersionId` | `string` | 必填 | 当前版本 id | — |

### 2.6 回滚版本

- **请求**：`POST /transcripts/{transcriptId}/rollback`
- **请求类型**：`RollbackTranscriptRequest`
- **响应类型**：`RollbackTranscriptResponse`
- **前端调用**：`src/api/transcribe.ts · transcribeApi.rollback`
- **mock 实现**：`src/mock/store.ts`

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

**待确认项**

- ❓ 回滚是「恢复到旧内容并新建版本」还是「删除中间版本」？当前按前者实现。


## 流程 3：提取地点 / 人物 / 事件

本流程共 6 个接口：`extract.start`、`extract.get`、`extract.upsert`、`extract.delete`、`extract.merge`、`extract.batchConfirm`。

### 3.1 发起信息抽取

- **请求**：`POST /extractions:start`
- **请求类型**：`StartExtractionRequest`
- **响应类型**：`StartExtractionResponse`
- **前端调用**：`src/api/extract.ts · extractApi.start`
- **mock 实现**：`src/api/extract.ts（内联 mock）`

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

### 3.2 拉取抽取结果

- **请求**：`GET /extractions/{extractionId}`
- **请求类型**：`（无请求体）`
- **响应类型**：`GetExtractionResponse`
- **前端调用**：`src/api/extract.ts · extractApi.getExtraction`
- **mock 实现**：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `entities` | `ExtractedEntity[]` | 必填 | 实体列表 | — |
| `entities[].evidence` | `EvidenceRef[]` | 必填 | 与原文的对应关系，支撑「跳转到原文」 | — |
| `entities[].confirmStatus` | `ConfirmStatus` | 必填 | pending 即界面上的「需人工确认」 | — |
| `entities[].uncertaintyNote` | `string` | 可选 | 不确定性说明 | — |
| `pendingConfirmCount` | `number` | 必填 | 待确认数量 | — |
| `duplicateGroups` | `DuplicateGroup[]` | 必填 | 疑似同义项分组 | — |

**待确认项**

- ❓ 同义项分组由后端算还是前端算？当前 mock 在前端按名称相似度计算。

### 3.3 新增 / 更新实体

- **请求**：`POST /extractions/{extractionId}/entities`
- **请求类型**：`UpsertEntityRequest`
- **响应类型**：`UpsertEntityResponse`
- **前端调用**：`src/api/extract.ts · extractApi.upsertEntity`
- **mock 实现**：`src/mock/store.ts`

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

### 3.4 删除实体

- **请求**：`DELETE /extractions/{extractionId}/entities/{entityId}`
- **请求类型**：`DeleteEntityRequest`
- **响应类型**：`{ deletedId, pendingConfirmCount }`
- **前端调用**：`src/api/extract.ts · extractApi.deleteEntity`
- **mock 实现**：`src/mock/store.ts`

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

**待确认项**

- ❓ 删除是软删除还是硬删除？审计要求待确认。

### 3.5 合并同义项

- **请求**：`POST /extractions/{extractionId}/entities:merge`
- **请求类型**：`MergeEntitiesRequest`
- **响应类型**：`MergeEntitiesResponse`
- **前端调用**：`src/api/extract.ts · extractApi.mergeEntities`
- **mock 实现**：`src/mock/store.ts`

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

**待确认项**

- ❓ 合并是否可撤销？若需要，后端应保留合并前后的实体快照。

### 3.6 批量确认

- **请求**：`POST /extractions/{extractionId}/entities:batchConfirm`
- **请求类型**：`BatchConfirmRequest`
- **响应类型**：`BatchConfirmResponse`
- **前端调用**：`src/api/extract.ts · extractApi.batchConfirm`
- **mock 实现**：`src/mock/store.ts`

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


## 流程 4：检索地方资料

本流程共 2 个接口：`search.sources`、`search.detail`。

### 4.1 组合检索资料

- **请求**：`POST /sources/search`
- **请求类型**：`SearchSourcesRequest`
- **响应类型**：`SearchSourcesResponse`
- **前端调用**：`src/api/search.ts · searchApi.search`
- **mock 实现**：`src/api/search.ts（EXPANSION_RULES）+ src/mock/dataset.ts`

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

**待确认项**

- ❓ TODO-SEARCH-1：多关键词是 AND 还是 OR？是否支持引号短语与排除词语法？
- ❓ 扩展词与重排是否计费/限流？需要前端做节流提示。

### 4.2 资料详情

- **请求**：`GET /sources/{sourceId}`
- **请求类型**：`（无请求体）`
- **响应类型**：`GetSourceDetailResponse`
- **前端调用**：`src/api/search.ts · searchApi.getSourceDetail`
- **mock 实现**：`src/mock/dataset.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `fullExcerpt` | `string` | 必填 | 完整摘录（受授权范围限制） | — |
| `citation` | `string` | 必填 | 引用格式文本，供生成流程直接使用 | — |
| `relatedSources` | `SearchHit[]` | 必填 | 相关资料来源 | — |
| `leads` | `RelatedLead[]` | 必填 | 关联线索 | — |

**待确认项**

- ❓ 受版权限制的资料，后端是否返回全文？前端需按授权范围降级展示。


## 流程 5：标注一致或有差异之处

本流程共 3 个接口：`compare.start`、`compare.annotations`、`compare.rejudge`。

### 5.1 发起比对

- **请求**：`POST /comparisons:start`
- **请求类型**：`StartComparisonRequest`
- **响应类型**：`StartComparisonResponse`
- **前端调用**：`src/api/compare.ts · compareApi.start`
- **mock 实现**：`src/mock/dataset.ts · DEMO_COMPARISON_ITEMS`

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

**待确认项**

- ❓ AI 初判是否允许「弃权」（insufficient）？前端已按四态渲染。

### 5.2 提交标注

- **请求**：`POST /comparisons/{comparisonId}/annotations`
- **请求类型**：`SubmitAnnotationsRequest`
- **响应类型**：`SubmitAnnotationsResponse`
- **前端调用**：`src/api/compare.ts · compareApi.submitAnnotations`
- **mock 实现**：`src/mock/store.ts`

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

**待确认项**

- ❓ 增量保存的频率上限？是否需要防抖与并发合并策略？

### 5.3 请求 AI 重判

- **请求**：`POST /comparisons/{comparisonId}/items/{itemId}:rejudge`
- **请求类型**：`RejudgeItemRequest`
- **响应类型**：`RejudgeItemResponse`
- **前端调用**：`src/api/compare.ts · compareApi.rejudgeItem`
- **mock 实现**：`src/api/compare.ts（内联 mock）`

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


## 流程 6：生成故事卡或研学讲稿

本流程共 4 个接口：`generate.create`、`generate.regenerate`、`generate.save`、`generate.get`。

### 6.1 生成初稿

- **请求**：`POST /generations:create`
- **请求类型**：`CreateGenerationRequest`
- **响应类型**：`CreateGenerationResponse`
- **前端调用**：`src/api/generate.ts · generateApi.create`
- **mock 实现**：`src/mock/dataset.ts · DEMO_GENERATION`

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

**待确认项**

- ❓ TODO-GEN-1：生成是同步返回还是异步任务？长文可能超时，需确认是否走任务轮询。
- ❓ 引用角标编号由后端给定还是前端渲染时生成？当前约定后端给定。

### 6.2 重新生成

- **请求**：`POST /generations/{draftId}:regenerate`
- **请求类型**：`RegenerateRequest`
- **响应类型**：`RegenerateResponse`
- **前端调用**：`src/api/generate.ts · generateApi.regenerate`
- **mock 实现**：`src/mock/dataset.ts`

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

### 6.3 保存草稿

- **请求**：`PUT /generations/{draftId}`
- **请求类型**：`SaveDraftRequest`
- **响应类型**：`SaveDraftResponse`
- **前端调用**：`src/api/generate.ts · generateApi.saveDraft`
- **mock 实现**：`src/mock/store.ts`

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

**待确认项**

- ❓ 是否需要自动保存（如每 30 秒）？届时 createVersion 应固定为 false。

### 6.4 拉取草稿

- **请求**：`GET /generations/{draftId}`
- **请求类型**：`（无请求体）`
- **响应类型**：`GetDraftResponse`
- **前端调用**：`src/api/generate.ts · generateApi.getDraft`
- **mock 实现**：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `blocks / citations` | `各类型` | 必填 | 草稿内容 | — |
| `status` | `PublishStatus` | 必填 | 草稿当前所处的发布状态 | — |
| `updatedBy` | `OperatorInfo` | 必填 | 最后修改人 | — |


## 流程 7：审核发布

本流程共 6 个接口：`publish.transition`、`publish.riskCheck`、`publish.reviewComment`、`publish.publish`、`publish.versions`、`publish.rollback`。

### 7.1 状态流转

- **请求**：`POST /contents/{contentId}/transitions`
- **请求类型**：`TransitionRequest`
- **响应类型**：`TransitionResponse`
- **前端调用**：`src/api/publish.ts · publishApi.transition`
- **mock 实现**：`src/api/publish.ts（TRANSITIONS 状态机）`

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

**待确认项**

- ❓ TODO-WF-1：状态机的合法流转表需与后端完全对齐（当前定义见 src/api/publish.ts 的 TRANSITIONS）。
- ❓ 并发流转冲突的返回码与结构待确认。

### 7.2 AI 风险检查

- **请求**：`POST /contents/{contentId}/risk-check`
- **请求类型**：`（无请求体）`
- **响应类型**：`RiskCheckResponse`
- **前端调用**：`src/api/publish.ts · publishApi.riskCheck`
- **mock 实现**：`src/api/publish.ts（内联 mock，综合比对与生成阶段数据）`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `risks` | `ReviewRisk[]` | 必填 | 风险项列表，含等级、分类、建议处理方式 | — |
| `risks[].category` | `string` | 必填 | unsourced_claim / legend_as_fact / low_credibility_source / license_scope / sensitive_content / citation_missing | — |
| `overallLevel` | `'low' | 'medium' | 'high'` | 必填 | 综合风险等级 | — |
| `publishable` | `boolean` | 必填 | 是否允许直接发布 | — |
| `blockers` | `string[]` | 必填 | 阻止发布的原因，前端需逐条展示 | — |

**待确认项**

- ❓ 风险项是否允许「忽略并说明」？当前设计为必须逐条确认知晓（acknowledged）。

### 7.3 提交审核意见

- **请求**：`POST /contents/{contentId}/review-comments`
- **请求类型**：`ReviewCommentRequest`
- **响应类型**：`ReviewCommentResponse`
- **前端调用**：`src/api/publish.ts · publishApi.reviewComment`
- **mock 实现**：`src/mock/store.ts`

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

### 7.4 最终确认并发布

- **请求**：`POST /contents/{contentId}/publish`
- **请求类型**：`FinalConfirmRequest`
- **响应类型**：`PublishResponse`
- **前端调用**：`src/api/publish.ts · publishApi.publish`
- **mock 实现**：`src/mock/store.ts`

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

### 7.5 版本记录

- **请求**：`GET /contents/{contentId}/versions`
- **请求类型**：`（无请求体）`
- **响应类型**：`VersionListResponse`
- **前端调用**：`src/api/publish.ts · publishApi.listVersions`
- **mock 实现**：`src/mock/store.ts`

**响应字段**

| 字段名 | 类型 | 必填 | 说明 | 默认值 / 缺省行为 |
| --- | --- | --- | --- | --- |
| `versions` | `ContentVersionRecord[]` | 必填 | 版本列表，倒序 | — |
| `versions[].riskLevel` | `'low' | 'medium' | 'high'` | 必填 | 该版本的风险等级快照 | — |
| `currentVersionId` | `string` | 必填 | 当前版本 id | — |

### 7.6 回滚版本

- **请求**：`POST /contents/{contentId}/rollback`
- **请求类型**：`（无请求体）`
- **响应类型**：`{ status, versionNo, rolledBackTo }`
- **前端调用**：`src/api/publish.ts · publishApi.rollback`
- **mock 实现**：`src/mock/store.ts`

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

**待确认项**

- ❓ 已发布内容回滚后，线上是否立即下线？需要与后端确认缓存刷新策略。


---

## 三、待确认项清单

共 28 项。这些都是前端无法单方面决定、必须由后端确认的接口细节。

| 接口 | 名称 | 待确认内容 |
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

## 四、类型定义索引

| 内容 | 位置 |
| --- | --- |
| 协议层（信封、分页、错误码、请求配置、mock 场景） | `src/services/api/types.ts` |
| 统一请求封装（拦截器 / 超时 / 重试 / 401） | `src/services/api/httpClient.ts` |
| 鉴权占位（token 存取 / 请求头注入 / 401 广播） | `src/services/api/auth.ts` |
| 错误归一（ApiError） | `src/services/api/errors.ts` |
| 公共业务类型（AiMeta / OperatorInfo / VersionRef / 任务状态） | `src/types/api/common.ts` |
| 流程 1~7 请求与响应类型 | `src/types/api/{upload,transcribe,extract,search,compare,generate,publish}.ts` |
| 接口目录（本文件数据源） | `src/api/endpointCatalog.ts` |
| 7 态状态机 | `src/composables/useAsyncTask.ts` |
| 环境变量出口 | `src/config/env.ts（配合 .env.example）` |

生成时间：2026-10-15T17:30:15.307Z
