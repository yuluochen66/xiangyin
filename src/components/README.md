# 组件目录说明

本目录**全部组件都处于已挂载状态**：从入口 `src/main.ts` 出发都能到达（跟随静态与动态 `import`）。
下表的「被谁引用」由实际 import 关系统计得出，不是人工维护，因此不会与代码脱节。

当前：`src/` 下 **178 个源文件全部可达，零死代码**。唯一例外是 `src/vite-env.d.ts`
（环境类型声明，本就不该被 import）。

目录分为两类，边界不要混：

- **跨流程件**：`common/`（与业务无关）、`review/`、`tools/`——多个视图共用，改动要评估影响面；
- **流程私有件**：`flow2/`~`flow7/`——只被对应那一个视图引用，可自由改。

## 一、目录职责与挂载点

### `common/` —— 通用组件（跨流程复用）（14 个）

| 组件 | 被谁引用 |
| --- | --- |
| `ApiContractPanel.vue` | `App.vue` |
| `AppIcon.vue` | `App.vue`、`components/common/ApiContractPanel.vue`、`components/common/AppToasts.vue`、`components/common/AsyncStateBoundary.vue`、`components/common/EmptyState.vue`、`components/common/ModalDialog.vue`、`components/flow2/CorrectionOverviewPanel.vue`、`components/flow2/SegmentCard.vue`、`components/flow2/TranscriptConfirmPrompt.vue`、`components/flow2/TranscriptIdlePanel.vue`、`components/flow2/TranscriptUnavailablePanel.vue`、`components/flow3/EntityCard.vue`、`components/flow3/EntityFilterPanel.vue`、`components/flow3/ExtractionConfirmPanel.vue`、`components/flow3/ExtractionIdlePanel.vue`、`components/flow3/ExtractionUnavailablePanel.vue`、`components/flow4/RiskConfirmNotice.vue`、`components/flow4/SearchConditionPanel.vue`、`components/flow4/SearchIdlePanel.vue`、`components/flow5/ComparisonConfirmBanner.vue`、`components/flow5/ComparisonTaskEntry.vue`、`components/flow5/HumanVerdictPanel.vue`、`components/flow6/GenerationResultArea.vue`、`components/flow7/RiskCheckPanel.vue`、`composables/useComparisonMeta.ts`、`composables/useEntityFilters.ts`、`views/Flow1UploadView.vue`、`views/Flow5CompareView.vue` |
| `AppToasts.vue` | `App.vue` |
| `AsyncStateBoundary.vue` | `components/flow2/SuggestionPanel.vue`、`components/flow2/VersionHistoryDialog.vue`、`components/flow4/SourceDetailDrawer.vue`、`components/flow6/GenerationResultArea.vue`、`components/flow7/RiskCheckPanel.vue`、`components/flow7/VersionHistoryPanel.vue`、`components/tools/ToolInvokePanel.vue`、`views/Flow1UploadView.vue`、`views/Flow2TranscribeView.vue`、`views/Flow3ExtractView.vue`、`views/Flow4SearchView.vue`、`views/Flow5CompareView.vue` |
| `BaseButton.vue` | `App.vue`、`components/common/ApiContractPanel.vue`、`components/common/AsyncStateBoundary.vue`、`components/common/JsonPreview.vue`、`components/common/ModalDialog.vue`、`components/flow2/AudioPlayerPanel.vue`、`components/flow2/CorrectionOverviewPanel.vue`、`components/flow2/ParagraphList.vue`、`components/flow2/SegmentCard.vue`、`components/flow2/SuggestionCard.vue`、`components/flow2/SuggestionPanel.vue`、`components/flow2/TranscribeHeaderActions.vue`、`components/flow2/TranscriptConfirmPrompt.vue`、`components/flow2/TranscriptContentPanel.vue`、`components/flow2/TranscriptIdlePanel.vue`、`components/flow2/TranscriptUnavailablePanel.vue`、`components/flow2/VersionHistoryDialog.vue`、`components/flow3/AiOverviewPanel.vue`、`components/flow3/DuplicateMergePanel.vue`、`components/flow3/EntityCard.vue`、`components/flow3/EvidencePanel.vue`、`components/flow3/ExtractionConfirmPanel.vue`、`components/flow3/ExtractionIdlePanel.vue`、`components/flow3/ExtractionResultPanel.vue`、`components/flow3/ExtractionUnavailablePanel.vue`、`components/flow3/WriteErrorBanner.vue`、`components/flow4/EntityFilterPanel.vue`、`components/flow4/ExpandedKeywordsPanel.vue`、`components/flow4/RiskConfirmNotice.vue`、`components/flow4/SearchConditionPanel.vue`、`components/flow4/SearchFacetPanel.vue`、`components/flow4/SearchFallbackActions.vue`、`components/flow4/SearchIdlePanel.vue`、`components/flow4/SearchResultList.vue`、`components/flow4/SourceDetailDrawer.vue`、`components/flow5/AiVerdictPanel.vue`、`components/flow5/AnnotationSubmitBar.vue`、`components/flow5/ComparisonConfirmBanner.vue`、`components/flow5/ComparisonItemCard.vue`、`components/flow5/ComparisonTaskEntry.vue`、`components/flow5/HumanVerdictPanel.vue`、`components/flow6/DraftBlockList.vue`、`components/flow6/GenerationParamPanel.vue`、`components/flow6/GenerationResultArea.vue`、`components/flow6/GenerationResultPanel.vue`、`components/flow6/IncludeScopeSelector.vue`、`components/flow6/RiskPanel.vue`、`components/flow7/PublishConfirmPanel.vue`、`components/flow7/ReviewCommentPanel.vue`、`components/flow7/RiskCheckPanel.vue`、`components/flow7/RiskItemCard.vue`、`components/flow7/TransitionPanel.vue`、`components/flow7/VersionHistoryPanel.vue`、`components/tools/ToolInvokePanel.vue`、`views/Flow1UploadView.vue`、`views/Flow2TranscribeView.vue`、`views/Flow3ExtractView.vue`、`views/Flow4SearchView.vue`、`views/Flow5CompareView.vue`、`views/Flow6GenerateView.vue`、`views/Flow7PublishView.vue`、`views/OverviewView.vue` |
| `EmptyState.vue` | `components/flow6/CitationPanel.vue`、`components/flow6/RiskPanel.vue`、`views/Flow5CompareView.vue` |
| `FieldTable.vue` | `components/common/ApiContractPanel.vue` |
| `FlowHeader.vue` | `views/Flow1UploadView.vue`、`views/Flow2TranscribeView.vue`、`views/Flow3ExtractView.vue`、`views/Flow4SearchView.vue`、`views/Flow5CompareView.vue`、`views/Flow6GenerateView.vue`、`views/Flow7PublishView.vue` |
| `JsonPreview.vue` | `components/flow6/GenerationParamPanel.vue`、`components/flow7/TransitionPanel.vue`、`components/tools/ToolInvokePanel.vue` |
| `ModalDialog.vue` | `components/flow2/RollbackConfirmDialog.vue`、`components/flow2/VersionHistoryDialog.vue`、`components/flow3/DeleteEntityDialog.vue`、`components/flow3/EntityFormDialog.vue`、`components/flow3/MergePrimaryDialog.vue`、`components/flow5/SubmitAllConfirmDialog.vue`、`components/flow6/RegenerateConfirmDialog.vue`、`components/flow7/PublishConfirmModal.vue`、`components/flow7/RollbackConfirmModal.vue`、`components/tools/ToolInvokePanel.vue`、`views/Flow1UploadView.vue` |
| `PanelSection.vue` | `components/flow2/AudioPlayerPanel.vue`、`components/flow2/CorrectionOverviewPanel.vue`、`components/flow2/SuggestionPanel.vue`、`components/flow2/TranscribeMetaPanel.vue`、`components/flow2/TranscriptContentPanel.vue`、`components/flow3/AiOverviewPanel.vue`、`components/flow3/DuplicateMergePanel.vue`、`components/flow3/EntityFilterPanel.vue`、`components/flow3/EntityGroupList.vue`、`components/flow3/EvidencePanel.vue`、`components/flow4/EntityFilterPanel.vue`、`components/flow4/ExpandedKeywordsPanel.vue`、`components/flow4/RelatedLeadsPanel.vue`、`components/flow4/SearchConditionPanel.vue`、`components/flow4/SearchFacetPanel.vue`、`components/flow4/SearchResultList.vue`、`components/flow5/AnnotationProgressPanel.vue`、`components/flow6/CitationPanel.vue`、`components/flow6/DraftInfoPanel.vue`、`components/flow6/GenerationParamPanel.vue`、`components/flow6/GenerationResultPanel.vue`、`components/flow6/RiskPanel.vue`、`components/flow7/PublishConfirmPanel.vue`、`components/flow7/ReviewCommentPanel.vue`、`components/flow7/RiskCheckPanel.vue`、`components/flow7/TransitionPanel.vue`、`components/flow7/VersionHistoryPanel.vue`、`views/Flow1UploadView.vue`、`views/Flow5CompareView.vue` |
| `PhaseStrip.vue` | `components/common/FlowHeader.vue` |
| `ProgressBar.vue` | `components/flow5/AnnotationProgressPanel.vue`、`components/flow6/GenerationResultArea.vue`、`views/Flow1UploadView.vue` |
| `StatusPill.vue` | `App.vue`、`components/common/ApiContractPanel.vue`、`components/flow2/AudioPlayerPanel.vue`、`components/flow2/CorrectionOverviewPanel.vue`、`components/flow2/ParagraphList.vue`、`components/flow2/SegmentCard.vue`、`components/flow2/SuggestionCard.vue`、`components/flow2/TranscribeMetaPanel.vue`、`components/flow2/VersionHistoryDialog.vue`、`components/flow3/DuplicateMergePanel.vue`、`components/flow3/EntityCard.vue`、`components/flow3/EvidencePanel.vue`、`components/flow4/EntityFilterPanel.vue`、`components/flow4/ExpandedKeywordsPanel.vue`、`components/flow4/RelatedLeadsPanel.vue`、`components/flow4/SearchResultList.vue`、`components/flow4/SearchStatsBar.vue`、`components/flow4/SourceDetailDrawer.vue`、`components/flow5/AiVerdictPanel.vue`、`components/flow5/AnnotationProgressPanel.vue`、`components/flow5/ClaimSourceCompare.vue`、`components/flow5/ComparisonItemCard.vue`、`components/flow6/CitationPanel.vue`、`components/flow6/DraftBlockList.vue`、`components/flow6/GenerationResultPanel.vue`、`components/flow6/IncludeScopeSelector.vue`、`components/flow6/RiskPanel.vue`、`components/flow7/RiskCheckPanel.vue`、`components/flow7/RiskItemCard.vue`、`components/flow7/TransitionPanel.vue`、`components/flow7/VersionHistoryPanel.vue`、`components/tools/ToolInvokePanel.vue`、`composables/useGenerationForm.ts`、`composables/useGenerationMeta.ts`、`composables/usePublishRiskCheck.ts`、`views/Flow1UploadView.vue`、`views/Flow4SearchView.vue`、`views/Flow5CompareView.vue`、`views/Flow6GenerateView.vue`、`views/Flow7PublishView.vue` |

