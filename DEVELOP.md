# 鹅的笔记 · goose-note-app

A local-first, Notion-style note-taking app — built as a [Electron](https://u.tools/) plugin, also runnable in the browser.

本地优先的 Notion 风格笔记应用，基于 [BlockNote](https://www.blocknotejs.org/) 块编辑器构建，内置 AI 能力，可作为 Electron 插件运行，也支持浏览器端使用。

## ✨ 特性

- **块编辑器**：基于 BlockNote 的所见即所得编辑，支持标题、列表、折叠块、代码块等
- **本地优先**：笔记存储在本地，支持挂载本地文件夹作为记事本
- **AI 能力**：集成 AI SDK（OpenAI Responses / OpenAI-compatible / Anthropic），支持续写、改写、问答
- **快速速记**：独立的速记小窗（鹅的小窗），随手记录、一键入库
- **全局搜索**：跨记事本搜索标题与正文，跳转即定位
- **深色模式**：完整的明暗主题适配

## 🛠 技术栈

- **编辑器**：BlockNote（ProseMirror）+ Tiptap 扩展
- **框架**：React + TypeScript + Vite
- **状态管理**：Zustand
- **UI**：Radix UI + HeroUI + Tailwind CSS
- **AI**：Vercel AI SDK
- **宿主**：Electron（可选）/ 浏览器

## 🚀 本地开发

```bash
# 安装依赖（推荐 bun）
bun install

# 启动开发服务器（http://localhost:6001）
bun run dev

# 构建（产出 Electron 插件包）
bun run build
```

### Electron 插件调试

浏览器 `bun run dev` 适合改 UI，但 Electron 真机行为（preload、主题、窗口等）需在插件环境里验证：

1. 执行 `bun run build`（生成双 renderer、Electron 主进程/preload 与 `dist-electron/app-pack`）
2. 打开 **Electron 开发者工具**
3. 启动 Electron 开发模式并验证主窗口
4. 在开发者工具中 **打开** 该插件，即可看到最新构建效果

改代码后重复步骤 1，再在开发者工具里重新打开插件（或按工具提示刷新）即可。

速记小窗由同一 Electron 应用的 `quicknote.html` renderer 提供。

### Electron 桌面端（仅本地模式）

默认 `bun run build` 仍是 Electron 插件，与桌面端产物隔离。

```bash
# 开发调试（Vite http://localhost:6001 + Electron；不经过 Electron 打包）
bun run mac:dev

# 构建 macOS .app（Apple Silicon arm64；前端产物在 dist-electron/renderer/）
# 未签名：CSC_IDENTITY_AUTO_DISCOVERY=false
bun run mac

# Windows：开发调试
bun run win:dev

# Windows：构建 NSIS 安装包（bun run build:win 为等价别名）
# - Windows 上原生构建；
# - 在 macOS 上需要 Wine。缺少 Wine 时脚本会失败并提示，不使用 mingw 交叉编译。
bun run win
```

微信无法直接发送 `.app`。请把 `.app` 打成 zip 再发；接收方解压后若提示已损坏，在终端执行 `xattr -cr "/path/to/Goose Note.app"` 去掉隔离属性后再打开。

桌面端 = Obsidian 式「仅本地文件夹」：无自带/内置笔记本（不种 default-notebook、不种新手引导页、UI 无「新建记事本」），仓库 = local-folder 挂载列表；无仓库时为空态（打开文件夹 / 新建仓库），允许移除最后一个仓库回到空态。残留的旧内置页（web-db `gn:page:*`）不灌进侧栏，可在「设置 → 本地文件夹」一次性导出为 .md（不静默迁移、不自动删除）。

桌面端数据只落本机：内部记事本走 localStorage，附件走 `appDataDir/attachments` 磁盘（上限 50MB），本地文件夹走磁盘 `.md`；无账号、速记小窗、全局热键等 Electron 生态能力。构建目标互不污染：`bun run build` 只产出 Electron 包，`bun run mac` 只产出 macOS 桌面 App，`bun run win` 只产出 Windows NSIS 安装包。

构建完成后，最终产物会自动收集到顶层 `dist-desktop/`：

- `dist-desktop/Goose Note.app`（Apple Silicon）
- `dist-desktop/` 下的 NSIS 安装包（`.exe`）

源码构建中间产物在 `dist-electron/packaged/` 下。macOS 主窗 hiddenInset + traffic lights；Windows 使用系统原生边框（无 overlay）。

桌面端冒烟清单（macOS 用 `bun run mac` 产物或 `bun run mac:dev`，Windows 用 `bun run win` 产物或 `bun run win:dev`；完整 GUI 验收需人工逐项过）：

1. 启动：`.app` 能打开，主窗口 1250x800 正常渲染，无白屏
2. 选文件夹：设置里添加本地文件夹记事本，目录选择器可用
3. 读写：本地文件夹内新建/编辑/删除 `.md` 页面，磁盘内容同步
4. 复制：编辑器内复制文本/块，系统剪贴板有内容
5. 附件：内部记事本插入图片/文件附件（>10MB 且 ≤50MB 可存），刷新后仍可打开
6. 外链：点击 http(s) 链接用系统默认浏览器打开
7. Ollama：AI 设置指向 `http://localhost:11434` 可连通并出文

## 📦 构建产物

`bun run build` 会执行 `tsc` 类型检查 + `vite build` + Electron 打包脚本，产出可加载到 Electron 的插件包。

提交前请确保以下检查通过（CI 也会跑这些）：

```bash
bun run typecheck   # tsc -b --noEmit
bun run lint        # eslint .
bun run test:unit   # 单元测试
bun run test:e2e    # 浏览器端到端测试
bun run build
```

## 🔒 项目状态

本项目当前代码采用 GPL-3.0-only；第三方和历史版本保留原许可。贡献应具备相应权利并保留来源声明。报告安全问题请参阅 [SECURITY.md](./SECURITY.md)。

## 📄 许可证

采用标准 GPL-3.0-only。分发时应提供对应版本源码与必要构建脚本，详见 [LICENSE](./LICENSE)、[第三方声明](THIRD-PARTY-NOTICES.txt) 与 [源码获取说明](SOURCE-CODE.md)。
