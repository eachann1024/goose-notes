# 功能边界

- 开始任务前，先判断目标属于速记小窗、常规笔记本或两者共享，再定位实现。
- 速记小窗是独立的轻量草稿便签，入口为 `quicknote.html`，使用 `__GOOSE_LITE__` 和 `quicknote.css` 隔离功能与样式。

# 全局规范
- Toast、提醒、错误类都使用全局在用的组件而不是手写
- 原「Notebook AI」统一称呼为「AI」
- AI 保留 OpenAI Responses、OpenAI 兼容 Chat Completions 和 Anthropic 协议。
- Agent 多步能力依赖模型工具调用能力，不绑定单一接口协议。

# 边界注意
1. uTools 环境存储数据
2. 本地文件夹
3. 鹅的小窗项目


# 验证

- 修改代码后以 `bun run build` 通过为验收标准之一。
- 样式、交互验证可以使用浏览器，基于全局 `browser-use` skill。

# utools 描述
- 该项目只在 uTools 发布, 无需关注其他平台
- utools 内核版本是旧版的, 注意样式编写,例如: uTools 旧内核对 hsl(var(--xxx)/alpha) 支持不好，会退化成 整块实色红，文字又是同色
