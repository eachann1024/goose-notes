# Goose Note — AGENTS.md

> 最后更新：2026-05-13

## 项目概览

- **定位**：uTools 插件版笔记应用（仅生成 uTools 版本，不打包桌面端）
- **技术栈**：React 19 + TypeScript + Vite + BlockNote 编辑器 + Zustand + Tailwind CSS + shadcn/ui
- **构建**：`pnpm build`（tsc + vite build + utools-build 脚本）
- **开发**：`pnpm dev`（端口 6001）
- **包管理**：pnpm，锁文件 bun.lock
- **AI SDK**：@ai-sdk/anthropic + @ai-sdk/openai-compatible + ai（Vercel AI SDK）

## 核心架构

```
src/
├── pages/
│   ├── workspace/          # 主编辑区（编辑器 + 侧栏 + 大纲面板）
│   │   └── components/
│   │       ├── editor/     # BlockNote 编辑器 + 自定义块（callout/video/arrow）
│   │       ├── sidebar/    # 页面树 + 笔记本切换
│   │       ├── outline/    # 标题大纲面板
│   │       └── page/       # 页面菜单 + 导出
│   └── sticky-note/        # 便签功能页
├── stores/                 # Zustand stores
│   ├── usePages.ts         # 页面 CRUD
│   ├── useNotebooks.ts     # 笔记本管理
│   ├── useSettings.ts      # 设置（含 AI 配置）
│   ├── useStickyNote.ts    # 便签状态
│   ├── useAiSessions.ts    # AI 会话
│   └── useTabs.ts          # 标签页
├── lib/
│   ├── blocknote-content.ts # BlockNote 内容序列化/反序列化
│   ├── imageExport.ts       # 图片导出（html-to-image，含卡片主题系统）
│   ├── docxExport.ts        # Word 导出（docx 库）
│   ├── export.ts            # HTML 导出
│   ├── ai-provider.ts       # AI 模型配置
│   ├── ai-write.ts          # AI 写入逻辑
│   ├── ai-intent-router.ts  # AI 意图路由
│   ├── analytics.ts         # Mixpanel 埋点
│   └── utools.ts            # uTools API 封装
└── hooks/                   # 自定义 hooks
```

## 近期变更（2026-05-10 ~ 2026-05-13）

- **标题折叠**：重构 `blocknote-content.ts`，新增 `organizeToggleHeadingSections()` 自动按层级嵌套标题子内容，第一行标题不参与折叠
- **折叠交互**：折叠箭头 hover 显示、收起时常驻，折叠状态持久化到 localStorage
- **代码块增强**：代码块内回车换行、Shift+回车跳出；`CodeBlockEnhancer` 支持嵌套块内代码块；语言搜索框样式优化
- **格式工具栏**：移除手动折叠按钮，图片/视频/分隔线等不可格式化块不再显示工具栏
- **图片导出**：新增 `imageExport.ts`（723 行），支持 9 种卡片主题、html-to-image 渲染、全屏 loading overlay
- **Word 导出**：新增 `docxExport.ts`（542 行），基于 docx 库，支持表格/图片/代码块导出
- **数据可视化**：集成 echarts，dataviz shell + iframe 自适应 + 缩放快捷键
- **便签功能**：新增 sticky-note 页面（StickyNotePage + Selector + Toolbar + Zustand store）
- **BlockNote 迁移**：从 Tiptap 完全迁移到 BlockNote 0.49，支持斜杠菜单 + 表格拖拽手柄

## 验证

- 每次代码修改完成后，**立即执行 `pnpm build`** 校验构建通过，确认无误再标记任务完成
- build 必须看到最后输出 `✓ built` 才算通过
- 不用做 e2e
- 项目仅生成 uTools 版本，查文档使用 context7
- 埋点关注维度：**功能级日活**（每个用户每天该功能的使用次数）

## 组件库

- UI 组件**优先使用 shadcn/ui**，有对应组件直接 `npx shadcn add`
- shadcn 无覆盖时查其他 npm 组件库，仍无则手写并说明原因

## 关键依赖

| 依赖 | 用途 |
|------|------|
| @blocknote/core + react | 块编辑器（v0.49） |
| echarts | 数据可视化图表 |
| html-to-image | 图片导出 |
| docx | Word 文档导出 |
| pptxgenjs | PPT 导出 |
| mermaid | Mermaid 图表渲染 |
| katex | 数学公式 |
| mixpanel-browser | 埋点分析 |
| zustand | 状态管理 |
| @dnd-kit | 拖拽排序 |
| framer-motion | 动画 |
| react-arborist | 页面树组件 |
| code-inspector-plugin | 代码定位 |

## GitNexus 代码库指引

### 已索引仓库

| 仓库 | 节点数 | 边数 | 功能模块 | 执行流 | 状态 |
|------|--------|------|----------|--------|------|
| goose-notion | 4,713 | 8,306 | 163 | 300 | ✅ 最新 |
| diteng-erp | 9,993 | 301,279 | — | 300 | ✅ 最新 |
| ravenclaw | 922 | 12,522 | — | 300 | ⚠️ 落后 4 个提交 |
| diteng-ui | 459 | 9,023 | — | 300 | ✅ 最新 |

> 数据过时了？在终端运行 `npx gitnexus analyze` 重新索引。

### 可用工具

| 工具 | 用途 |
|------|------|
| `query` | 按概念查执行流，找代码逻辑 |
| `context` | 360° 查看符号：哪里定义、哪里引用、参与哪些流程 |
| `impact` | 改一个符号会波及多大范围（1/2/3 层深度） |
| `detect_changes` | 当前改动会影响哪些文件/流程 |
| `rename` | 多文件协同重命名（带置信度） |
| `cypher` | 原始图查询 |
| `list_repos` | 查看所有已索引仓库 |

### 常用资源

- `gitnexus://repos` — 所有已索引仓库列表
- `gitnexus://repo/{name}/context` — 仓库统计与状态
- `gitnexus://repo/{name}/clusters` — 所有功能模块
- `gitnexus://repo/{name}/processes` — 所有执行流
- `gitnexus://repo/{name}/cluster/{clusterName}` — 模块详情
- `gitnexus://repo/{name}/process/{processName}` — 执行流追踪
- `gitnexus://group/{name}/contracts` — 跨仓库契约注册表
- `gitnexus://group/{name}/status` — 组索引状态

### 使用建议

- **改代码前**：先用 `context` 或 `impact` 摸清符号全貌，避免改漏
- **重构时**：用 `rename` 做多文件协同重命名
- **提交前**：用 `detect_changes` 确认改动影响范围