### `flow2/` —— 流程 2 · 转写与人工校正（私有）（15 个）

| 组件 | 被谁引用 |
| --- | --- |
| `AudioPlayerPanel.vue` | `views/Flow2TranscribeView.vue` |
| `CorrectionOverviewPanel.vue` | `views/Flow2TranscribeView.vue` |
| `ParagraphList.vue` | `components/flow2/TranscriptContentPanel.vue` |
| `RollbackConfirmDialog.vue` | `views/Flow2TranscribeView.vue` |
| `SegmentCard.vue` | `components/flow2/SegmentTimeline.vue` |
| `SegmentTimeline.vue` | `components/flow2/TranscriptContentPanel.vue` |
| `SuggestionCard.vue` | `components/flow2/SuggestionPanel.vue` |
| `SuggestionPanel.vue` | `views/Flow2TranscribeView.vue` |
| `TranscribeHeaderActions.vue` | `views/Flow2TranscribeView.vue` |
| `TranscribeMetaPanel.vue` | `views/Flow2TranscribeView.vue` |
| `TranscriptConfirmPrompt.vue` | `views/Flow2TranscribeView.vue` |
| `TranscriptContentPanel.vue` | `views/Flow2TranscribeView.vue` |
| `TranscriptIdlePanel.vue` | `views/Flow2TranscribeView.vue` |
| `TranscriptUnavailablePanel.vue` | `views/Flow2TranscribeView.vue` |
| `VersionHistoryDialog.vue` | `views/Flow2TranscribeView.vue` |

