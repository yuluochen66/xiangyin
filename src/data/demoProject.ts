/**
 * 复用组件库的演示数据集（三栏审校工作台示例）。
 *
 * ⚠️ 重要说明：本文件服务于 src/components/{audio,sources,review,tools} 下那套
 * 「三栏审校工作台」组件，以及四工具契约层（src/services/toolClient.ts）。
 * 该三栏工作台**当前没有被任何路由挂载**——7 道流程页使用 src/mock/dataset.ts。
 * 保留本文件是为了不丢失四工具链路的演示数据；组件归属详见 src/components/README.md。
 *
 * 场景：三坊七巷老住户林水妹的口述采访，正处于「音频 ↔ 文本 ↔ 来源」联动审校阶段。
 * 本文件是 mock transport（`src/services/mock/mockTransport.ts`）的数据源，
 * 供 `components/audio | sources | review | tools` 这套复用组件使用。
 *
 * 注意：7 个流程页使用的是 `src/mock/dataset.ts`（字段更贴近真实接口）。
 * 两者的区别：本文件服务于「四工具契约层」的演示，dataset.ts 服务于 REST 接口层。
 *
 * 音频：`public/demo/audio-demo.wav`（36 秒占位音源），
 * 用于直观验证「音频进度 ↔ 文本高亮」的联动是否准确。
 */
import type { Annotation, Claim, ReviewUnit, SourceTag, Transcript } from '@/types'

/* ------------------------------------------------------------------ */
/* 来源                                                                */
/* ------------------------------------------------------------------ */

export const DEMO_SOURCES: SourceTag[] = [
  {
    id: 'SRC-01',
    label: '林水妹口述录音',
    kind: 'interview',
    publisher: '本项目采访组',
    publishedAt: '2024-03-12T09:20:00+08:00',
    confidence: 0.74,
    verified: true,
    excerpt: '讲述人回忆父亲在漆器行做学徒、以及脱胎漆器的髹漆与推光工序。',
    locator: { timecodeMs: 2600 },
  },
  {
    id: 'SRC-02',
    label: '福州漆器生产合作社档案',
    kind: 'official',
    publisher: '福州市档案馆',
    publishedAt: '1958-06-01T00:00:00+08:00',
    confidence: 0.94,
    verified: true,
    excerpt: '1956 年成立漆器生产合作社，1958 年在此基础上组建福州脱胎漆器厂。',
    locator: { page: 3, line: 12 },
  },
  {
    id: 'SRC-03',
    label: '国家级非遗名录·脱胎漆器髹饰技艺',
    kind: 'dataset',
    publisher: '文化和旅游部',
    publishedAt: '2006-05-20T00:00:00+08:00',
    confidence: 0.97,
    verified: true,
    excerpt: '福州脱胎漆器髹饰技艺（编号 Ⅷ-58）2006 年列入第一批国家级非物质文化遗产名录。',
    locator: { url: 'https://www.ihchina.cn/project_details/14485' },
  },
  {
    id: 'SRC-04',
    label: '林氏宗谱（塔巷支）',
    kind: 'document',
    publisher: '林氏族人自印',
    publishedAt: '1936-01-01T00:00:00+08:00',
    confidence: 0.62,
    verified: false,
    excerpt: '十七世依妹，字清泉，少习漆工于南后街，民国间自设铺号「聚漆斋」于塔巷口。',
    locator: { page: 34, line: 2 },
  },
  {
    id: 'SRC-05',
    label: '福州方言字音调查数据',
    kind: 'dataset',
    publisher: '本项目语料组',
    publishedAt: '2024-04-02T00:00:00+08:00',
    confidence: 0.88,
    verified: true,
    excerpt: '「推光」「脱胎」「髹漆」在福州漆器行业语中均有固定读音与用法。',
    locator: { url: 'https://example.org/fz-dialect/glossary' },
  },
  {
    id: 'SRC-06',
    label: '三坊七巷手工业普查',
    kind: 'official',
    publisher: '福州市文化和旅游局',
    publishedAt: '2021-09-15T00:00:00+08:00',
    confidence: 0.9,
    verified: true,
    excerpt:
      '南后街历史上两侧多手工艺铺，形成「前店后坊」格局；普查未采信「塔巷因闽王建塔得名」之说。',
    locator: { page: 21, line: 6 },
  },
  {
    id: 'SRC-07',
    label: '闽都别记（点校本）',
    kind: 'document',
    publisher: '福建人民出版社',
    publishedAt: '2000-03-01T00:00:00+08:00',
    confidence: 0.4,
    verified: false,
    excerpt:
      '里巷相传，闽王于城中建塔七座以镇海气，塔巷其一也。此说多采民间传闻，与正史所载颇有出入。',
    locator: { page: 156, line: 12 },
  },
  {
    id: 'SRC-08',
    label: '《福建日报》1959 年报道',
    kind: 'media',
    publisher: '福建日报社',
    publishedAt: '1959-08-14T00:00:00+08:00',
    confidence: 0.68,
    verified: false,
    excerpt: '福州脱胎漆器厂今年以来完成出口任务，产品销往苏联、捷克斯洛伐克及东南亚各国。',
    locator: { page: 2, line: 6 },
  },
]

