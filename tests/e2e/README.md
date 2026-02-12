# E2E 执行方式

## 本地命令

- `bun run test:e2e:smoke`：跑编辑器冒烟（要求 `http://localhost:6001` 已启动）
- `bun run test:e2e:smoke:auto`：自动拉起本地服务再跑（需要时使用）
- `bun run test:e2e:headed`：有界面观察执行过程
- `bun run test:e2e`：跑全部 E2E

## 推荐测试时机（主流）

1. AI 每次改完一个功能点：立刻跑 `test:e2e:smoke`（最快发现回归）。
2. 代码提交前：至少再跑一轮 `test:e2e:smoke`。
3. PR 阶段：CI 自动跑 `test:e2e:smoke`，失败阻断合并。
4. 夜间或定时：跑全量 `test:e2e`，覆盖更广场景。

## 说明

- 产物目录：`output/playwright/`（失败截图、视频、trace）。
- 当前用例文件：`tests/e2e/editor-smoke.spec.ts`。
