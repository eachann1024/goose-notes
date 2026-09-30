import { expect, test } from "playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Electron 启动保留旧内置页 state 且不创建默认页", () => {
  const source = read("src/main.tsx");
  expect(source).not.toContain("localOnlyPages");
  expect(source).not.toContain("pages: localOnlyPages");
  expect(source).toContain(
    "usePages.setState({ activePageId: null, onboardingCompleted: true })",
  );
  expect(source).not.toContain("createOnboardingPages");
});

test("设置页为保留的旧内置页提供非破坏性 Markdown 导出", () => {
  const source = read(
    "src/pages/workspace/components/sidebar/SettingsLocalFolder.tsx",
  );
  expect(source).toContain("function LegacyInternalPagesExportCard()");
  expect(source).toContain("listLegacyInternalPages()");
  expect(source).toContain("blocksToMarkdown");
  expect(source).toContain("原始数据仍保留，未自动删除");
  expect(source).toContain("{isElectronHost && <LegacyInternalPagesExportCard />}");
});
