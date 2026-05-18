# Goose Note — AGENTS.md
## 项目概览

- **定位**：uTools 插件版笔记应用
- **技术栈**：React 19 + TypeScript + Vite + BlockNote 编辑器 + Zustand + Tailwind CSS + shadcn/ui
- **构建**：`pnpm build`（tsc + vite build + utools-build 脚本）
- **开发**：`pnpm dev`（端口 6001）

## 核心架构

```
src/
├── pages/workspace/       # 主编辑区（编辑器 + 侧栏 + 大纲）
├── stores/                # Zustand stores（usePages / useNotebooks / useSettings / useTabs）
├── lib/                   # 工具库（内容序列化、导出、AI、埋点）
└── hooks/                 # 自定义 hooks
```

## 验证

- 代码修改后立即执行 `pnpm build`，看到 `✓ built` 才算通过
- 不做 e2e
- 查文档使用 context7
- 浏览器验证时可以 bun dev访问

## 组件库

- UI 组件优先使用 shadcn/ui，无覆盖时查 npm 组件库，仍无则手写