/* ------------------------------------------------------------------ */
/* 论断                                                                */
/* ------------------------------------------------------------------ */

export const DEMO_CLAIMS: Claim[] = [
  {
    id: 'C-01',
    text: '脱胎漆器以泥土塑胎、夏布裱骨，髹漆数十道后去胎成器，其中推光最为费工。',
    speaker: '林水妹',
    sourceIds: ['SRC-01', 'SRC-03', 'SRC-05'],
  },
  {
    id: 'C-02',
    text: '塔巷之名源于闽王王审知在此建造的一座木塔。',
    speaker: '林水妹',
    sourceIds: ['SRC-07'],
  },
  {
    id: 'C-03',
    text: '福州茉莉花茶窨制需经八至十次窨花，方得浓郁香气。',
    speaker: '林水妹',
    sourceIds: ['SRC-01', 'SRC-06'],
  },
  {
    id: 'C-04',
    text: '南后街历史上两侧皆为手工艺铺，形成「前店后坊」的空间格局。',
    sourceIds: ['SRC-06'],
  },
  {
    id: 'C-05',
    text: '林依妹十七岁入漆器行做学徒，后在南后街开设漆器铺「聚漆斋」。',
    sourceIds: ['SRC-04', 'SRC-01'],
  },
]

/* ------------------------------------------------------------------ */
/* 转写稿                                                              */
/* ------------------------------------------------------------------ */

export const DEMO_TRANSCRIPT: Transcript = {
  id: 'T-2024-0312',
  title: '林水妹：塔巷里的漆器铺与坊巷生活',
  audioUrl: '/demo/audio-demo.wav',
  language: 'zh-CN',
  segments: [
    {
      id: 'SEG-01',
      startMs: 0,
      endMs: 4_600,
      speaker: '林水妹',
      text: '我细汉就住伲塔巷，巷口头一间就是做脱胎漆器的铺。',
      claimIds: ['C-01'],
      sourceIds: ['SRC-01'],
    },
    {
      id: 'SEG-02',
      startMs: 4_600,
      endMs: 9_200,
      speaker: '林水妹',
      text: '阮依爹十七岁就入漆器行做学徒，后来在南后街开过一间铺。',
      claimIds: ['C-05'],
      sourceIds: ['SRC-01', 'SRC-04'],
    },
    {
      id: 'SEG-03',
      startMs: 9_200,
      endMs: 14_000,
      speaker: '陈明',
      text: '那脱胎是怎么做出来的？',
      claimIds: [],
      sourceIds: [],
    },
    {
      id: 'SEG-04',
      startMs: 14_000,
      endMs: 19_800,
      speaker: '林水妹',
      text: '先用泥土塑一个模，一层麻布一层生漆贴上去，阴干后把土胚敲出来，剩一层壳，叫作脱胎。',
      claimIds: ['C-01'],
      sourceIds: ['SRC-01', 'SRC-03'],
    },
    {
      id: 'SEG-05',
      startMs: 19_800,
      endMs: 24_400,
      speaker: '林水妹',
      text: '推光那道最费神，用手掌蘸着细灰一直推，推到会照人影。',
      claimIds: ['C-01'],
      sourceIds: ['SRC-01', 'SRC-05'],
    },
    {
      id: 'SEG-06',
      startMs: 24_400,
      endMs: 28_600,
      speaker: '林水妹',
      text: '塔巷这名字啊，听老人讲是闽王辰候在这建过一座木塔。',
      claimIds: ['C-02'],
      sourceIds: ['SRC-07'],
    },
    {
      id: 'SEG-07',
      startMs: 28_600,
      endMs: 32_000,
      speaker: '林水妹',
      text: '南后街原先两边全是手工艺铺，一条街会行半日。',
      claimIds: ['C-04'],
      sourceIds: ['SRC-06'],
    },
    {
      id: 'SEG-08',
      startMs: 32_000,
      endMs: 36_000,
      speaker: '林水妹',
      text: '厝里泡的茉莉花茶，窨一次换一批花，要窨七八次才有那个香。',
      claimIds: ['C-03'],
      sourceIds: ['SRC-01'],
    },
  ],
}