### `flow3/` —— 流程 3 · 提取地点人物事件（私有）（14 个）

| 组件 | 被谁引用 |
| --- | --- |
| `AiOverviewPanel.vue` | `components/flow3/ExtractionResultPanel.vue` |
| `DeleteEntityDialog.vue` | `views/Flow3ExtractView.vue` |
| `DuplicateMergePanel.vue` | `components/flow3/ExtractionResultPanel.vue` |
| `EntityCard.vue` | `components/flow3/EntityGroupList.vue` |
| `EntityFilterPanel.vue` | `components/flow3/ExtractionResultPanel.vue`、`views/Flow4SearchView.vue` |
| `EntityFormDialog.vue` | `views/Flow3ExtractView.vue` |
| `EntityGroupList.vue` | `components/flow3/ExtractionResultPanel.vue` |
| `EvidencePanel.vue` | `components/flow3/ExtractionResultPanel.vue` |
| `ExtractionConfirmPanel.vue` | `views/Flow3ExtractView.vue` |
| `ExtractionIdlePanel.vue` | `views/Flow3ExtractView.vue` |
| `ExtractionResultPanel.vue` | `views/Flow3ExtractView.vue` |
| `ExtractionUnavailablePanel.vue` | `views/Flow3ExtractView.vue` |
| `MergePrimaryDialog.vue` | `views/Flow3ExtractView.vue` |
| `WriteErrorBanner.vue` | `views/Flow3ExtractView.vue` |

