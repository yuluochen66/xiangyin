/**
 * 福州地方文化口述史演示数据集。
 *
 * 这是 mock 层的唯一数据源，同时也是**接口字段的活样例**：
 * 后端实现任一接口时，可直接参照这里的数据形状。
 *
 * 剧情设定：三坊七巷老住户林水妹的口述采访，
 * 围绕坊巷生活、脱胎漆器、茉莉花茶与闽剧展开，
 * 数据中刻意保留了「传说 / 个人记忆 / 史实」三类容易混淆的内容。
 */
import type {
  ComparisonItem,
  ContentVersionRecord,
  CreateGenerationResponse,
  ExtractedEntity,
  DuplicateGroup,
  InterviewSummary,
  OperatorInfo,
  SearchHit,
  TranscriptParagraphDTO,
  TranscriptSegmentDTO,
} from '@/types/api'
import type { UploadConstraints } from '@/types/api'

/* ------------------------------------------------------------------ */
/* 项目与人员                                                          */
/* ------------------------------------------------------------------ */

export interface ProjectInfo {
  projectId: string
  name: string
  description: string
  /** 已收录采访数。 */
  interviewCount: number
  /** 已完成流程的条目数。 */
  publishedCount: number
}

export const DEMO_PROJECT: ProjectInfo = {
  projectId: 'PRJ-FZ-ORAL-2024',
  name: '乡音有据 · 福州地方文化口述整理与共创',
  description:
    '面向三坊七巷及闽都文化片区的口述采访整理项目，目标是把分散的录音、方志与民间传说分层标注，避免创作时把传说与个人记忆写成史实。',
  interviewCount: 18,
  publishedCount: 5,
}

/** 当前登录用户（鉴权占位数据，真实环境由 /auth/me 返回）。 */
export const CURRENT_OPERATOR: OperatorInfo = {
  id: 'OP-1001',
  name: '陈明',
  role: '编审',
}

export const REVIEWER_OPERATOR: OperatorInfo = {
  id: 'OP-1002',
  name: '黄丽云',
  role: '审核员',
}

/* ------------------------------------------------------------------ */
/* 上传约束                                                            */
/* ------------------------------------------------------------------ */

export const UPLOAD_CONSTRAINTS: UploadConstraints = {
  allowedFormats: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'],
  maxSizeBytes: 500 * 1024 * 1024,
  maxDurationMs: 4 * 60 * 60 * 1000,
  minDurationMs: 10 * 1000,
  chunkSizeBytes: 4 * 1024 * 1024,
}

/* ------------------------------------------------------------------ */
/* 采访列表                                                            */
/* ------------------------------------------------------------------ */

export const DEMO_INTERVIEWS: InterviewSummary[] = [
  {
    interviewId: 'INT-2024-0312',
    title: '林水妹：塔巷里的漆器铺与坊巷生活',
    narrator: '林水妹',
    interviewer: '陈明',
    recordedAt: '2024-03-12',
    recordedPlace: '三坊七巷·塔巷 12 号',
    durationMs: 754_000,
    fileName: 'lin-shuimei-20240312.m4a',
    format: 'm4a',
    sizeBytes: 86_400_000,
    licenseStatus: 'confirmed',
    licenseType: 'public',
    stage: 3,
    createdAt: '2024-03-12T09:20:00+08:00',
  },
  {
    interviewId: 'INT-2024-0405',
    title: '郑依伯：水榭戏台与闽剧票友',
    narrator: '郑依伯',
    interviewer: '陈明',
    recordedAt: '2024-04-05',
    recordedPlace: '三坊七巷·水榭戏台',
    durationMs: 1_120_000,
    fileName: 'zheng-yibo-20240405.mp3',
    format: 'mp3',
    sizeBytes: 64_200_000,
    licenseStatus: 'pending',
    licenseType: 'research_only',
    stage: 1,
    createdAt: '2024-04-05T14:05:00+08:00',
  },
  {
    interviewId: 'INT-2024-0421',
    title: '茉莉花茶窨制技艺的口述记录',
    narrator: '王秀英',
    interviewer: '黄丽云',
    recordedAt: '2024-04-21',
    recordedPlace: '福州·仓山 螺洲',
    durationMs: 980_000,
    fileName: 'wang-xiuying-20240421.wav',
    format: 'wav',
    sizeBytes: 176_400_000,
    licenseStatus: 'confirmed',
    licenseType: 'public',
    stage: 2,
    createdAt: '2024-04-21T10:30:00+08:00',
  },
]

/** 重复文件样例：用于演示「同名 / 重复文件处理提示」。 */
export const DUPLICATE_SAMPLE = {
  interviewId: 'INT-2024-0312',
  title: '林水妹：塔巷里的漆器铺与坊巷生活',
  fileName: 'lin-shuimei-20240312.m4a',
  uploadedAt: '2024-03-12T09:20:00+08:00',
  uploadedBy: CURRENT_OPERATOR,
  similarity: 0.98,
  suggestion: 'skip' as const,
}

/* ------------------------------------------------------------------ */
/* 转写稿（流程 2）                                                     */
/* ------------------------------------------------------------------ */

/** 低置信度阈值建议值：0.72（低于此值界面上标黄并要求人工复核）。 */
export const LOW_CONFIDENCE_THRESHOLD = 0.72

