# BlockNote xl-ai 使用指南

Goose Note 的编辑器内 AI 现在由 [@blocknote/xl-ai](https://www.blocknotejs.org/docs/ai)
官方接管。本文档说明如何配置、如何使用、当前限制。

## 一、如何启用

### 1. 配置 AI Provider（必须）

xl-ai 通过 Vercel AI SDK 直连 LLM API，所以**只支持自定义 OpenAI 兼容协议或 Claude**。

打开 **设置 → AI 助手**：

| 字段 | OpenAI 兼容 | Claude |
|---|---|---|
| 启用 AI | ✅ 打开 | ✅ 打开 |
| Provider 模式 | 自定义 | 自定义 |
| 协议 | OpenAI | Claude |
| Base URL | `https://api.openai.com/v1`（或第三方代理） | `https://api.anthropic.com/v1` |
| API Key | 你的 API key | 你的 API key |
| 选择模型 | 例如 `gpt-4o-mini` / `gpt-4o` / `gpt-5` | 例如 `claude-3-5-sonnet-latest` |

> ⚠️ **uTools 内置模型暂不支持编辑器内 AI 菜单**——uTools 的 `window.utools.ai()` 没有 Vercel AI SDK 适配器。
> 如需 uTools 模型，请用工作区聊天面板（右侧 AI Page），它仍走旧的 `runAITextStream`。

### 2. 验证生效

- 选中一段文字 → 工具栏出现 Sparkle 按钮 → 点击会弹出 BlockNote 官方 AI 菜单
- 在空行输入 `/` → 选「生成」(Sparkles 图标) → 同样弹 BlockNote 官方 AI 菜单

## 二、能做什么

xl-ai 默认 AI 菜单包含（由 `@blocknote/xl-ai` 内置 `getDefaultAIMenuItems`）：

- **Continue writing**（基于当前内容续写）
- **Make shorter** / **Make longer**
- **Improve writing**（改写润色）
- **Fix spelling & grammar**
- **Summarize**
- **Translate**
- 等等

AI 写入时使用**行内 diff highlight**：
- 新增内容高亮显示
- 用户点击 ✅ 接受 / ❌ 拒绝
- 比旧自家 AiPanel 一次性 `pasteMarkdown` 写入更可控

## 三、技术细节

### Transport 适配器

代码位置：[src/lib/ai-provider/blocknoteAITransport.ts](src/lib/ai-provider/blocknoteAITransport.ts)

`createGooseAITransport({ getSettings, getModelId })` 返回 `ChatTransport<UIMessage>`：
- `sendMessages`：从 settings 读 provider + apiKey + baseURL，用 Vercel AI SDK 的
  `createOpenAICompatible` / `createAnthropic` 创建 model，调 `streamText().toUIMessageStream()` 返回流
- `reconnectToStream`：浏览器内无后端，固定返回 null

### Editor 接入位置

- [src/pages/workspace/components/editor/Editor.tsx](src/pages/workspace/components/editor/Editor.tsx)
  `useCreateBlockNote({ extensions: [..., AIExtension({ transport })] })`
- [src/pages/workspace/components/editor/EditorFindBar.tsx](src/pages/workspace/components/editor/EditorFindBar.tsx)
  `<BlockNoteView>` 内渲染 `<AIMenuController />`
- [src/pages/workspace/components/editor/EditorFormattingToolbar/index.tsx](src/pages/workspace/components/editor/EditorFormattingToolbar/index.tsx)
  `handleAiActivate` 调 `aiExtension.openAIMenuAtBlock(blockId)`
- [src/pages/workspace/components/command/blocknoteSlashItems.tsx](src/pages/workspace/components/command/blocknoteSlashItems.tsx)
  「生成」slash 项调 `editor.getExtension(AIExtension).openAIMenuAtBlock(blockId)`

### 旧 AI UI 处置

- `AiPanel` / `AiPanelInput` / `AiPanelResults` / `useAiPanelState`：文件保留，但 `aiActive` 永不为 true，组件不会渲染
- `AiInlineInput`：文件保留并仍渲染于 EditorFindBar，但没有任何位置 dispatch `open-ai-input-popover` 事件，所以不会显示
- **工作区聊天面板（AiWorkspacePage 等）完全不受影响**，仍走旧 `runAITextStream` + capability/intent 框架

## 四、已知限制

1. **uTools 内置模型不可用于编辑器内 AI**（如上）。需 uTools 模型时切到工作区聊天页
2. **跨页面创建/移动**功能（旧 capability/intent 中的 `note.create` / `note.append`）xl-ai 不替代——这些功能继续走工作区聊天面板
3. Anthropic 浏览器直连需要 CORS header `anthropic-dangerous-direct-browser-access: true`，已在 transport 中自动加上
4. BlockNote 0.51 引入 Mantine 作为 xl-ai UI 适配器；mantine 样式作用域到编辑器内部，与项目的 shadcn/ui 共存

## 五、故障排查

| 现象 | 原因 | 解法 |
|---|---|---|
| 点击 AI 按钮没反应 | `aiExtension` 没注册成功 | 检查 Editor.tsx 是否引入 AIExtension |
| 弹出菜单后报「uTools 内置模型暂不支持」 | provider 配置错 | 切换到自定义 OpenAI/Claude |
| 写入后中文显示为方框 | 与 xl-ai 无关，是 PDF 导出的字体问题 | 见 `public/fonts/README.md` |
| Claude 直连报 CORS | 浏览器拦截 | transport 已加 CORS header，若仍报错改用代理 baseURL |
| 流式响应卡住 | API key 无效或限流 | DevTools Network 查请求状态 |

## 六、后续可扩展

- 自定义 AI 菜单项：用 `getDefaultAIMenuItems` + 项目自有 prompt 组合
- 自定义 streamTool：通过 `streamToolsProvider` 实现新的 AI 能力（如「写为表格」）
- uTools 模型适配器：实现 `LanguageModelV2` 接口，把 `window.utools.ai()` 桥成 Vercel AI SDK model
