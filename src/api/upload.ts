/**
 * 流程 1：上传已授权采访录音 —— 接口调用层。
 *
 * 每个方法 = 一个后端端点，签名即接口契约（入参/出参类型见 src/types/api/upload.ts）。
 * 切换真实后端时，只需把 VITE_USE_MOCK 置为 false，本文件无需改动。
 */
import { request } from '@/services/api'
import type { ApiResponse } from '@/services/api/httpClient'
import { isConfirmScenario, isEmptyScenario, mockId, nowIso } from '@/mock/helpers'
import { DUPLICATE_SAMPLE, UPLOAD_CONSTRAINTS } from '@/mock/dataset'
import { mockStore } from '@/mock/store'
import type {
  ChunkUploadResponse,
  InterviewListResponse,
  LicenseConfirmRequest,
  LicenseConfirmResponse,
  UploadCompleteResponse,
  UploadInitRequest,
  UploadInitResponse,
  UploadStatusResponse,
} from '@/types/api'

/** 允许的音频扩展名（前端做首轮格式校验，与 UPLOAD_CONSTRAINTS 保持一致）。 */
export const ALLOWED_EXTENSIONS = UPLOAD_CONSTRAINTS.allowedFormats

export const uploadApi = {
  /**
   * 初始化上传会话。
   * POST /interviews/uploads:init
   * TODO-UP-2 待确认：分片直传（预签名 URL）还是统一走本接口转发。
   * @param body 上传初始化请求体：文件名、大小与格式
   * @returns 上传会话：uploadId、分片大小与已上传分片
   */
  init(body: UploadInitRequest): Promise<ApiResponse<UploadInitResponse>> {
    return request<UploadInitRequest, UploadInitResponse>({
      label: '初始化上传',
      method: 'POST',
      url: '/interviews/uploads:init',
      body,
      mock: (ctx) => {
        const uploadId = mockId('UP')
        const interviewId = mockId('INT')
        const chunkSizeBytes = UPLOAD_CONSTRAINTS.chunkSizeBytes
        const totalChunks = Math.max(1, Math.ceil(body.sizeBytes / chunkSizeBytes))

        mockStore.uploads[uploadId] = {
          uploadId,
          interviewId,
          fileName: body.fileName,
          totalBytes: body.sizeBytes,
          totalChunks,
          uploadedChunks: 0,
          status: 'uploading',
          failedChunks: [],
          meta: { ...body },
        }

        // 同名 / 内容重复：真实场景由后端按文件名 + 指纹判定
        const duplicated =
          body.fileName === DUPLICATE_SAMPLE.fileName &&
          !isConfirmScenario(ctx) &&
          !isEmptyScenario(ctx)
        const forceDuplicate = isConfirmScenario(ctx)

        return {
          uploadId,
          interviewId,
          chunkSizeBytes,
          totalChunks,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          duplicate: duplicated || forceDuplicate ? { ...DUPLICATE_SAMPLE } : null,
          constraints: { ...UPLOAD_CONSTRAINTS },
        }
      },
    })
  },

  /**
   * 上传单个分片。
   * POST /interviews/uploads/{uploadId}/chunks
   * @param uploadId 上传会话 id
   * @param chunkIndex 分片序号，从 0 开始
   * @param totalChunks 分片总数
   * @returns 该分片的上传结果与整体进度
   */
  uploadChunk(
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
  ): Promise<ApiResponse<ChunkUploadResponse>> {
    return request<Record<string, unknown>, ChunkUploadResponse>({
      label: '上传分片',
      method: 'POST',
      url: '/interviews/uploads/{uploadId}/chunks',
      path: { uploadId },
      body: { chunkIndex, totalChunks },
      mock: () => {
        const record = mockStore.uploads[uploadId]
        if (record) {
          record.uploadedChunks = Math.min(record.totalChunks, record.uploadedChunks + 1)
          record.status = record.uploadedChunks >= record.totalChunks ? 'merging' : 'uploading'
        }
        const received = record?.uploadedChunks ?? chunkIndex + 1
        const total = record?.totalChunks ?? totalChunks
        const progress = total > 0 ? received / total : 0
        const uploadedBytes = record ? Math.round(record.totalBytes * progress) : 0
        return {
          uploadId,
          chunkIndex,
          received,
          total,
          progress: Number(progress.toFixed(4)),
          uploadedBytes,
          remainingMs: Math.max(0, (total - received) * 260),
        }
      },
    })
  },

  /**
   * 查询上传状态（断点续传 / 进度轮询）。
   * GET /interviews/uploads/{uploadId}
   * @param uploadId 上传会话 id
   * @returns 上传进度与已完成分片列表
   */
  getStatus(uploadId: string): Promise<ApiResponse<UploadStatusResponse>> {
    return request<unknown, UploadStatusResponse>({
      label: '查询上传进度',
      method: 'GET',
      url: '/interviews/uploads/{uploadId}',
      path: { uploadId },
      mock: () => {
        const record = mockStore.uploads[uploadId]
        if (!record) {
          return {
            uploadId,
            status: 'failed' as const,
            uploadedBytes: 0,
            totalBytes: 0,
            progress: 0,
            remainingMs: null,
            failedChunks: [],
            message: '上传会话不存在或已过期。',
          }
        }
        const progress = record.totalChunks > 0 ? record.uploadedChunks / record.totalChunks : 0
        // 'uploading' 不是 RemoteTaskStatus 的取值，映射为 'running'
        const status: UploadStatusResponse['status'] =
          record.uploadedChunks >= record.totalChunks
            ? 'merging'
            : record.status === 'uploading'
              ? 'running'
              : record.status
        return {
          uploadId,
          status,
          uploadedBytes: Math.round(record.totalBytes * progress),
          totalBytes: record.totalBytes,
          progress: Number(progress.toFixed(4)),
          remainingMs: null,
          failedChunks: record.failedChunks,
        }
      },
    })
  },

  /**
   * 合并分片，生成正式采访记录。
   * POST /interviews/uploads/{uploadId}:complete
   * @param uploadId 上传会话 id
   * @returns 上传完成后的采访记录
   */
  complete(uploadId: string): Promise<ApiResponse<UploadCompleteResponse>> {
    return request<unknown, UploadCompleteResponse>({
      label: '合并上传文件',
      method: 'POST',
      url: '/interviews/uploads/{uploadId}:complete',
      path: { uploadId },
      mock: () => {
        const record = mockStore.uploads[uploadId]
        const interviewId = record?.interviewId ?? mockId('INT')
        if (record) {
          record.status = 'succeeded'
          record.uploadedChunks = record.totalChunks
        }
        return {
          interviewId,
          audioUrl: '/demo/audio-demo.wav',
          durationMs: 754_000,
          status: 'succeeded' as const,
          licenseStatus: 'pending' as const,
        }
      },
    })
  },

  /**
   * 提交授权确认。
   * POST /interviews/{interviewId}/license
   * @param body 授权确认请求体：会话 id 与授权类型
   * @returns 更新后的授权信息
   */
  confirmLicense(body: LicenseConfirmRequest): Promise<ApiResponse<LicenseConfirmResponse>> {
    return request<LicenseConfirmRequest, LicenseConfirmResponse>({
      label: '提交授权确认',
      method: 'POST',
      url: '/interviews/{interviewId}/license',
      path: { interviewId: body.interviewId },
      body,
      mock: () => ({
        interviewId: body.interviewId,
        licenseStatus:
          body.decision === 'confirmed' ? ('confirmed' as const) : ('rejected' as const),
        licenseType: body.licenseType,
        confirmedBy: body.signer,
        confirmedAt: nowIso(),
        certificateNo: body.decision === 'confirmed' ? mockId('LIC') : undefined,
      }),
    })
  },

  /**
   * 采访列表。
   * GET /interviews
   * @returns 采访记录列表
   */
  listInterviews(): Promise<ApiResponse<InterviewListResponse>> {
    return request<unknown, InterviewListResponse>({
      label: '获取采访列表',
      method: 'GET',
      url: '/interviews',
      mock: (ctx) => {
        if (isEmptyScenario(ctx)) return { list: [], total: 0 }
        return { list: mockStore.interviews, total: mockStore.interviews.length }
      },
      isEmpty: (data) => data.list.length === 0,
    })
  },
}