export const DEMO_SEGMENTS: TranscriptSegmentDTO[] = [
  {
    id: 'SEG-001',
    index: 0,
    startMs: 0,
    endMs: 12_400,
    speaker: '林水妹',
    text: '我细汉就住伲塔巷，巷口头一间就是做脱胎漆器的铺，半迷暗都听着师傅咧刮灰。',
    originalText: '我细汉就住伲塔巷，巷口头一间就是做脱胎漆器的铺，半迷暗都听着师傅咧刮灰。',
    confidence: 0.93,
    lowConfidence: false,
    edited: true,
    editedBy: CURRENT_OPERATOR,
    editedAt: '2024-03-13T10:12:00+08:00',
  },
  {
    id: 'SEG-002',
    index: 1,
    startMs: 12_400,
    endMs: 27_800,
    speaker: '林水妹',
    text: '阮依爹——就是我阿爸，伊名号叫林依妹，十七岁就入漆器行做学徒。',
    originalText: '阮依爹就是我阿爸，伊名号叫林依妹，十七岁就入漆器行做学徒。',
    confidence: 0.61,
    lowConfidence: true,
    edited: false,
  },
  {
    id: 'SEG-003',
    index: 2,
    startMs: 27_800,
    endMs: 46_200,
    speaker: '林水妹',
    text: '塔巷这名字啊，听老人讲是闽王王审知辰候在这建过一座木塔，后来塔倒了，巷名留到现在。',
    originalText:
      '塔巷这名字啊，听老人讲是闽王王审知辰候在这建过一座木塔，后来塔倒了，巷名留到现在。',
    confidence: 0.88,
    lowConfidence: false,
    edited: false,
  },
  {
    id: 'SEG-004',
    index: 3,
    startMs: 46_200,
    endMs: 68_500,
    speaker: '陈明',
    text: '那漆器铺当时做的是什么活计？',
    originalText: '那漆器铺当时做的是什么活计？',
    confidence: 0.97,
    lowConfidence: false,
    edited: false,
  },
  {
    id: 'SEG-005',
    index: 4,
    startMs: 68_500,
    endMs: 95_300,
    speaker: '林水妹',
    text: '做脱胎的嘛，先用泥土塑一个模，再一层麻布一层生漆贴上去，阴干干了后把土胚敲出来，剩一层壳，叫作脱胎。',
    originalText:
      '做脱胎的嘛，先用泥土塑一个模，再一层麻布一层生漆贴上去，阴干干了后把土胚敲出来，剩一层壳，叫作脱胎。',
    confidence: 0.79,
    lowConfidence: false,
    edited: false,
  },
  {
    id: 'SEG-006',
    index: 5,
    startMs: 95_300,
    endMs: 118_900,
    speaker: '林水妹',
    text: '我听伊讲，一件像样的漆器爱做四十外道工序，推光那道最费神，用手掌蘸着细灰一直推，推到会照人影。',
    originalText:
      '我听伊讲，一件像样的漆器爱做四十外道工序，推光那道最费神，用手掌蘸着细灰一直推，推到会照人影。',
    confidence: 0.66,
    lowConfidence: true,
    edited: false,
  },
  {
    id: 'SEG-007',
    index: 6,
    startMs: 118_900,
    endMs: 142_700,
    speaker: '林水妹',
    text: '一九五八年，福州脱胎漆器厂办起来，阮阿爸就转去厂里做技术师傅，那辰候漆器是出口创汇的大宗。',
    originalText:
      '一九五八年，福州脱胎漆器厂办起来，阮阿爸就转去厂里做技术师傅，那辰候漆器是出口创汇的大宗。',
    confidence: 0.84,
    lowConfidence: false,
    edited: false,
  },
  {
    id: 'SEG-008',
    index: 7,
    startMs: 142_700,
    endMs: 170_100,
    speaker: '林水妹',
    text: '南后街原先两边全是做手工艺的，油纸伞、牛角梳、角梳、还有裱褙字画的，一条街会行半日。',
    originalText:
      '南后街原先两边全是做手工艺的，油纸伞、牛角梳、角梳、还有裱褙字画的，一条街会行半日。',
    confidence: 0.58,
    lowConfidence: true,
    edited: true,
    editedBy: CURRENT_OPERATOR,
    editedAt: '2024-03-13T10:40:00+08:00',
  },
  {
    id: 'SEG-009',
    index: 8,
    startMs: 170_100,
    endMs: 198_400,
    speaker: '林水妹',
    text: '阮厝里逐日暗晡都泡茉莉花茶，茶是仓山那边窨的，窨一次换一批花，要窨七八次才有那个香。',
    originalText:
      '阮厝里逐日暗晡都泡茉莉花茶，茶是仓山那边窨的，窨一次换一批花，要窨七八次才有那个香。',
    confidence: 0.81,
    lowConfidence: false,
    edited: false,
  },
  {
    id: 'SEG-010',
    index: 9,
    startMs: 198_400,
    endMs: 221_000,
    speaker: '林水妹',
    text: '水榭戏台逢年过节都有闽剧，我囡仔辰候是搬一条板凳去看的，戏文听无全，热闹是有的。',
    originalText:
      '水榭戏台逢年过节都有闽剧，我囡仔辰候是搬一条板凳去看的，戏文听无全，热闹是有的。',
    confidence: 0.9,
    lowConfidence: false,
    edited: false,
  },
]

