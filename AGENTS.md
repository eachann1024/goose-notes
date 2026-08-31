# 功能边界

- 开始任务前，先判断目标属于速记小窗、常规笔记本或两者共享，再定位实现。
- 速记小窗是独立的轻量草稿便签，入口为 `quicknote.html`，使用 `__GOOSE_LITE__` 和 `quicknote.css` 隔离功能与样式。
- 只改 `src/`。`app/` 是 uTools 发布产物，`bun run build` 会覆盖，不要手改 chunks。
- 编辑器热路径、附件打开、侧栏订阅见 `src/components/editor/AGENTS.md`。


# 全局规范

- Toast、提醒、错误类都使用全局在用的组件而不是手写。
- 主窗口 toast 靠右；速记小窗 toast 居中。
- 原「Notebook AI」统一称呼为「AI」
- AI 保留 OpenAI Responses、OpenAI 兼容 Chat Completions 和 Anthropic 协议。
- Agent 多步能力依赖模型工具调用能力，不绑定单一接口协议。
- 打开附件、图片、本地文件只走 `openResourceExternally`。
- 不换 BlockNote 内核。
- 出设计计划时注意，uTools 默认宽度 800、高度 800；Electron 桌面默认宽度 1250、高度 800；

# 边界注意

1. uTools 环境存储数据
2. 本地文件夹
3. 鹅的小窗项目
4. Electron 桌面（仅本地模式）：`bun run mac` / `bun run win` / `bun run linux` 构建，产物在 `dist-electron/` 与 `dist-desktop/`；Linux 包建议在 Linux 或 Docker 中构建（macOS 交叉构建 AppImage 受限）。宿主差异走 `@host-runtime` 与 `src/lib/editor-platform/resolve.ts`，不要污染 uTools 构建。仅本地文件夹仓库：无内置笔记本（不种 default-notebook / 新手引导页），空态只有「打开文件夹 / 新建仓库」，可移除最后一个仓库回空态。

# 验证

- 每次修改完了之后都要执行 `bun run build` 。
- 样式、交互验证可以使用浏览器，基于全局 `browser-use` skill。
