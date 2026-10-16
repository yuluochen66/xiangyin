/**
 * 业务接口出口。
 *
 * 使用方式：
 *   import { uploadApi, transcribeApi } from '@/api'
 *   const res = await uploadApi.listInterviews()
 *
 * 所有方法返回 `ApiResponse<T>`，失败时抛出 `ApiError`；
 * 界面层请通过 `useAsyncTask` 统一接住这两种结果。
 */
export { uploadApi, ALLOWED_EXTENSIONS } from './upload'
export { transcribeApi } from './transcribe'
export { extractApi } from './extract'
export { searchApi, SOURCE_TYPE_LABEL, CREDIBILITY_LABEL } from './search'
export { compareApi } from './compare'
export { generateApi } from './generate'
export { publishApi, PUBLISH_STATUS_META, REVIEW_ACTION_LABEL } from './publish'