/* ------------------------------------------------------------------ */
/* 审校单元                                                            */
/* ------------------------------------------------------------------ */

/** 各审校单元的批注。 */
const DEMO_ANNOTATIONS: Record<string, Annotation[]> = {
  'RU-01': [
    {
      id: 'AN-01',
      author: '审校 赵岚',
      createdAt: '2024-03-14T09:12:00+08:00',
      severity: 'info',
      body: '「脱胎」工序与非遗名录一致，可保留。建议补一句推光的耗时，增强读者体感。',
      status: 'accepted',
    },
  ],
  'RU-02': [
    {
      id: 'AN-02',
      author: '审校 赵岚',
      createdAt: '2024-03-14T09:20:00+08:00',
      severity: 'critical',
      body: '宗谱记铺号设于「塔巷口」，草稿写成「南后街」，两者需人工核对后再定稿。',
      status: 'flagged',
    },
  ],
  'RU-03': [
    {
      id: 'AN-03',
      author: '审校 赵岚',
      createdAt: '2024-03-14T09:26:00+08:00',
      severity: 'warning',
      body: '「寺」应为「祠」。塔巷内为王氏宗祠，非寺院。',
      status: 'accepted',
    },
  ],
}

export const DEMO_REVIEW_UNITS: ReviewUnit[] = [
  {
    id: 'RU-01',
    segmentId: 'SEG-04',
    original: '先用泥土塑一个模，一层麻布一层生漆贴上去，阴干后把土胚敲出来，剩一层壳。',
    revised:
      '工序从塑胎开始：先用泥土塑出器形，再一层夏布、一层生漆交替裱糊，阴干后敲去土胎，只留一层漆壳，故称「脱胎」。',
    status: 'accepted',
    annotations: DEMO_ANNOTATIONS['RU-01'] ?? [],
    claimIds: ['C-01'],
  },
  {
    id: 'RU-02',
    segmentId: 'SEG-02',
    original: '阮依爹十七岁就入漆器行做学徒，后来在南后街开过一间铺。',
    revised: '父亲林依妹十七岁入漆器行做学徒，后于塔巷口自设铺号「聚漆斋」。',
    status: 'flagged',
    annotations: DEMO_ANNOTATIONS['RU-02'] ?? [],
    claimIds: ['C-05'],
  },
  {
    id: 'RU-03',
    segmentId: 'SEG-06',
    original: '塔巷这名字啊，听老人讲是闽王辰候在这建过一座木塔。',
    revised:
      '塔巷得名一说，相传与闽王王审知在此建木塔有关，此说见于民间传闻辑录，尚未得到方志确证。',
    status: 'accepted',
    annotations: DEMO_ANNOTATIONS['RU-03'] ?? [],
    claimIds: ['C-02'],
  },
  {
    id: 'RU-04',
    segmentId: 'SEG-07',
    original: '南后街原先两边全是手工艺铺，一条街会行半日。',
    revised:
      '南后街旧时两侧多为手工艺铺，油纸伞、牛角梳、裱褙、漆器诸业杂处，形成「前店后坊」格局。',
    status: 'pending',
    annotations: [],
    claimIds: ['C-04'],
  },
  {
    id: 'RU-05',
    segmentId: 'SEG-08',
    original: '厝里泡的茉莉花茶，窨一次换一批花，要窨七八次才有那个香。',
    revised: '福州茉莉花茶以绿茶为坯，鲜花吐香、茶坯吸香，传统上需经三至七窨方得浓郁香气。',
    status: 'accepted',
    annotations: [],
    claimIds: ['C-03'],
  },
]

/** 演示项目元信息（供上述未挂载的三栏组件使用）。 */
export const DEMO_PROJECT = {
  reviewId: 'REVIEW-2024-0312-07',
  title: '林水妹：塔巷里的漆器铺与坊巷生活',
  defaultReviewer: '审校 赵岚',
} as const
