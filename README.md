# 鹅的笔记 · goose-note

[![CI](https://github.com/eachann1024/goose-notes/actions/workflows/ci.yml/badge.svg)](https://github.com/eachann1024/goose-notes/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A local-first, Notion-style note-taking app — built as a [uTools](https://u.tools/) plugin, also runnable in the browser.

本地优先的 Notion 风格笔记应用，基于 [BlockNote](https://www.blocknotejs.org/) 块编辑器构建，内置 AI 能力，可作为 uTools 插件运行，也支持浏览器端使用。

## ✨ 特性

- **块编辑器**：基于 BlockNote 的所见即所得编辑，支持标题、列表、折叠块、代码块等
- **本地优先**：笔记存储在本地，支持挂载本地文件夹作为记事本
- **AI 能力**：集成 AI SDK（Anthropic / OpenAI-compatible），支持续写、改写、问答
- **快速速记**：独立的速记小窗（鹅的小窗），随手记录、一键入库
- **全局搜索**：跨记事本搜索标题与正文，跳转即定位
- **深色模式**：完整的明暗主题适配

## 🛠 技术栈

- **编辑器**：BlockNote（ProseMirror）+ Tiptap 扩展
- **框架**：React + TypeScript + Vite
- **状态管理**：Zustand
- **UI**：Radix UI + HeroUI + Tailwind CSS
- **AI**：Vercel AI SDK
- **宿主**：uTools（可选）/ 浏览器

## 🚀 本地开发

```bash
# 安装依赖（推荐 bun）
bun install

# 启动开发服务器（http://localhost:6001）
bun run dev

# 构建（产出 uTools 插件包）
bun run build
```

## 📦 构建产物

`bun run build` 会执行 `tsc` 类型检查 + `vite build` + uTools 打包脚本，产出可加载到 uTools 的插件包。

提交前请确保以下检查通过（CI 也会跑这些）：

```bash
bun run typecheck   # tsc -b --noEmit
bun run lint        # eslint .
bun run build
```

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解开发流程与规范，并遵守
[行为准则](./CODE_OF_CONDUCT.md)。报告安全问题请参阅 [SECURITY.md](./SECURITY.md)。

## 📄 许可证

[MIT](./LICENSE) © eachann