### `flow4/` —— 流程 4 · 检索地方资料（私有）（11 个）

| 组件 | 被谁引用 |
| --- | --- |
| `EntityFilterPanel.vue` | `components/flow3/ExtractionResultPanel.vue`、`views/Flow4SearchView.vue` |
| `ExpandedKeywordsPanel.vue` | `views/Flow4SearchView.vue` |
| `RelatedLeadsPanel.vue` | `views/Flow4SearchView.vue` |
| `RiskConfirmNotice.vue` | `views/Flow4SearchView.vue` |
| `SearchConditionPanel.vue` | `views/Flow4SearchView.vue` |
| `SearchFacetPanel.vue` | `views/Flow4SearchView.vue` |
| `SearchFallbackActions.vue` | `views/Flow4SearchView.vue` |
| `SearchIdlePanel.vue` | `views/Flow4SearchView.vue` |
| `SearchResultList.vue` | `views/Flow4SearchView.vue` |
| `SearchStatsBar.vue` | `views/Flow4SearchView.vue` |
| `SourceDetailDrawer.vue` | `views/Flow4SearchView.vue` |

### `flow5/` —— 流程 5 · 标注一致与差异（私有）（10 个）

| 组件 | 被谁引用 |
| --- | --- |
| `AiVerdictPanel.vue` | `components/flow5/ComparisonItemCard.vue` |
| `AnnotationProgressPanel.vue` | `views/Flow5CompareView.vue` |
| `AnnotationSubmitBar.vue` | `views/Flow5CompareView.vue` |
| `ClaimSegmentBlock.vue` | `components/flow5/ComparisonItemCard.vue` |
| `ClaimSourceCompare.vue` | `components/flow5/ComparisonItemCard.vue` |
| `ComparisonConfirmBanner.vue` | `views/Flow5CompareView.vue` |
| `ComparisonItemCard.vue` | `views/Flow5CompareView.vue` |
| `ComparisonTaskEntry.vue` | `views/Flow5CompareView.vue` |
| `HumanVerdictPanel.vue` | `components/flow5/ComparisonItemCard.vue` |
| `SubmitAllConfirmDialog.vue` | `views/Flow5CompareView.vue` |

