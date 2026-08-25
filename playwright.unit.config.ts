import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests/unit",
  // mcpBridge 用 bun:test 写，Playwright 的 ESM loader 加载不了，走 test:mcp。
  testIgnore: ["mcpBridge.test.ts"],
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
});
