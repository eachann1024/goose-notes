# 验证
- 任务完成后执行 `pnpm build`，但不用做e2e
- 项目仅生成 uTools 版本，查文档使用 content7
- 埋点关注维度：**功能级日活**（每个用户每天该功能的使用次数）

# 组件库
- UI 组件**优先使用 shadcn/ui**，有对应组件直接 `npx shadcn add`
- shadcn 无覆盖时查其他 npm 组件库，仍无则手写并说明原因