### `flow6/` —— 流程 6 · 生成故事卡 / 讲稿（私有）（9 个）

| 组件 | 被谁引用 |
| --- | --- |
| `CitationPanel.vue` | `views/Flow6GenerateView.vue` |
| `DraftBlockList.vue` | `components/flow6/GenerationResultPanel.vue` |
| `DraftInfoPanel.vue` | `views/Flow6GenerateView.vue` |
| `GenerationParamPanel.vue` | `views/Flow6GenerateView.vue` |
| `GenerationResultArea.vue` | `views/Flow6GenerateView.vue` |
| `GenerationResultPanel.vue` | `components/flow6/GenerationResultArea.vue` |
| `IncludeScopeSelector.vue` | `components/flow6/GenerationParamPanel.vue` |
| `RegenerateConfirmDialog.vue` | `views/Flow6GenerateView.vue` |
| `RiskPanel.vue` | `views/Flow6GenerateView.vue` |

### `flow7/` —— 流程 7 · 审核发布（私有）（8 个）

| 组件 | 被谁引用 |
| --- | --- |
| `PublishConfirmModal.vue` | `views/Flow7PublishView.vue` |
| `PublishConfirmPanel.vue` | `views/Flow7PublishView.vue` |
| `ReviewCommentPanel.vue` | `views/Flow7PublishView.vue` |
| `RiskCheckPanel.vue` | `views/Flow7PublishView.vue` |
| `RiskItemCard.vue` | `components/flow7/RiskCheckPanel.vue` |
| `RollbackConfirmModal.vue` | `views/Flow7PublishView.vue` |
| `TransitionPanel.vue` | `views/Flow7PublishView.vue` |
| `VersionHistoryPanel.vue` | `views/Flow7PublishView.vue` |

### `review/` —— 审校对照（流程 2 / 5 共用）（1 个）

| 组件 | 被谁引用 |
| --- | --- |
| `ReviewDiffViewer.vue` | `components/flow2/SegmentCard.vue`、`components/flow5/ComparisonItemCard.vue` |

### `tools/` —— AI 能力面板（流程 4~7 共用）（1 个）

| 组件 | 被谁引用 |
| --- | --- |
| `ToolInvokePanel.vue` | `views/Flow4SearchView.vue`、`views/Flow5CompareView.vue`、`views/Flow6GenerateView.vue`、`views/Flow7PublishView.vue` |

合计 83 个组件，分布在 9 个目录。

## 二、6 个大型视图已拆分（当前结构）

拆分前 6 个流程视图都在 1200~1800 行，职责过多。现已按「编排留在视图、状态进 composable、区块进组件」拆开：

