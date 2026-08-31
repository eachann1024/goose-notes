# 范围

- 常规笔记本编辑器。速记小窗不走这里。
- 不换 BlockNote。卡顿先查宿主订阅和重块，不迁 Tiptap / Lexical。

# 热路径

- 保存：`src/components/editor/core/Editor.tsx` 停笔后 800ms 防抖写入 `usePages`。连续打字期间不写 store，所以打字延迟与 `pages` 订阅无关，别往那边查。
- 侧栏：`SidebarMainTree` 用 `areSidebarPagesEqual`，不要订整个 `pages` 引用。
- 打开附件、图片、本地文件：只走 `openResourceExternally`。`fileStorage.open` 是 `att-file:` 包装。
- Toast：`src/components/ui/sonner.tsx` + `src/styles/goose-toast.css`。主窗靠右。不要给 toast 写 `position: relative`。

# 两个已经咬过人的坑

- zustand 是 v5，`usePages(selector, equalityFn)` 的第二个参数会被**静默忽略**。要 equalityFn 就用 `zustand/traditional` 的 `useStoreWithEqualityFn(usePages, selector, equalityFn)`。照抄仓库里的旧写法会写出不生效的"优化"。
- `att-file:` 和 `att-video:` 都以 `att` 开头，但**不匹配** `startsWith("att:")`。凡是判断"是不是内部引用"的地方，漏掉这两个前缀就会把附件当外部 URL 或本地路径处理，导出和资产清理都会出错。

# 自定义块

- `createReactBlockSpec` 里不要挂 API、Shiki 多实例或重 React 树。
- 非聚焦的 code / file / image 用轻量视图。

# 巨型文件

- 下面这些先别顺手大拆，单开任务再拆：`codeBlockSpec.tsx`、`Editor.tsx`。
- 已拆：`AiComposerInput.tsx`（组装留主文件，逻辑在同目录 `composer*.ts` / `useComposer*.ts`）、`editor-base.css`（入口只有 `@import`，规则在 `styles/editor-base/`，改样式先定位子文件）。
