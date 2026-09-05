import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

test("标签栏不展示写盘中间态", () => {
  const tabRail = readFileSync(
    new URL(
      "../../src/pages/workspace/components/page/TabRail.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  expect(tabRail).not.toContain('aria-label="未保存"');
  expect(tabRail).not.toContain("--goose-color-unsaved");
  expect(tabRail).not.toContain("dirtyLocalPageIds");
});

test("主界面和速记共用的手动保存成功时保持静默", () => {
  const bootstrap = readFileSync(
    new URL("../../src/main.tsx", import.meta.url),
    "utf8",
  );

  expect(bootstrap).not.toContain('toast.success("内容已保存"');
  expect(bootstrap).not.toContain('toast.success("已保存"');
  expect(bootstrap).toContain('toast.dismiss("goose-pending-writes-failed")');
  expect(bootstrap).toContain('toast.error("笔记未能保存到磁盘"');
});
