/**
 * Mock 接口层端到端冒烟测试。
 *
 * 为什么需要它：这是纯前端原型，界面渲染无法在无浏览器环境下断言，
 * 但「接口层 + mock + 场景开关 + 状态机数据流」是可以直接跑通的。
 * 本脚本用 Vite 的 SSR 模块加载器把 src/api/* 在 Node 里真实执行一遍，
 * 覆盖 7 个流程的主要端点与 6 种 Mock 场景。
 *
 * 用法：node scripts/smoke-mock.mjs
 */
import { createServer } from 'vite'

const results = []
let failed = 0

function check(name, condition, detail) {
  const ok = Boolean(condition)
  if (!ok) failed += 1
  results.push({ name, ok, detail: detail === undefined ? '' : String(detail) })
}

async function expectThrow(name, fn, matcher) {
  try {
    await fn()
    check(name, false, '预期抛错但成功返回')
  } catch (error) {
    const message = error && error.message ? error.message : String(error)
    const code = error && error.code ? error.code : ''
    if (matcher) {
      check(name, matcher(code, message), code + ' | ' + message)
    } else {
      check(name, true, code + ' | ' + message)
    }
  }
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const load = (path) => server.ssrLoadModule(path)

  const { uploadApi } = await load('/src/api/upload.ts')
  const { transcribeApi } = await load('/src/api/transcribe.ts')
  const { extractApi } = await load('/src/api/extract.ts')
  const { searchApi } = await load('/src/api/search.ts')
  const { compareApi } = await load('/src/api/compare.ts')
  const { generateApi } = await load('/src/api/generate.ts')
  const { publishApi } = await load('/src/api/publish.ts')
  const scenario = await load('/src/mock/scenario.ts')
  const store = await load('/src/mock/store.ts')
  const services = await load('/src/services/index.ts')
  const catalog = await load('/src/api/endpointCatalog.ts')

  const { setMockScenario, resetAttempts } = scenario
  const { mockStore } = store

  /* ---------------- 0. 接口目录完整性 ---------------- */
  const flows = new Set(catalog.ENDPOINT_CATALOG.map((item) => item.flow))
  check('接口目录覆盖 7 个流程', flows.size === 7, '流程数=' + flows.size)
  check(
    '接口目录每条都有调用位置与 mock 位置',
    catalog.ENDPOINT_CATALOG.every((item) => item.caller && item.mockFile),
    '接口数=' + catalog.ENDPOINT_CATALOG.length,
  )

  /* ---------------- 1. 上传 ---------------- */
  resetAttempts()
  const list = await uploadApi.listInterviews()
  check(
    '流程1 GET /interviews 返回数据',
    list.data.list.length === 3,
    '条数=' + list.data.list.length,
  )

  const init = await uploadApi.init({
    title: '测试采访',
    narrator: '林水妹',
    interviewer: '陈明',
    fileName: 'lin-shuimei-20240312.m4a',
    sizeBytes: 86_400_000,
    mimeType: 'audio/mp4',
    recordedAt: '2024-03-12',
    recordedPlace: '塔巷 12 号',
    licenseType: 'public',
  })
  check(
    '流程1 初始化上传返回 uploadId/totalChunks',
    Boolean(init.data.uploadId) && init.data.totalChunks > 0,
    'totalChunks=' + init.data.totalChunks,
  )
  check(
    '流程1 命中重复文件提示',
    init.data.duplicate !== null,
    init.data.duplicate ? '相似度=' + init.data.duplicate.similarity : 'null',
  )

  const chunk = await uploadApi.uploadChunk(init.data.uploadId, 0, init.data.totalChunks)
  check(
    '流程1 上传分片返回进度',
    chunk.data.progress > 0 && chunk.data.progress <= 1,
    'progress=' + chunk.data.progress,
  )

  const complete = await uploadApi.complete(init.data.uploadId)
  check('流程1 合并分片返回可播放地址', Boolean(complete.data.audioUrl), complete.data.audioUrl)

  const license = await uploadApi.confirmLicense({
    interviewId: complete.data.interviewId,
    decision: 'confirmed',
    licenseType: 'public',
    signer: '林水妹',
    signedAt: new Date().toISOString(),
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check('流程1 授权确认返回凭证号', Boolean(license.data.certificateNo), license.data.certificateNo)

  /* ---------------- 2. 转写 ---------------- */
  const transcript = await transcribeApi.getTranscript('T-2024-0312')
  const lowCount = transcript.data.segments.filter((item) => item.lowConfidence).length
  check(
    '流程2 拉取转写结果（片段/段落）',
    transcript.data.segments.length === 10 && transcript.data.paragraphs.length === 3,
    '片段=' + transcript.data.segments.length + ' 段落=' + transcript.data.paragraphs.length,
  )
  check('流程2 低置信度片段被标记', lowCount === 3, '低置信度=' + lowCount)
  check(
    '流程2 下发低置信度阈值',
    transcript.data.lowConfidenceThreshold === 0.72,
    transcript.data.lowConfidenceThreshold,
  )

  const suggestions = await transcribeApi.suggestCorrections('T-2024-0312')
  check(
    '流程2 AI 校正建议非空且带理由',
    suggestions.data.suggestions.length > 0 &&
      suggestions.data.suggestions.every((item) => item.reason),
    '建议数=' + suggestions.data.suggestions.length,
  )

  const correction = await transcribeApi.submitCorrections({
    transcriptId: 'T-2024-0312',
    baseVersionId: transcript.data.version.versionId,
    editor: { id: 'OP-1001', name: '陈明', role: '编审' },
    corrections: [{ segmentId: 'SEG-002', text: '阮依爹（我父亲）十七岁入漆器行做学徒。' }],
    saveAsDraft: false,
  })
  check(
    '流程2 保存校正生成新版本',
    correction.data.versionNo >= 3,
    'versionNo=' + correction.data.versionNo,
  )

  const versions = await transcribeApi.listVersions('T-2024-0312')
  check(
    '流程2 版本列表倒序且含来源',
    versions.data.versions.length >= 3 && versions.data.versions[0].source,
    '版本数=' + versions.data.versions.length,
  )

  const rolled = await transcribeApi.rollback({
    transcriptId: 'T-2024-0312',
    targetVersionId: versions.data.versions[versions.data.versions.length - 1].versionId,
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check(
    '流程2 回滚返回完整片段',
    rolled.data.segments.length === 10,
    '片段=' + rolled.data.segments.length,
  )

  /* ---------------- 3. 抽取 ---------------- */
  const extraction = await extractApi.getExtraction('EXT-2024-0312')
  const pending = extraction.data.entities.filter((item) => item.confirmStatus === 'pending').length
  check(
    '流程3 抽取结果分类与证据链',
    extraction.data.entities.length === 13 &&
      extraction.data.entities.every((item) => item.evidence.length > 0),
    '实体=' + extraction.data.entities.length,
  )
  check('流程3 存在待人工确认项', pending === 4, '待确认=' + pending)
  check(
    '流程3 同义项分组非空',
    extraction.data.duplicateGroups.length > 0,
    '分组=' + extraction.data.duplicateGroups.length,
  )

  const merged = await extractApi.mergeEntities({
    extractionId: 'EXT-2024-0312',
    primaryId: 'ENT-P-001',
    mergedIds: ['ENT-P-005'],
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check(
    '流程3 同义项合并保留别名',
    merged.data.mergedAliases.includes('三坊巷') && merged.data.removedIds.includes('ENT-P-005'),
    merged.data.mergedAliases.join('/'),
  )

  const batch = await extractApi.batchConfirm({
    extractionId: 'EXT-2024-0312',
    entityIds: mockStore.entities
      .filter((item) => item.confirmStatus === 'pending')
      .map((item) => item.id),
    confirmStatus: 'confirmed',
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check(
    '流程3 批量确认后无待确认项',
    batch.data.pendingConfirmCount === 0,
    '剩余=' + batch.data.pendingConfirmCount,
  )

  /* ---------------- 4. 检索 ---------------- */
  const search = await searchApi.search({
    keywords: ['漆器'],
    enableQueryExpansion: true,
    enableReRank: true,
    page: 1,
    pageSize: 10,
    sort: 'relevance',
  })
  check('流程4 检索命中资料', search.data.hits.length > 0, '命中=' + search.data.hits.length)
  check(
    '流程4 AI 扩展检索词带回理由',
    search.data.expandedKeywords.length > 0 &&
      search.data.expandedKeywords.every((item) => item.reason),
    '扩展词=' + search.data.expandedKeywords.map((item) => item.term).join('/'),
  )
  check(
    '流程4 命中结果带可信度分级',
    search.data.hits.every((item) =>
      ['high', 'medium', 'low', 'unverified'].includes(item.credibility),
    ),
    search.data.hits.map((item) => item.credibility).join(','),
  )
  check('流程4 分面统计非空', search.data.facets.length === 2, '分面=' + search.data.facets.length)

  const detail = await searchApi.getSourceDetail(search.data.hits[0].sourceId)
  check(
    '流程4 详情返回引用格式与相关资料',
    Boolean(detail.data.citation) && detail.data.relatedSources.length >= 0,
    detail.data.citation,
  )

  /* ---------------- 5. 比对标注 ---------------- */
  const comparison = await compareApi.start({
    draftId: mockStore.generation.draftId,
    enableAutoJudge: true,
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  const verdicts = new Set(comparison.data.items.map((item) => item.aiVerdict))
  check(
    '流程5 比对项含 AI 初判与理由',
    comparison.data.items.length === 6 && comparison.data.items.every((item) => item.aiReason),
    '比对项=' + comparison.data.items.length,
  )
  check('流程5 AI 初判覆盖多种结论', verdicts.size >= 3, [...verdicts].join('/'))

  const invalidSubmit = await compareApi.submitAnnotations({
    comparisonId: 'CMP-2024-0007',
    annotator: { id: 'OP-1001', name: '陈明', role: '编审' },
    submitAll: false,
    annotations: [{ itemId: 'CMP-001', verdict: 'conflict', reason: '', reasonTags: [] }],
  })
  check(
    '流程5 判定为差异但未填原因时被拒绝',
    invalidSubmit.data.invalid.length === 1 && invalidSubmit.data.savedCount === 0,
    invalidSubmit.data.invalid[0] ? invalidSubmit.data.invalid[0].message : '',
  )

  const annotate = await compareApi.submitAnnotations({
    comparisonId: 'CMP-2024-0007',
    annotator: { id: 'OP-1001', name: '陈明', role: '编审' },
    submitAll: true,
    annotations: comparison.data.items.map((item) => ({
      itemId: item.itemId,
      verdict: item.aiVerdict === 'insufficient' ? 'insufficient' : item.aiVerdict,
      reason: item.aiReason,
      reasonTags: item.aiReasonTags,
    })),
  })
  check(
    '流程5 批量标注后进度 100%',
    annotate.data.stats.progress === 1,
    'progress=' + annotate.data.stats.progress + ' 冲突=' + annotate.data.stats.conflict,
  )

  /* ---------------- 6. 生成 ---------------- */
  const generation = await generateApi.create({
    outputType: 'study_script',
    tone: 'child',
    length: 'short',
    title: '研学讲稿：一双手推亮的漆器',
    claimIds: ['CLM-01', 'CLM-02'],
    sourceIds: mockStore.sources.map((item) => item.sourceId),
    requireCitation: true,
    allowUnverified: false,
    creativity: 0.2,
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check(
    '流程6 生成研学讲稿（含引用与角标）',
    generation.data.blocks.length > 0 && generation.data.citations.length > 0,
    '区块=' + generation.data.blocks.length + ' 引用=' + generation.data.citations.length,
  )
  check(
    '流程6 输出类型与篇幅参数生效',
    generation.data.outputType === 'study_script' &&
      generation.data.blocks.length === 3 &&
      generation.data.blocks[0].heading.startsWith('第 1 站'),
    generation.data.blocks[0].heading,
  )
  check(
    '流程6 生成期风险提示非空',
    generation.data.riskNotes.length > 0,
    '风险=' + generation.data.riskNotes.length,
  )

  const saved = await generateApi.saveDraft({
    draftId: generation.data.draftId,
    title: generation.data.title,
    createVersion: true,
    blocks: generation.data.blocks.map((block, index) =>
      index === 0 ? { ...block, edited: true, citationIndexes: [] } : block,
    ),
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check(
    '流程6 保存草稿重算风险（缺引用告警）',
    saved.data.riskNotes.some((note) => note.category === 'unsourced'),
    '风险=' + saved.data.riskNotes.length,
  )

  const regenerated = await generateApi.regenerate({
    draftId: generation.data.draftId,
    tone: 'academic',
    keepEditedBlocks: true,
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check(
    '流程6 重新生成保留人工编辑区块',
    regenerated.data.preservedBlockIds.length === 1,
    '保留=' + regenerated.data.preservedBlockIds.join('/'),
  )

  /* ---------------- 7. 审核发布 ---------------- */
  const risk = await publishApi.riskCheck('CONTENT-0007')
  check(
    '流程7 AI 风险检查给出等级与阻断原因',
    risk.data.risks.length > 0 &&
      risk.data.overallLevel === 'high' &&
      risk.data.blockers.length > 0,
    '风险=' + risk.data.risks.length + ' 阻断=' + risk.data.blockers.length,
  )
  check(
    '流程7 存在 critical 风险时禁止发布',
    risk.data.publishable === false,
    'publishable=' + risk.data.publishable,
  )

  const draftStatus = publishApi.currentStatus()
  check('流程7 初始状态为 draft', draftStatus === 'draft', draftStatus)

  await expectThrow(
    '流程7 乐观锁：状态不符时拒绝流转',
    () =>
      publishApi.transition({
        contentId: 'CONTENT-0007',
        action: 'approve',
        expectedFrom: 'approved',
        operator: { id: 'OP-1002', name: '黄丽云', role: '审核员' },
      }),
    (code, message) => message.includes('状态已变更'),
  )

  const submitted = await publishApi.transition({
    contentId: 'CONTENT-0007',
    action: 'submit',
    expectedFrom: 'draft',
    operator: { id: 'OP-1001', name: '陈明', role: '编审' },
  })
  check(
    '流程7 draft → pending_review 并返回可执行动作',
    submitted.data.status === 'pending_review' && submitted.data.allowedActions.includes('approve'),
    submitted.data.allowedActions.join('/'),
  )

  const approved = await publishApi.reviewComment({
    contentId: 'CONTENT-0007',
    decision: 'approved',
    comment: '已核对闽王建塔一说，改为转述语气，同意发布。',
    riskDecisions: [],
    reviewer: { id: 'OP-1002', name: '黄丽云', role: '审核员' },
  })
  check('流程7 审核通过', approved.data.status === 'approved', approved.data.status)

  const published = await publishApi.publish({
    contentId: 'CONTENT-0007',
    operator: { id: 'OP-1002', name: '黄丽云', role: '审核员' },
    confirmLicense: true,
    confirmCitation: true,
    confirmReviewed: true,
  })
  check(
    '流程7 发布成功返回地址与可见范围',
    published.data.status === 'published' && published.data.visibility === 'public',
    published.data.publishedUrl + ' / ' + published.data.visibility,
  )

  await expectThrow('流程7 发布前三项确认缺一不可', () =>
    publishApi.publish({
      contentId: 'CONTENT-0007',
      operator: { id: 'OP-1002', name: '黄丽云', role: '审核员' },
      confirmLicense: true,
      confirmCitation: false,
      confirmReviewed: true,
    }),
  )

  const contentVersions = await publishApi.listVersions('CONTENT-0007')
  check(
    '流程7 版本记录含状态与风险等级',
    contentVersions.data.versions.length >= 5 &&
      contentVersions.data.versions.every((item) => item.riskLevel),
    '版本=' + contentVersions.data.versions.length,
  )

  const contentRollback = await publishApi.rollback({
    contentId: 'CONTENT-0007',
    targetVersionId:
      contentVersions.data.versions[contentVersions.data.versions.length - 1].versionId,
    operator: { id: 'OP-1002', name: '黄丽云', role: '审核员' },
  })
  check(
    '流程7 版本回滚返回新版本号',
    contentRollback.data.versionNo > 5 && Boolean(contentRollback.data.updatedAt),
    'versionNo=' + contentRollback.data.versionNo,
  )

  /* ---------------- 四个 AI 工具契约层（与流程 4/5/6/7 内嵌面板同一条路径） ---------------- */
  const { toolClient } = services

  // 入参与流程 4 面板默认值保持一致：kinds 必须用工具层的 SourceKind 枚举
  const toolRetrieve = await toolClient.retrieveLocalSources({
    query: '脱胎漆器 推光',
    kinds: ['interview', 'official', 'dataset'],
    limit: 5,
    minConfidence: 0,
  })
  check(
    '工具 retrieve_local_sources（流程 4 面板入参）',
    toolRetrieve.ok === true &&
      toolRetrieve.data.items.length > 0 &&
      toolRetrieve.data.items[0].score > 0,
    toolRetrieve.ok
      ? '命中=' +
          toolRetrieve.data.items.length +
          ' 首条=' +
          (toolRetrieve.data.items[0] ? toolRetrieve.data.items[0].source.label : '无')
      : '失败=' + toolRetrieve.error.message,
  )

  const toolCompare = await toolClient.compareClaims({
    claimIds: ['C-01', 'C-02', 'C-03', 'C-04', 'C-05'],
    strictMode: false,
  })
  check(
    '工具 compare_claims（流程 5 面板入参）',
    toolCompare.ok === true &&
      toolCompare.data.assessments.length === 5 &&
      toolCompare.data.summary.contradicted >= 1 &&
      toolCompare.data.assessments.every((item) => item.rationale.length > 0),
    toolCompare.ok ? JSON.stringify(toolCompare.data.summary) : '失败=' + toolCompare.error.message,
  )

  const toolStory = await toolClient.buildStoryCard({
    title: '一双手推亮的漆器：塔巷里的脱胎往事',
    claimIds: ['C-01', 'C-02', 'C-03', 'C-04', 'C-05'],
    sourceIds: ['SRC-01', 'SRC-02', 'SRC-03', 'SRC-04', 'SRC-05', 'SRC-06'],
    tone: 'neutral',
  })
  check(
    '工具 build_story_card（流程 6 面板入参，被排除论断会触发需人工确认）',
    toolStory.ok === true &&
      toolStory.data.card.timeline.length > 0 &&
      toolStory.data.omittedClaimIds.length > 0,
    toolStory.ok
      ? '关键论断=' +
          toolStory.data.card.keyClaimIds.length +
          ' 被排除=' +
          toolStory.data.omittedClaimIds.join('/') +
          ' 风险=' +
          toolStory.data.card.riskLevel
      : '失败=' + toolStory.error.message,
  )

  const toolReview = await toolClient.submitReview({
    reviewId: 'REVIEW-2024-0312-07',
    reviewer: '审校 赵岚',
    decisions: [
      { unitId: 'RU-01', status: 'accepted', note: '工序描述与非遗名录一致。' },
      { unitId: 'RU-02', status: 'flagged', note: '铺号地点与宗谱不符，需讲述人复核。' },
      { unitId: 'RU-03', status: 'accepted', note: '已改为转述语气。' },
      { unitId: 'RU-04', status: 'accepted', note: '补入「前店后坊」的来源标注。' },
    ],
    comment: '整体可用；RU-02 的地点差异需讲述人复核后再定稿。',
  })
  check(
    '工具 submit_review（流程 7 面板入参，写操作返回回执）',
    toolReview.ok === true &&
      Boolean(toolReview.data.receiptId) &&
      toolReview.data.accepted === 3 &&
      toolReview.data.flagged === 1,
    toolReview.ok
      ? '回执=' +
          toolReview.data.receiptId +
          ' 接受=' +
          toolReview.data.accepted +
          ' 标记=' +
          toolReview.data.flagged
      : '失败=' + toolReview.error.message,
  )

  const toolInvalid = await toolClient.compareClaims({ claimIds: [] })
  check(
    '工具入参前置校验返回 invalid_input 而非抛异常',
    toolInvalid.ok === false &&
      toolInvalid.error.code === 'invalid_input' &&
      toolInvalid.error.retryable === false,
    toolInvalid.ok ? '未拦截' : toolInvalid.error.code + ' | ' + toolInvalid.error.message,
  )

  // 这条断言把一个真实的踩坑点固化下来：工具层 kinds 用的是 SourceKind 五值枚举，
  // 若误传 REST 层的 SourceType（如 'gazetteer'），不会报错，只会静默筛成空结果。
  const toolWrongKinds = await toolClient.retrieveLocalSources({
    query: '脱胎漆器',
    kinds: ['gazetteer'],
  })
  check(
    '工具层 kinds 用 SourceKind 枚举（误传 REST 层 SourceType 会静默筛空）',
    toolWrongKinds.ok === true && toolWrongKinds.data.items.length === 0,
    toolWrongKinds.ok
      ? '命中=' + toolWrongKinds.data.items.length
      : '失败=' + toolWrongKinds.error.message,
  )

  const toolMiss = await toolClient.retrieveLocalSources({ query: 'zzz-不存在的词' })
  check(
    '工具检索无命中时返回空数组而非报错',
    toolMiss.ok === true && toolMiss.data.items.length === 0 && toolMiss.data.total === 0,
    toolMiss.ok ? 'total=' + toolMiss.data.total : '失败=' + toolMiss.error.message,
  )

  /* ---------------- 6 种 Mock 场景 ---------------- */
  setMockScenario('empty')
  const emptySearch = await searchApi.search({
    keywords: ['漆器'],
    enableQueryExpansion: false,
    enableReRank: false,
    page: 1,
    pageSize: 10,
    sort: 'relevance',
  })
  check(
    '场景「空数据」返回空列表且被标记 empty',
    emptySearch.data.hits.length === 0 && emptySearch.empty === true,
    'empty=' + emptySearch.empty,
  )

  setMockScenario('unavailable')
  await expectThrow(
    '场景「不可用」抛出不可重试错误',
    () =>
      searchApi.search({
        keywords: ['漆器'],
        enableQueryExpansion: false,
        enableReRank: false,
        page: 1,
        pageSize: 10,
        sort: 'relevance',
      }),
    (code) => code === 'unavailable',
  )

  setMockScenario('failure')
  await expectThrow(
    '场景「失败」首次调用失败',
    () =>
      searchApi.search({
        keywords: ['漆器'],
        enableQueryExpansion: false,
        enableReRank: false,
        page: 1,
        pageSize: 10,
        sort: 'relevance',
      }),
    (code) => code === 'server',
  )
  const retryOk = await searchApi.search({
    keywords: ['漆器'],
    enableQueryExpansion: false,
    enableReRank: false,
    page: 1,
    pageSize: 10,
    sort: 'relevance',
  })
  check(
    '场景「失败」重试后成功（失败→重试中→成功）',
    retryOk.data.hits.length > 0,
    '命中=' + retryOk.data.hits.length,
  )

  setMockScenario('needsConfirm')
  const confirmScenario = await compareApi.getComparison('CMP-2024-0007')
  check(
    '场景「需人工确认」仍返回数据供确认',
    confirmScenario.data.items.length > 0,
    '比对项=' + confirmScenario.data.items.length,
  )

  setMockScenario('normal')
} finally {
  await server.close()
}

const width = Math.max(...results.map((item) => item.name.length))
for (const item of results) {
  console.log(
    (item.ok ? '  PASS  ' : '  FAIL  ') +
      item.name.padEnd(width) +
      (item.detail ? '  [' + item.detail + ']' : ''),
  )
}
console.log('')
console.log('共 ' + results.length + ' 项断言，失败 ' + failed + ' 项。')
process.exit(failed === 0 ? 0 : 1)
