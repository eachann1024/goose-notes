# 产品边界

- 这是原生 macOS 笔记本，不是 uTools 插件、Tauri 应用、Electron 应用或浏览器产品。
- AppKit 负责应用生命周期、窗口、菜单、侧边栏、笔记树、搜索、标签页、文件面板和持久化。
- 单一 WKWebView 只负责 BlockNote 编辑器、选区、输入法组合和编辑器内浮层。
- 原生层是笔记数据的唯一权威。浏览器替身只用于开发与验收，不得进入生产存储路径。
- Markdown 只用于导入和导出。BlockNote JSON 是正文的规范格式。
- 不加入 AI、MCP、速记小窗、WebDAV、Quick Look、Sparkle、Amore、外部 LLM、浏览器后端或多宿主兼容分支。
- 新功能必须先判断属于原生壳、编辑器或桥接协议，再落到对应目录。

# 桥接规则

- 所有 Swift 与 JavaScript 消息必须带协议版本、请求 ID、页面 ID 和修订号。
- 只接受白名单命令。禁止向 WebView 暴露通用文件系统、任意脚本执行或网络凭据。
- 切页、失焦、关闭窗口和退出前必须刷新当前草稿。
- 原生层只接受与当前页面和当前修订匹配的编辑事件。过期事件必须返回冲突结果。
- 保存状态必须区分正在保存、已保存和保存失败，并向辅助技术播报。

# 设计规则

- 设计令牌的唯一来源是 `Design/tokens.json`。
- 修改令牌后运行 `bun run tokens`，不得手工改生成的 Swift 或 CSS 文件。
- 保持克制的暖中性色、白色编辑纸面和少量珊瑚色动作反馈。
- 所有交互必须覆盖默认、悬停、聚焦、按下、选中、禁用、加载和错误状态。
- 保留系统焦点环、系统文本服务、右键菜单、VoiceOver 和减少动态支持。
- 界面文案使用大陆简体中文。

# 验证

- 修改 Web 编辑器后运行 `bun run check:web` 和 `bun run test:e2e`。
- 修改 Swift 或桥接后运行 `bun run build:native` 和 `bun run test:native`。
- 修改边界、依赖或构建配置后运行 `bun run audit:boundaries`。
- UI 变更必须完成浏览器验收，并运行真实 macOS 应用核对窗口、菜单、沙盒和 WKWebView。