export const DEMO_PARAGRAPHS: TranscriptParagraphDTO[] = [
  {
    id: 'PAR-001',
    speaker: '林水妹',
    startMs: 0,
    endMs: 46_200,
    segmentIds: ['SEG-001', 'SEG-002', 'SEG-003'],
    text:
      '我细汉就住伲塔巷，巷口头一间就是做脱胎漆器的铺。阮阿爸林依妹十七岁入漆器行做学徒。' +
      '塔巷这名字，听老人讲是闽王王审知时建过一座木塔，塔倒后巷名留存。',
    lowConfidenceCount: 1,
  },
  {
    id: 'PAR-002',
    speaker: '林水妹',
    startMs: 46_200,
    endMs: 118_900,
    segmentIds: ['SEG-004', 'SEG-005', 'SEG-006'],
    text:
      '脱胎的做法是先用泥土塑模，再一层麻布一层生漆贴上，阴干后把土胚敲出，只留一层壳。' +
      '一件像样的漆器要做四十多道工序，推光最费神。',
    lowConfidenceCount: 1,
  },
  {
    id: 'PAR-003',
    speaker: '林水妹',
    startMs: 118_900,
    endMs: 221_000,
    segmentIds: ['SEG-007', 'SEG-008', 'SEG-009', 'SEG-010'],
    text:
      '1958 年福州脱胎漆器厂办起来，阮阿爸转到厂里做技术师傅。南后街原先两边都是手工艺铺子。' +
      '家里每日晚上泡茉莉花茶，茶在仓山窨制，要窨七八次才有那个香气。',
    lowConfidenceCount: 1,
  },
]

/* ------------------------------------------------------------------ */
/* 实体抽取（流程 3）                                                   */
/* ------------------------------------------------------------------ */

