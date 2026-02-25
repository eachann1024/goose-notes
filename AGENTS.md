## 目标与优先级

1. 先保证正确性，再保证体验与代码整洁。
2. 需求不清时先澄清核心流程，再开发；同时给出可执行建议方案。
3. 优先做可维护的抽象与架构边界，不在业务细节上过度展开。

---

## 技术栈（强约束）

**必须**: React 18 + Vite, @tiptap/react, shadcn/ui, TailwindCSS, zustand, unplugin-auto-import

---

## 开发硬约束

1. 组件建议 ≤300 行（Sidebar/Editor 可放宽）。
2. 开发与调试使用 `bun dev` / `bun dev:tauri`。
3. 全局状态使用 zustand，局部状态使用 `useState`。
4. 注释只解释 Why，不解释 What。
5. 每个模块保持独立，避免跨模块隐式耦合。
6. 项目功能需兼容 tauri 与 utools。
7. 项目不要求 build（除非用户明确要求）。

---

## Import 与组件规范

1. 项目已启用 auto-import，默认不手写本地模块 import。
2. 仅允许以下 import：
- `node_modules` 第三方包；
- 图标相关 import。
3. 所有交互控件优先使用 `shadcn/ui` 现有组件，不手写“伪 shadcn”组件。
4. 若缺失控件，先补充或引入官方 shadcn/ui 组件后再实现交互。

---

## 运行与端口规范

1. 启动 dev 服务前，先检查 `6001` 端口是否已在运行。
2. 若已运行，复用现有服务；若未运行，再由 AI 启动服务。
3. 不把“请用户自己启动项目”作为默认路径。

## 欢迎页定义

1. 欢迎页 = “开始页面”，提供搜索、打开本地文件夹、新建页面等入口。
2. 欢迎页不是空白页。
3. 初始页路径：`src/pages/workspace/components/page/PageEmptyState.tsx`。
