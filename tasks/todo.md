# Todo

## 需求

- [x] 将 `/code` 插入的代码块默认语言改为 `Markdown`

## 计划

- [x] 定位 `/code` 命令实现与代码块语言赋值点
- [x] 修改 `/code` 命令默认语言为 `markdown`
- [x] 执行最小验证（改动相关检索 + 一条人工验证路径）
- [x] 记录 review 结论

## 过程记录

- 已确认最小改动点：`src/pages/workspace/components/command/commandItems.ts` 中“代码块”命令。
- 已完成改动：`toggleCodeBlock()` -> `toggleCodeBlock({ language: "markdown" })`。

## Review

- `bunx tsc --noEmit -p tsconfig.app.json`：通过。
- `bun run lint src/pages/workspace/components/command/commandItems.ts`：通过（仓库存在历史 warning，0 error）。
- `bun run test:e2e -- --grep "代码块语言切换在顶部工具栏仍可用"`：通过（1 passed）。
- 人工验证路径：
  1. `bun dev` 启动后进入编辑器。
  2. 输入 `/code` 并回车插入代码块。
  3. 观察代码块顶部语言标签应默认为 `Markdown`。
