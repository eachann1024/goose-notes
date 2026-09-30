import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const testOutputDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "goose-electron-test-out-"),
);

export default defineConfig({
  testMatch: ["tests/electron/editor-disk-persistence.spec.ts"],
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  outputDir: testOutputDir,
  webServer: {
    command: "bun run vite --host 127.0.0.1 --port 6017 --strictPort",
    url: "http://127.0.0.1:6017",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
