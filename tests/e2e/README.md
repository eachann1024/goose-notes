# E2E 执行方式

## 本地命令

- `bun run test:e2e:smoke`：跑编辑器冒烟（要求 `http://localhost:6001` 已启动）
- `bun run test:e2e:smoke:auto`：自动拉起本地服务再跑（推荐）
- `bun run test:e2e:headed`：有界面观察执行过程
- `bun run test:e2e`：跑全部 E2E

## 推荐测试时机（主流）

1. 日常 `feat/fix` 开发：本地先跑 `bun run test:e2e:smoke` 或 `bun run test:e2e:smoke:auto`，快速兜底核心链路。
2. 推送功能分支：GitHub Actions 自动跑 `E2E Smoke`（快速反馈）。
3. 提交 PR 到 `master`：GitHub Actions 自动跑 `E2E Full (PR)`，执行 `bun run test:e2e`。
4. 全量失败时先回看 `output/playwright/` 产物，再回到本地最小化复现。

## 说明

- 产物目录：`output/playwright/`（失败截图、视频、trace）。
- 当前用例文件：`tests/e2e/editor-smoke.spec.ts`。
- CI 内会使用自动拉起服务方式执行 E2E。
