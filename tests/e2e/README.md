# E2E 执行方式

## 本地命令

- `bun run test:e2e:smoke`：跑编辑器冒烟（默认要求 `http://localhost:6001` 已启动）
- `bun run test:e2e`：跑全部 E2E

## 推荐测试时机（主流）

1. 日常 `feat/fix` 开发：本地先跑 `bun run test:e2e:smoke`，快速兜底核心链路。
2. 推送功能分支：GitHub Actions 自动跑 `E2E Smoke`（快速反馈）。
3. 提交 PR 到 `master`：GitHub Actions 自动跑 `E2E Full (PR)`，执行 `bun run test:e2e`。
4. 全量失败时先回看 `output/playwright/` 产物，再回到本地最小化复现。

## 说明

- 产物目录：`output/playwright/`（失败截图、视频、trace）。
- 当前用例文件：`tests/e2e/editor-smoke.spec.ts`。
- CI 内会使用 `E2E_AUTO_START=1` 自动拉起 `bun run dev`。
