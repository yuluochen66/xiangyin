/**
 * 7 个业务模块的接口契约出口。
 *
 * 结构约定：`src/types/api/<module>.ts` 描述字段（本层），
 * `src/api/<module>.ts` 描述端点与 mock 实现（调用层），
 * 两者一一对应，方便前后端按模块对接。
 */
export type {
  AiMeta,
  ConfirmStatus,
  EmptyHint,
  FieldIssue,
  OperatorInfo,
  RemoteTaskStatus,
  VersionRef,
} from './common'

export type {
  AudioFormat,
  ChunkUploadRequest,
  ChunkUploadResponse,
  DuplicateHit,
  InterviewListResponse,
  InterviewSummary,
  LicenseConfirmRequest,
  LicenseConfirmResponse,
  LicenseStatus,
  LicenseType,
  UploadCompleteResponse,
  UploadConstraints,
  UploadInitRequest,
  UploadInitResponse,
  UploadStatusResponse,
} from './upload'

export type {
  CorrectionSuggestion,
  GetTranscriptResponse,
  RollbackTranscriptRequest,
  RollbackTranscriptResponse,
  SegmentCorrection,
  StartTranscribeRequest,
  StartTranscribeResponse,
  SubmitCorrectionRequest,
  SubmitCorrectionResponse,
  SuggestCorrectionsResponse,
  TranscriptParagraphDTO,
  TranscriptSegmentDTO,
  TranscriptVersionListResponse,
  TranscriptVersionRecord,
  TranscriptViewMode,
} from './transcribe'

export type {
  BatchConfirmRequest,
  BatchConfirmResponse,
  DeleteEntityRequest,
  DuplicateGroup,
  EntityKind,
  EvidenceRef,
  ExtractedEntity,
  GetExtractionResponse,
  MergeEntitiesRequest,
  MergeEntitiesResponse,
  StartExtractionRequest,
  StartExtractionResponse,
  UpsertEntityRequest,
  UpsertEntityResponse,
} from './extract'

export type {
  CredibilityLevel,
  ExpandedKeyword,
  GetSourceDetailResponse,
  RelatedLead,
  SearchFacet,
  SearchHit,
  SearchSort,
  SearchSourcesRequest,
  SearchSourcesResponse,
  SourceType,
  TimeRange,
} from './search'

export type {
  AnnotationInput,
  AnnotationStats,
  CompareVerdict,
  ComparisonItem,
  ConflictReasonTag,
  GetComparisonResponse,
  RejudgeItemRequest,
  RejudgeItemResponse,
  StartComparisonRequest,
  StartComparisonResponse,
  SubmitAnnotationsRequest,
  SubmitAnnotationsResponse,
} from './compare'

export type {
  Citation,
  CreateGenerationRequest,
  CreateGenerationResponse,
  DraftBlock,
  GetDraftResponse,
  LengthPreset,
  OutputType,
  RegenerateRequest,
  RegenerateResponse,
  RiskNote,
  SaveDraftRequest,
  SaveDraftResponse,
  Tone,
} from './generate'

export type {
  ChecklistItem,
  ContentVersionRecord,
  FinalConfirmRequest,
  PublishResponse,
  PublishStatus,
  ReviewAction,
  ReviewCommentRequest,
  ReviewCommentResponse,
  ReviewRisk,
  RiskCheckResponse,
  RollbackContentRequest,
  RollbackContentResponse,
  TransitionRequest,
  TransitionResponse,
  VersionListResponse,
} from './publish'
