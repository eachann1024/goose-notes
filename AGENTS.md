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
├── lib/                   # 工具库（内容序列化、导出、AI）
└── hooks/                 # 自定义 hooks
```

## 任务路由

1. 架构与方案设计由主会话（Fable）亲自做，不下放。
2. 代码实现 / 重构 / 写测试派 sonnet 子代理（`.claude/agents/sonnet-coder.md`）；文件定位 / 代码扫描 / grep 类检索派 haiku 子代理（`.claude/agents/haiku-scout.md`）。
3. 只有相互独立的任务才并行拆分，串行依赖的合并到同一个子代理。
4. 子代理一律只返回精炼总结（结论 / 涉及文件 / 风险点，≤10 行），禁止把原始文件内容回灌主会话。
5. 子代理模型由 agent 定义文件的 `model` frontmatter 锁定，不依赖对话临时指定。

## 验证

- 代码修改后立即执行 `pnpm build`，看到 `✓ built` 才算通过
- 不做 e2e
- 查文档使用 context7
- 浏览器验证时可以 bun dev访问

## 组件库

- UI 组件优先使用 shadcn/ui，无覆盖时查 npm 组件库，仍无则手写

## 编辑器红线

- **标题一是特殊存在，任何编辑器改造都不应影响它**：恒为物理首块、恒为 H1、上方不可前置任何块、自身不可被推到下面。改任何编辑器交互（回车/删除/转块/粘贴/拖拽）前先确认不破坏这三条约束。守卫见 `src/components/editor/inputrules/firstTitleGuard.ts`。

## uTools 内核兼容红线（颜色失效/深色白块）

- **症状**：深色模式 hover / 选中态出现**刺眼白块**，或某个颜色 **dev 里正常、真机上根本没生效**。浏览器 dev 全不复现，只在 uTools 真机暴露——改配色后别只信 dev 截图，要 grep 排雷。
- **真凶三类，按常见度排**：
  1. **写死的字面色 `hover:bg-white` / `bg-white` / `bg-black`**（最常见、最直白）。深色下纯白必然刺眼，跟内核无关，纯属深色没适配。
  2. **Tailwind 的 `/透明度` 色**（`bg-x/15`、`text-x/70`、`border-x/40`、`hsl(var(--token)/a)`）。uTools 旧内核解析这类透明度（编译成 `color-mix`/`oklch`）失败 → 回退异常实色：浅色 token（`muted-foreground`）→ 亮白块；`foreground` → 纯黑「黑块吞字」。
  3. **Tailwind v4 的任何调色板色**（`text-red-500`、`bg-amber-400` 等，**不带透明度也中招**）。v4 调色板编译产物是 `oklch(...)` 字面量，旧内核解析不了 → 整条 color 声明作废，症状是「颜色悄悄没生效」（dev 全红、真机纹丝不动）。
- **替代做法**：hover / selected / 半透明 / 强调色一律用 `src/index.css` 预定义的**实色变量**，禁裸 `bg-white`/`bg-black`、禁 `/alpha`、禁裸调色板色：
  - hover → `bg-[var(--goose-interactive-hover)]`（深色 `hsl(0 0% 17%)`）；选中 → `bg-[var(--goose-interactive-selected)]`；文字 → `text-[hsl(var(--foreground))]`。
  - 强调色 → 在 `src/index.css` 定义 **hex 语义变量**（如 `--goose-pin-accent: #ef4444` / 深色 `#f87171`），用 `text-[var(--goose-pin-accent)]`；改完 grep dist 产物确认该链路无 oklch。
  - 浅色态可保留 `/alpha`，**深色态必须 `dark:` 覆盖成实色变量**。
- **排雷 grep**（改配色后跑）：`grep -rn "hover:bg-white\|hover:bg-black\|hover:bg-[a-z-]*/[0-9]\|text-red-\|bg-red-\|fill-red-\|text-amber-\|bg-amber-" src/`
- 另注：`--accent` / `--border` 等 token 必须存成可被 `hsl()` 包裹的裸值，不能存已解析的 `oklch()`（详见 `src/index.css` 顶部注释与 memory `utools-no-tailwind-foreground-alpha`）。

## AI 调试端点

本地调试 AI 功能时使用以下配置：

- **Base URL**：`http://localhost:20128/v1`
- **API Key**：任意字符串（如 `dev`）
- **可用模型**：`loop`、`low`
