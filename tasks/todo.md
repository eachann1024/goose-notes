# Todo

## 2026-05-26

### Goose Note 四项升级计划（#10 + #4 + #5 + #6）

详细方案见 `tasks/plan-2026-05-26/index.html`（已渲染为可评论 HTML）

#### Sprint 1：#10 BlockNote 0.50 → 0.51.3 + 接入 xl-ai
- [ ] `pnpm up @blocknote/core@0.51.3 @blocknote/react@0.51.3`
- [ ] `pnpm build` 验证 + 4 个手工回归（粘贴 / md / code+math+mermaid / file）
- [ ] `pnpm add @blocknote/xl-ai@0.51.3 @blocknote/mantine@0.51.3`
- [ ] 新建 `src/lib/ai-provider/customAdapter.ts`：把 `window.utools.ai()` 桥成 Vercel AI SDK `LanguageModelV1`
- [ ] 改造 `src/pages/workspace/components/editor/Editor.tsx`：加 `AIExtension` + 渲染 xl-ai 三个组件
- [ ] 删除 `EditorFormattingToolbar/AiPanel.tsx` / `AiPanelInput.tsx` / `AiPanelResults.tsx` / `useAiPanelState.ts` / `groups/AiButton.tsx`
- [ ] 删除 `editor/AiInlineInput.tsx` / `editor/fakeSelectionExtension.ts`
- [ ] 清理 `EditorFormattingToolbar/index.tsx` AI 分支 + `blocknoteSlashItems.tsx` 中的 AI 项
- [ ] 改造 `ai/hooks/useAiRequestSubmit.ts`：workspace 聊天用 `streamText`
- [ ] 删除 `ai-provider/stream.ts` / `providers/openai.ts` / `providers/claude.ts`（被 Vercel SDK 替代）
- [ ] 瘦身 `ai-write/planCommit.ts` 三个 inline 动作 + `useAiWriteActions.ts` editor 分支 + `targetResolution.ts` 光标选区分支

#### Sprint 2：#4 PDF 导出
- [ ] `pnpm add @blocknote/xl-pdf-exporter@0.51.3 @react-pdf/renderer`
- [ ] 新建 `src/lib/pdfExport/{index.ts, blockMappings.tsx, fontConfig.ts}`
- [ ] 为 callout / customFile / codeBlock 写 `pdfDefaultSchemaMappings` 覆盖
- [ ] 添加中文字体 NotoSansSC 到 `public/fonts/`（懒加载）
- [ ] `src/lib/export/index.ts` re-export
- [ ] `PageMenu.tsx:172-200` 加 PDF 菜单项
- [ ] `vite.config.ts` vendor-export 加 3 项 + 移除僵尸 `pptxgenjs`

#### Sprint 3：#5 AI 打标签 + 起标题（前置修 frontmatter bug）
- [ ] **前置**：修 `src/stores/pages/actions/localFolder/write.ts:134` frontmatter 丢失 bug
- [ ] `Page.tags: string[]` 字段（`src/types/index.ts` + `src/stores/pages/types.ts`）
- [ ] `src/stores/pages/migrations.ts` 老数据补 `tags: []` 默认
- [ ] `src/lib/local-folder-scanner.ts` + `local-frontmatter-store.ts` 双向同步 tags
- [ ] 新建 intent `noteSuggestTags.ts` / `noteSuggestTitle.ts`
- [ ] 注册到 `src/agent/capabilities/note/index.ts` + 补 prompts
- [ ] `src/agent/core/types.ts` artifact type 加 `tag_suggestion` / `title_suggestion`
- [ ] 新建 `TagInput.tsx` / `TagSuggestionPopover.tsx` / `TagFilterPanel.tsx`
- [ ] Editor 头部加 TagInput + Sparkle AI 按钮
- [ ] `useCommandSearch.ts` 支持 `#tag` 过滤模式

#### Sprint 4：#6 uTools 划词剪藏
- [ ] `plugin.json` 新增 4 个 feature（clip_text / clip_image / clip_files / clip_quick）
- [ ] `preload/preload.cjs` onPluginEnter clip_* 分支 + `readCurrentBrowserUrl()` 注入
- [ ] `src/lib/utools/lifecycle.ts` 扩展 PluginEnterPayload 类型
- [ ] 新建 `src/lib/clipper/handleClip.ts` + `buildClipBlocks.ts`
- [ ] `src/stores/useSettings.ts` 加 `clipper` slice
- [ ] `src/stores/pages/actions/pageCreate.ts` 暴露 `appendBlocksToPage`
- [ ] `src/hooks/usePluginEvents.ts` 前置 `code.startsWith("clip_")` 短路
- [ ] `Editor.tsx` 暴露 editorRef.appendBlocks
- [ ] 新建 `ClipTargetDialog.tsx`（ask 模式）
- [ ] Clipper 设置页

#### 待确认决策点
- [ ] utools provider 是否桥到 Vercel AI SDK（推荐桥）
- [ ] Mantine vs shadcn 适配器（推荐先共存）
- [ ] 标签是否嵌套（推荐嵌套但不存 parent）
- [ ] 剪藏默认行为（推荐 append 收件箱）
- [ ] 是否分批 ship（推荐每个 Sprint 独立 ship）