| 视图 | 拆分前 | 现在 | 拆出的私有组件 |
| --- | --- | --- | --- |
| `Flow2TranscribeView.vue` | 1762 | 448 | 16 个（`flow2/`）+ 5 个 composable |
| `Flow3ExtractView.vue` | 1435 | 447 | 14 个（`flow3/`）+ 9 个 composable |
| `Flow4SearchView.vue` | 1370 | 428 | 11 个（`flow4/`）+ 7 个 composable |
| `Flow5CompareView.vue` | 1342 | 438 | 10 个（`flow5/`）+ 7 个 composable |
| `Flow6GenerateView.vue` | 1531 | 403 | 9 个（`flow6/`）+ 5 个 composable |
| `Flow7PublishView.vue` | 1258 | 104 | 8 个（`flow7/`）+ 6 个 composable |

约定：**主视图 ≤ 450 行，每个拆出单元 ≤ 250 行**；接口调用入口、7 态状态机用法、顶层布局留在视图内，
被拆出的组件不自行发起请求，只 emit 意图、由视图或 composable 落库。

## 三、如何保持零死代码

本轮用「从入口做可达性分析」找出了全部未挂载文件，这个方法可以固化为 CI 检查：

- **未使用导出**：接入 `knip` 或 `ts-prune`，把「没有被任何入口引用」变成构建期错误；
- **未挂载组件**：本项目页面由显式路由表（`src/router/index.ts`）+ 动态 import 决定，
  所以从 `main.ts` 做一次图遍历即可发现孤儿文件，无需人工比对；
- 代码规范侧由 `pnpm lint`（含 JSDoc 完整性）、`pnpm format:check`、`pnpm typecheck` 守住。

## 四、清理记录：已移除的「三栏审校工作台」

本目录曾保留一套未被任何路由挂载的三栏工作台子系统（来源 / 音频文本 / 审校对照），
共 **15 个文件、约 2.9k 行**，已在本轮代码质量审查中删除。判断依据：

| 文件 | 原职责 | 删除依据 |
| --- | --- | --- |
| `audio/AudioPlayer.vue` | 中栏音频播放器 | 流程 2 自带播放控件 |
| `audio/TranscriptPane.vue` | 中栏转写列表 + 自动跟随滚动 | 流程 2 自带片段列表 |
| `audio/TranscriptSegmentItem.vue` | 单个转写片段 | 同上 |
| `sources/SourcePanel.vue` | 左栏来源列表 + `retrieve_local_sources` 入口 | 流程 4 自带检索结果列表 |
| `sources/SourceFilterBar.vue` | 左栏来源类型筛选 | 流程 4 自带筛选 |
| `sources/SourceTag.vue` | 来源标签（Teleport 浮层） | 流程 4 自带标签渲染 |
| `review/ReviewPanel.vue` | 右栏三标签页容器 | 流程 5 / 6 各自实现对应面板 |
| `review/ReviewUnitCard.vue` | 右栏审校单元卡片 | 流程 5 自带对照卡片 |
| `tools/ClaimBoard.vue` | 论断核查面板（`compare_claims`） | 流程 5 自带标注台 |
| `tools/StoryCardPanel.vue` | 故事卡面板（`build_story_card`） | 流程 6 自带生成面板 |
| `common/ToolErrorBanner.vue` | 工具错误提示条 | 只被上述面板引用；流程页错误态由 `AsyncStateBoundary` 与工具面板自身呈现 |
| `composables/useWorkspace.ts` | 三栏工作台上下文（405 行） | 只服务于上述组件 |
| `composables/useAudioSync.ts` | 音频播放与片段定位 | 流程 2 自带；`PLAYBACK_RATES` 仅被 `AudioPlayer` 消费 |
| `composables/useSourceFilter.ts` | 来源筛选与配色元数据 | 流程 4 自带；`SOURCE_KIND_META` 无其他消费者 |
| `composables/useToolRunner.ts` | 工具调用状态包装 | 流程页用 `toolClient` + `useAsyncTask`；`ToolInvokePanel` 自管状态 |

四工具（`retrieve_local_sources`、`compare_claims`、`build_story_card`、`submit_review`）
在流程 4~7 中均有挂载调用点，所以删除的是**重复实现**，不是能力本身。
