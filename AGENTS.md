# 验证
- 每次任务完成后执行 `pnpm build`
- 项目仅生成 uTools 版本，查文档使用 content7
- 埋点关注维度：**功能级日活**（每个用户每天该功能的使用次数）


# 文件规模契约
1. 动工前声明目标文件当前行数及预估变化量
2. 任务完成后扫描涉及文件，超出动态阈值（300 × 0.1–3 倍，按职责复杂度判断）则询问确认后抽离

# 组件库
- UI 组件**优先使用 shadcn/ui**，有对应组件直接 `npx shadcn add`
- shadcn 无覆盖时查其他 npm 组件库，仍无则手写并说明原因

# 性能
- 新页面逐项评估：骨架屏（异步数据）、图片懒加载（列表/大图）、关键资源 preload（首屏字体/CSS），并说明是否采用及原因

# 规范
- 依赖安装必须使用最新版；新项目必须安装 code-inspector-plugin
- 配置项附简体中文注释（作用、可选值、副作用）
- 涉及 API Key 报错时，同时给出配置入口地址
- 输入框所有状态（默认/hover/focus/error）保持相同 border 宽度，禁止布局抖动
- 回车事件加 `isComposing` 判断，屏蔽 IME 组合输入
- disabled 控件：`cursor: not-allowed` + hover 无延迟 tooltip 说明原因

# CSS 初始化（新项目必须执行）
- 禁用浏览器默认 outline 及组件库 focus-visible ring
- 禁用系统 Tab 焦点行为
- `body` 添加 `user-select: none`（含前缀），禁止拖拽选中