export const DEMO_ENTITIES: ExtractedEntity[] = [
  {
    id: 'ENT-P-001',
    kind: 'place',
    name: '三坊七巷',
    normalizedName: '三坊七巷',
    aliases: ['三坊巷', '三坊七巷历史文化街区'],
    confidence: 0.96,
    confirmStatus: 'confirmed',
    evidence: [{ segmentId: 'SEG-001', charStart: 6, charEnd: 8, quote: '塔巷', startMs: 2_100 }],
    createdByHuman: false,
  },
  {
    id: 'ENT-P-002',
    kind: 'place',
    name: '塔巷',
    normalizedName: '塔巷',
    aliases: ['塔巷里'],
    confidence: 0.94,
    confirmStatus: 'confirmed',
    evidence: [
      { segmentId: 'SEG-001', charStart: 6, charEnd: 8, quote: '塔巷', startMs: 2_100 },
      { segmentId: 'SEG-003', charStart: 0, charEnd: 2, quote: '塔巷', startMs: 28_100 },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-P-003',
    kind: 'place',
    name: '南后街',
    normalizedName: '南后街',
    aliases: ['后街'],
    confidence: 0.92,
    confirmStatus: 'confirmed',
    evidence: [
      { segmentId: 'SEG-008', charStart: 0, charEnd: 3, quote: '南后街', startMs: 142_900 },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-P-004',
    kind: 'place',
    name: '水榭戏台',
    normalizedName: '水榭戏台',
    aliases: [],
    confidence: 0.9,
    confirmStatus: 'confirmed',
    evidence: [
      { segmentId: 'SEG-010', charStart: 0, charEnd: 4, quote: '水榭戏台', startMs: 198_600 },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-P-005',
    kind: 'place',
    name: '三坊巷',
    normalizedName: '三坊七巷',
    aliases: [],
    confidence: 0.55,
    confirmStatus: 'pending',
    uncertaintyNote: '转写出现「三坊巷」，疑为「三坊七巷」的旧称或漏字，需人工确认。',
    evidence: [
      { segmentId: 'SEG-003', charStart: 12, charEnd: 15, quote: '三坊巷', startMs: 31_400 },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-N-001',
    kind: 'person',
    name: '林水妹',
    normalizedName: '林水妹',
    aliases: [],
    confidence: 0.99,
    confirmStatus: 'confirmed',
    evidence: [{ segmentId: 'SEG-001', charStart: 0, charEnd: 3, quote: '林水妹', startMs: 0 }],
    createdByHuman: false,
  },
  {
    id: 'ENT-N-002',
    kind: 'person',
    name: '林依妹',
    normalizedName: '林依妹',
    aliases: ['阮依爹'],
    confidence: 0.68,
    confirmStatus: 'pending',
    uncertaintyNote: '「林依妹」为口述中的名字，福州话「依妹」亦常作昵称，需与族谱核对。',
    evidence: [
      { segmentId: 'SEG-002', charStart: 14, charEnd: 17, quote: '林依妹', startMs: 19_800 },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-N-003',
    kind: 'person',
    name: '王审知',
    normalizedName: '王审知',
    aliases: ['闽王'],
    confidence: 0.72,
    confirmStatus: 'pending',
    uncertaintyNote: '讲述人转述自「听老人讲」，属民间传说，需与地方志核证。',
    evidence: [
      { segmentId: 'SEG-003', charStart: 10, charEnd: 13, quote: '王审知', startMs: 30_200 },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-E-001',
    kind: 'event',
    name: '福州脱胎漆器厂成立',
    normalizedName: '福州脱胎漆器厂成立',
    aliases: ['漆器厂办起来'],
    confidence: 0.86,
    confirmStatus: 'confirmed',
    evidence: [
      {
        segmentId: 'SEG-007',
        charStart: 5,
        charEnd: 14,
        quote: '福州脱胎漆器厂办起来',
        startMs: 121_300,
      },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-A-001',
    kind: 'artifact',
    name: '脱胎漆器',
    normalizedName: '脱胎漆器',
    aliases: ['脱胎', '漆器'],
    confidence: 0.95,
    confirmStatus: 'confirmed',
    evidence: [{ segmentId: 'SEG-005', charStart: 3, charEnd: 7, quote: '脱胎', startMs: 69_100 }],
    createdByHuman: false,
  },
  {
    id: 'ENT-A-002',
    kind: 'artifact',
    name: '茉莉花茶',
    normalizedName: '茉莉花茶',
    aliases: ['花茶'],
    confidence: 0.93,
    confirmStatus: 'confirmed',
    evidence: [
      { segmentId: 'SEG-009', charStart: 8, charEnd: 12, quote: '茉莉花茶', startMs: 172_400 },
    ],
    createdByHuman: false,
  },
  {
    id: 'ENT-O-001',
    kind: 'organization',
    name: '闽剧院',
    normalizedName: '福州闽剧院',
    aliases: [],
    confidence: 0.64,
    confirmStatus: 'pending',
    uncertaintyNote: '口述中仅提到「闽剧」，机构名称为 AI 补全，需人工确认是否应保留。',
    evidence: [{ segmentId: 'SEG-010', charStart: 6, charEnd: 8, quote: '闽剧', startMs: 200_100 }],
    createdByHuman: false,
  },
  {
    id: 'ENT-P-006',
    kind: 'place',
    name: '仓山',
    normalizedName: '仓山区',
    aliases: ['仓前山'],
    confidence: 0.88,
    confirmStatus: 'confirmed',
    evidence: [
      { segmentId: 'SEG-009', charStart: 8, charEnd: 10, quote: '仓山', startMs: 174_900 },
    ],
    createdByHuman: false,
  },
]

/** 疑似同义项分组：演示「同义项合并」。 */
export const DEMO_DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    groupId: 'DUP-001',
    suggestedPrimaryId: 'ENT-P-001',
    memberIds: ['ENT-P-001', 'ENT-P-005'],
    reason:
      '「三坊巷」与「三坊七巷」字形高度相似，且均出现在同一位讲述人的同一话题中，疑为同一地名的异写。',
    similarity: 0.86,
  },
  {
    groupId: 'DUP-002',
    suggestedPrimaryId: 'ENT-P-006',
    memberIds: ['ENT-P-006'],
    reason: '「仓山」在口述中指向窨制茉莉花茶的产地，规范名建议为「仓山区」。',
    similarity: 0.72,
  },
]

/* ------------------------------------------------------------------ */
/* 地方资料（流程 4）                                                   */
/* ------------------------------------------------------------------ */

export const DEMO_SOURCES: SearchHit[] = [
  {
    sourceId: 'SRC-FZ-001',
    title: '福州市志·卷三十八·工艺美术',
    publisher: '福州市地方志编纂委员会',
    sourceType: 'gazetteer',
    credibility: 'high',
    credibilityScore: 0.95,
    publishedAt: '1999-12-01',
    excerpt:
      '福州脱胎漆器以泥土塑胎，外裱夏布，层层髹漆，阴干后去胎成器，故称「脱胎」。其工序繁复，推光、描金诸法尤见工力，清乾隆年间已列为贡品。',
    highlights: ['脱胎', '髹漆', '推光'],
    score: 0.93,
    locator: { page: 412, line: 8, callNumber: 'K295.71/F95' },
    relatedEntityIds: ['ENT-A-001'],
    relatedLeadIds: ['LEAD-001'],
    cited: true,
  },
  {
    sourceId: 'SRC-FZ-002',
    title: '三坊七巷志',
    publisher: '福建人民出版社',
    sourceType: 'gazetteer',
    credibility: 'high',
    credibilityScore: 0.92,
    publishedAt: '2008-06-01',
    excerpt:
      '塔巷，旧名修文巷，宋时称塔巷。相传闽王王审知建木塔于此，故名。巷长不足二百米，历代多居工匠与塾师。',
    highlights: ['塔巷', '王审知'],
    score: 0.9,
    locator: { page: 88, line: 3 },
    relatedEntityIds: ['ENT-P-002', 'ENT-N-003'],
    relatedLeadIds: ['LEAD-002'],
    cited: true,
  },
  {
    sourceId: 'SRC-FZ-003',
    title: '闽都别记',
    publisher: '福建人民出版社（清·里人何求撰，点校本）',
    sourceType: 'oral',
    credibility: 'low',
    credibilityScore: 0.4,
    publishedAt: '2000-03-01',
    excerpt:
      '里巷相传，闽王于城中建塔七座，以镇海气，塔巷其一也。此说多采民间传闻，与正史所载颇有出入。',
    highlights: ['闽王', '建塔七座', '民间传闻'],
    score: 0.78,
    locator: { page: 156, line: 12 },
    relatedEntityIds: ['ENT-P-002', 'ENT-N-003'],
    relatedLeadIds: ['LEAD-003'],
    cited: false,
  },
  {
    sourceId: 'SRC-FZ-004',
    title: '福州脱胎漆器髹饰技艺（国家级非物质文化遗产名录）',
    publisher: '文化和旅游部',
    sourceType: 'heritage_list',
    credibility: 'high',
    credibilityScore: 0.97,
    publishedAt: '2006-05-20',
    excerpt:
      '福州脱胎漆器髹饰技艺，2006 年列入第一批国家级非物质文化遗产名录，编号 Ⅷ-58，申报地区为福建省福州市。',
    highlights: ['脱胎漆器', '国家级非物质文化遗产'],
    score: 0.88,
    locator: { url: 'https://www.ihchina.cn/project_details/14485' },
    relatedEntityIds: ['ENT-A-001'],
    relatedLeadIds: ['LEAD-004'],
    cited: true,
  },
  {
    sourceId: 'SRC-FZ-005',
    title: '福州漆器生产合作社的成立与出口创汇（1956—1965）',
    publisher: '《福建党史月刊》2015 年第 4 期',
    sourceType: 'academic',
    credibility: 'high',
    credibilityScore: 0.89,
    publishedAt: '2015-04-15',
    excerpt:
      '1956 年福州漆器生产合作社成立，1958 年在此基础上组建福州脱胎漆器厂。该厂产品自 1960 年代起大量出口东欧与东南亚，为地方换取外汇。',
    highlights: ['1958 年', '福州脱胎漆器厂', '出口'],
    score: 0.91,
    locator: { page: 27, line: 5 },
    relatedEntityIds: ['ENT-E-001', 'ENT-A-001'],
    relatedLeadIds: ['LEAD-005'],
    cited: true,
  },
  {
    sourceId: 'SRC-FZ-006',
    title: '坊巷空间与福州城市记忆：以南后街为个案',
    publisher: '《建筑学报》2019 年第 6 期',
    sourceType: 'academic',
    credibility: 'high',
    credibilityScore: 0.87,
    publishedAt: '2019-06-20',
    excerpt:
      '南后街历史上为手工艺集中街区，油纸伞、牛角梳、裱褙、漆器诸业杂处，形成「前店后坊」的空间格局。',
    highlights: ['南后街', '油纸伞', '牛角梳', '前店后坊'],
    score: 0.85,
    locator: { page: 61, line: 14 },
    relatedEntityIds: ['ENT-P-003'],
    relatedLeadIds: ['LEAD-006'],
    cited: true,
  },
  {
    sourceId: 'SRC-FZ-007',
    title: '福州茉莉花茶窨制工艺',
    publisher: '福建省农业农村厅',
    sourceType: 'archive',
    credibility: 'medium',
    credibilityScore: 0.7,
    publishedAt: '2020-09-10',
    excerpt:
      '茉莉花茶窨制以绿茶为坯，鲜花吐香、茶坯吸香，一般经三至七窨。传统上以闽侯、长乐、仓山一带所产茉莉品质最佳。',
    highlights: ['茉莉花茶', '窨制', '仓山'],
    score: 0.8,
    locator: { url: 'https://nynct.fujian.gov.cn/xxgk/mhcc' },
    relatedEntityIds: ['ENT-A-002', 'ENT-P-006'],
    relatedLeadIds: ['LEAD-007'],
    cited: true,
  },
  {
    sourceId: 'SRC-FZ-008',
    title: '林氏宗谱（塔巷支）',
    publisher: '林氏族人自印',
    sourceType: 'genealogy',
    credibility: 'medium',
    credibilityScore: 0.62,
    publishedAt: '1936-01-01',
    excerpt:
      '十七世依妹，字清泉，光绪二十七年生，少习漆工于南后街，民国间自设铺号「聚漆斋」于塔巷口。',
    highlights: ['依妹', '漆工', '南后街', '聚漆斋'],
    score: 0.76,
    locator: { page: 34, line: 2 },
    relatedEntityIds: ['ENT-N-002', 'ENT-P-003'],
    relatedLeadIds: ['LEAD-008'],
    cited: true,
  },
  {
    sourceId: 'SRC-FZ-009',
    title: '水榭戏台修缮工程报告',
    publisher: '福州市文物局',
    sourceType: 'archive',
    credibility: 'high',
    credibilityScore: 0.9,
    publishedAt: '2011-11-30',
    excerpt:
      '水榭戏台位于三坊七巷衣锦坊内，始建于明万历年间，清道光年间重修，为福州现存少数水上戏台之一，历来为闽剧演出场所。',
    highlights: ['水榭戏台', '闽剧'],
    score: 0.83,
    locator: { page: 5, line: 1 },
    relatedEntityIds: ['ENT-P-004'],
    relatedLeadIds: ['LEAD-009'],
    cited: false,
  },
  {
    sourceId: 'SRC-FZ-010',
    title: '福建日报：福州漆器远销海外',
    publisher: '《福建日报》1959 年 8 月 14 日 第 2 版',
    sourceType: 'newspaper',
    credibility: 'medium',
    credibilityScore: 0.68,
    publishedAt: '1959-08-14',
    excerpt:
      '本报讯 福州脱胎漆器厂今年以来完成出口任务，产品销往苏联、捷克斯洛伐克及东南亚各国，深受欢迎。',
    highlights: ['脱胎漆器厂', '出口'],
    score: 0.74,
    locator: { page: 2, line: 6 },
    relatedEntityIds: ['ENT-E-001', 'ENT-A-001'],
    relatedLeadIds: ['LEAD-005'],
    cited: false,
  },
]

/* ------------------------------------------------------------------ */
/* AI 创作草稿（流程 6 产出，供流程 5 比对、流程 7 审核使用）            */
/* ------------------------------------------------------------------ */

export const DEMO_CLAIM_TEXTS: Record<string, string> = {
  'CLM-01': '三坊七巷始建于唐末，至明清两代达到鼎盛，是福州现存规模最大的历史文化街区。',
  'CLM-02':
    '脱胎漆器以泥土塑胎、夏布裱骨，髹漆数十道后去胎成器，工序多达四十余道，其中推光最为费工。',
  'CLM-03': '塔巷之名源于闽王王审知在此建造的一座木塔，塔毁之后巷名沿用至今。',
  'CLM-04': '讲述人林水妹的父亲林依妹，十七岁入漆器行当学徒，后在南后街开设漆器铺「聚漆斋」。',
  'CLM-05': '1958 年福州脱胎漆器厂成立，其产品大量出口，成为当时地方出口创汇的重要来源。',
  'CLM-06': '福州茉莉花茶窨制需经八至十次窨花，方得浓郁香气。',
}

export const DEMO_COMPARISON_ITEMS: ComparisonItem[] = [
  {
    itemId: 'CMP-001',
    claimText: DEMO_CLAIM_TEXTS['CLM-01'],
    claimBlockId: 'BLK-001',
    claimSegmentId: 'SEG-001',
    source: {
      sourceId: 'SRC-FZ-002',
      title: '三坊七巷志',
      publisher: '福建人民出版社',
      credibility: 'high',
      publishedAt: '2008-06-01',
      excerpt: '三坊七巷之格局奠定于唐末罗城，至明清而臻于极盛，今存坊巷十，巷七，故名。',
      locator: { page: 3, line: 1 },
    },
    aiVerdict: 'consistent',
    aiConfidence: 0.91,
    aiReason:
      '草稿表述与《三坊七巷志》总述部分一致：格局奠定于唐末，明清极盛，且「三坊七巷」得名与坊巷数量吻合。',
    aiReasonTags: [],
    humanVerdict: null,
    humanReason: null,
    humanReasonTags: [],
    annotator: null,
    annotatedAt: null,
    annotationState: 'unannotated',
  },
  {
    itemId: 'CMP-002',
    claimText: DEMO_CLAIM_TEXTS['CLM-02'],
    claimBlockId: 'BLK-002',
    claimSegmentId: 'SEG-005',
    source: {
      sourceId: 'SRC-FZ-001',
      title: '福州市志·卷三十八·工艺美术',
      publisher: '福州市地方志编纂委员会',
      credibility: 'high',
      publishedAt: '1999-12-01',
      excerpt: '福州脱胎漆器以泥土塑胎，外裱夏布，层层髹漆，阴干后去胎成器，故称「脱胎」。',
      locator: { page: 412, line: 8 },
    },
    aiVerdict: 'consistent',
    aiConfidence: 0.88,
    aiReason:
      '工艺步骤与方志记载吻合；「四十余道工序」一说来自讲述人口述，方志未列具体数字，但未与之冲突。',
    aiReasonTags: [],
    humanVerdict: null,
    humanReason: null,
    humanReasonTags: [],
    annotator: null,
    annotatedAt: null,
    annotationState: 'unannotated',
  },
  {
    itemId: 'CMP-003',
    claimText: DEMO_CLAIM_TEXTS['CLM-03'],
    claimBlockId: 'BLK-003',
    claimSegmentId: 'SEG-003',
    source: {
      sourceId: 'SRC-FZ-003',
      title: '闽都别记',
      publisher: '福建人民出版社（点校本）',
      credibility: 'low',
      publishedAt: '2000-03-01',
      excerpt:
        '里巷相传，闽王于城中建塔七座，以镇海气，塔巷其一也。此说多采民间传闻，与正史所载颇有出入。',
      locator: { page: 156, line: 12 },
    },
    aiVerdict: 'needs_verification',
    aiConfidence: 0.62,
    aiReason:
      '草稿把「塔巷得名于闽王建塔」写成结论，但该说法目前只见于《闽都别记》这类民间传闻辑录，原书自身即注明「与正史所载颇有出入」；《三坊七巷志》则记为「相传」，同样未作确证。建议改为转述语气并补注来源。',
    aiReasonTags: ['legend_as_fact', 'source_low_credibility'],
    humanVerdict: null,
    humanReason: null,
    humanReasonTags: [],
    annotator: null,
    annotatedAt: null,
    annotationState: 'unannotated',
  },
  {
    itemId: 'CMP-004',
    claimText: DEMO_CLAIM_TEXTS['CLM-04'],
    claimBlockId: 'BLK-004',
    claimSegmentId: 'SEG-002',
    source: {
      sourceId: 'SRC-FZ-008',
      title: '林氏宗谱（塔巷支）',
      publisher: '林氏族人自印',
      credibility: 'medium',
      publishedAt: '1936-01-01',
      excerpt:
        '十七世依妹，字清泉，光绪二十七年生，少习漆工于南后街，民国间自设铺号「聚漆斋」于塔巷口。',
      locator: { page: 34, line: 2 },
    },
    aiVerdict: 'conflict',
    aiConfidence: 0.79,
    aiReason:
      '宗谱载林依妹生于光绪二十七年（1901 年），十七岁入行当在 1918 年前后，与草稿「十七岁入漆器行」一致；但「聚漆斋」为民国间自设，草稿未提年份，「南后街」与宗谱「塔巷口」的地点表述亦略有出入。此外讲述人称「林依妹」，宗谱作「依妹」，字清泉，需确认是否同一人。',
    aiReasonTags: ['person_mixup', 'place_error', 'source_low_credibility'],
    humanVerdict: null,
    humanReason: null,
    humanReasonTags: [],
    annotator: null,
    annotatedAt: null,
    annotationState: 'unannotated',
  },
  {
    itemId: 'CMP-005',
    claimText: DEMO_CLAIM_TEXTS['CLM-05'],
    claimBlockId: 'BLK-005',
    claimSegmentId: 'SEG-007',
    source: {
      sourceId: 'SRC-FZ-005',
      title: '福州漆器生产合作社的成立与出口创汇（1956—1965）',
      publisher: '《福建党史月刊》',
      credibility: 'high',
      publishedAt: '2015-04-15',
      excerpt: '1956 年福州漆器生产合作社成立，1958 年在此基础上组建福州脱胎漆器厂。',
      locator: { page: 27, line: 5 },
    },
    aiVerdict: 'consistent',
    aiConfidence: 0.93,
    aiReason: '建厂年份 1958 年与学术论文一致；出口创汇的表述亦有《福建日报》1959 年报道佐证。',
    aiReasonTags: [],
    humanVerdict: null,
    humanReason: null,
    humanReasonTags: [],
    annotator: null,
    annotatedAt: null,
    annotationState: 'unannotated',
  },
  {
    itemId: 'CMP-006',
    claimText: DEMO_CLAIM_TEXTS['CLM-06'],
    claimBlockId: 'BLK-006',
    claimSegmentId: 'SEG-009',
    source: {
      sourceId: 'SRC-FZ-007',
      title: '福州茉莉花茶窨制工艺',
      publisher: '福建省农业农村厅',
      credibility: 'medium',
      publishedAt: '2020-09-10',
      excerpt: '茉莉花茶窨制以绿茶为坯，鲜花吐香、茶坯吸香，一般经三至七窨。',
      locator: { url: 'https://nynct.fujian.gov.cn/xxgk/mhcc' },
    },
    aiVerdict: 'conflict',
    aiConfidence: 0.84,
    aiReason:
      '官方资料记为「一般经三至七窨」，而草稿写「八至十次」。讲述人口述为「要窨七八次」，草稿在改写时把上限抬高了，属于典型的记忆被放大后写入结论的情形。',
    aiReasonTags: ['memory_bias', 'other'],
    humanVerdict: null,
    humanReason: null,
    humanReasonTags: [],
    annotator: null,
    annotatedAt: null,
    annotationState: 'unannotated',
  },
]

/* ------------------------------------------------------------------ */
/* 生成结果（流程 6）                                                   */
/* ------------------------------------------------------------------ */

export const DEMO_GENERATION: CreateGenerationResponse = {
  draftId: 'DRAFT-2024-0007',
  outputType: 'story_card',
  title: '一双手推亮的漆器：塔巷里的脱胎往事',
  blocks: [
    {
      id: 'BLK-001',
      heading: '坊巷格局',
      body: '三坊七巷始建于唐末，至明清两代达到鼎盛，是福州现存规模最大的历史文化街区。[1]',
      citationIndexes: [1],
      edited: false,
    },
    {
      id: 'BLK-002',
      heading: '脱胎的工序',
      body: '脱胎漆器以泥土塑胎、夏布裱骨，髹漆数十道后去胎成器，工序多达四十余道，其中推光最为费工。[2]',
      citationIndexes: [2],
      edited: false,
    },
    {
      id: 'BLK-003',
      heading: '塔巷得名',
      body: '相传塔巷之名源于闽王王审知在此建造的一座木塔，塔毁之后巷名沿用至今。[3]',
      citationIndexes: [3],
      edited: false,
    },
    {
      id: 'BLK-004',
      heading: '林家的漆器铺',
      body: '讲述人林水妹的父亲林依妹，十七岁入漆器行当学徒，后在南后街开设漆器铺「聚漆斋」。[4]',
      citationIndexes: [4],
      edited: false,
    },
    {
      id: 'BLK-005',
      heading: '走向出口的漆器',
      body: '1958 年福州脱胎漆器厂成立，其产品大量出口，成为当时地方出口创汇的重要来源。[5]',
      citationIndexes: [5],
      edited: false,
    },
    {
      id: 'BLK-006',
      heading: '茶香里的日常',
      body: '福州茉莉花茶窨制需经八至十次窨花，方得浓郁香气。[6]',
      citationIndexes: [6],
      edited: false,
    },
  ],
  citations: [
    {
      index: 1,
      sourceId: 'SRC-FZ-002',
      sourceTitle: '三坊七巷志',
      publisher: '福建人民出版社',
      locatorText: '第 3 页第 1 行',
      quote: '三坊七巷之格局奠定于唐末罗城，至明清而臻于极盛。',
      credibility: 'high',
    },
    {
      index: 2,
      sourceId: 'SRC-FZ-001',
      sourceTitle: '福州市志·卷三十八·工艺美术',
      publisher: '福州市地方志编纂委员会',
      locatorText: '第 412 页第 8 行',
      quote: '福州脱胎漆器以泥土塑胎，外裱夏布，层层髹漆，阴干后去胎成器。',
      credibility: 'high',
    },
    {
      index: 3,
      sourceId: 'SRC-FZ-003',
      sourceTitle: '闽都别记',
      publisher: '福建人民出版社（点校本）',
      locatorText: '第 156 页第 12 行',
      quote: '此说多采民间传闻，与正史所载颇有出入。',
      credibility: 'low',
    },
    {
      index: 4,
      sourceId: 'SRC-FZ-008',
      sourceTitle: '林氏宗谱（塔巷支）',
      publisher: '林氏族人自印',
      locatorText: '第 34 页第 2 行',
      quote: '十七世依妹，字清泉，光绪二十七年生，少习漆工于南后街。',
      credibility: 'medium',
    },
    {
      index: 5,
      sourceId: 'SRC-FZ-005',
      sourceTitle: '福州漆器生产合作社的成立与出口创汇（1956—1965）',
      publisher: '《福建党史月刊》',
      locatorText: '第 27 页第 5 行',
      quote: '1956 年福州漆器生产合作社成立，1958 年在此基础上组建福州脱胎漆器厂。',
      credibility: 'high',
    },
    {
      index: 6,
      sourceId: 'SRC-FZ-007',
      sourceTitle: '福州茉莉花茶窨制工艺',
      publisher: '福建省农业农村厅',
      locatorText: '在线文档',
      quote: '茉莉花茶窨制以绿茶为坯，鲜花吐香、茶坯吸香，一般经三至七窨。',
      credibility: 'medium',
    },
  ],
  usedSourceIds: [
    'SRC-FZ-001',
    'SRC-FZ-002',
    'SRC-FZ-003',
    'SRC-FZ-005',
    'SRC-FZ-007',
    'SRC-FZ-008',
  ],
  omittedSourceIds: ['SRC-FZ-004', 'SRC-FZ-006', 'SRC-FZ-009', 'SRC-FZ-010'],
  riskNotes: [
    {
      level: 'critical',
      category: 'legend_as_fact',
      message: '第 3 段把民间传说「闽王建塔得名」作为事实陈述。',
      suggestion: '改为转述语气（如「相传」），并在引用中标注《闽都别记》为传闻辑录。',
      relatedBlockId: 'BLK-003',
    },
    {
      level: 'warning',
      category: 'low_credibility',
      message: '第 6 段的窨制次数与官方资料不一致（草稿 8—10 次，资料为 3—7 次）。',
      suggestion: '按官方资料订正为「三至七窨」，并在正文中说明讲述人的口述版本。',
      relatedBlockId: 'BLK-006',
    },
    {
      level: 'info',
      category: 'unsourced',
      message: '第 2 段「四十余道工序」仅见于口述，未在方志中找到对应记载。',
      suggestion: '补充口述来源标注，或删去具体数字。',
      relatedBlockId: 'BLK-002',
    },
  ],
  version: {
    versionId: 'VER-DRAFT-0007-1',
    versionNo: 1,
    createdBy: CURRENT_OPERATOR,
    createdAt: '2024-05-08T15:40:00+08:00',
    note: 'AI 初稿',
  },
  aiMeta: {
    model: 'fuzhou-story-writer',
    modelVersion: '2.3.1',
    confidence: 0.82,
    needsHumanConfirm: true,
    promptVersion: 'p-2024-05-a',
    generatedAt: '2024-05-08T15:40:00+08:00',
    tookMs: 4_820,
  },
}

/* ------------------------------------------------------------------ */
/* 版本记录（流程 7）                                                   */
/* ------------------------------------------------------------------ */

export const DEMO_CONTENT_VERSIONS: ContentVersionRecord[] = [
  {
    versionId: 'VER-DRAFT-0007-1',
    versionNo: 1,
    createdBy: CURRENT_OPERATOR,
    createdAt: '2024-05-08T15:40:00+08:00',
    note: 'AI 初稿生成',
    status: 'draft',
    riskLevel: 'high',
  },
  {
    versionId: 'VER-DRAFT-0007-2',
    versionNo: 2,
    createdBy: CURRENT_OPERATOR,
    createdAt: '2024-05-09T09:12:00+08:00',
    note: '订正窨制次数，补充口述来源标注',
    status: 'draft',
    riskLevel: 'medium',
  },
  {
    versionId: 'VER-DRAFT-0007-3',
    versionNo: 3,
    createdBy: REVIEWER_OPERATOR,
    createdAt: '2024-05-09T14:30:00+08:00',
    note: '审核通过，允许发布',
    status: 'approved',
    riskLevel: 'low',
  },
]

export const DEMO_CURRENT_CONTENT_VERSION = 'VER-DRAFT-0007-3'
