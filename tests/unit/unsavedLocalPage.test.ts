import { expect, test } from "playwright/test";
import { createEmptyLocalPageContent } from "../../src/components/editor/utils/blocknote-content";
import { assignExistingStableId } from "../../src/lib/local-page-idmap";
import {
  isUnsavedLocalPage,
  localPageHasPersistableContent,
} from "../../src/lib/unsavedLocalPage";
import type { Page } from "../../src/types";

test("空段落不算可落盘内容", () => {
  expect(localPageHasPersistableContent(createEmptyLocalPageContent())).toBe(
    false,
  );
  expect(localPageHasPersistableContent([])).toBe(false);
  expect(localPageHasPersistableContent(null)).toBe(false);
});

test("有文字或非空块才算可落盘", () => {
  expect(
    localPageHasPersistableContent([
      { type: "paragraph", content: "hello" },
    ]),
  ).toBe(true);
  expect(
    localPageHasPersistableContent([
      { type: "image", props: { url: "att:1" } },
    ]),
  ).toBe(true);
});

test("未落盘本地页判定", () => {
  const page: Page = {
    id: "p1",
    workspaceId: "nb",
    content: createEmptyLocalPageContent(),
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    localUnsaved: true,
  };
  expect(isUnsavedLocalPage(page)).toBe(true);
  expect(isUnsavedLocalPage({ ...page, localFilePath: "/a.md" })).toBe(false);
  expect(isUnsavedLocalPage({ ...page, localUnsaved: undefined })).toBe(false);
});

test("把已有 id 绑到相对路径", () => {
  const map: Record<string, string> = {};
  const first = assignExistingStableId("nb", "未命名.md", "keep-me", map);
  expect(first.dirty).toBe(true);
  expect(map["未命名.md"]).toBe("keep-me");
  expect(assignExistingStableId("nb", "未命名.md", "keep-me", map).dirty).toBe(
    false,
  );
  expect(
    assignExistingStableId("nb", "未命名.md", "other", map).dirty,
  ).toBe(false);
  expect(map["未命名.md"]).toBe("keep-me");
});
