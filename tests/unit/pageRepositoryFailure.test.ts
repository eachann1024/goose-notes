import { expect, test } from "playwright/test";
import { saveInternalPage } from "../../src/lib/storage/pageRepository";
import { getRecoveryEntry } from "../../src/lib/storage/recoveryJournal";
import { usePages } from "../../src/stores/usePages";
import {
  clearElectronLocalStorageRuntime,
  installElectronLocalStorageRuntime,
} from "./electronLocalStorageRuntime";

test.beforeEach(() => clearElectronLocalStorageRuntime());
test.afterEach(() => {
  clearElectronLocalStorageRuntime();
  usePages.setState({ pages: {}, activePageId: null });
});

test("普通笔记 DB 连续写入失败时向上返回 false", () => {
  installElectronLocalStorageRuntime({ failPut: () => true });
  const now = Date.now();
  expect(
    saveInternalPage({
      id: "page-failed",
      workspaceId: "default",
      content: [{ type: "paragraph", content: "latest" }] as any,
      isFolder: false,
      createdAt: now,
      updatedAt: now,
    }),
  ).toBe(false);
});

test("普通笔记保存失败时内存保留最新内容且恢复日志不被误清", () => {
  installElectronLocalStorageRuntime({
    failPut: (id) => id.startsWith("gn:page:"),
  });
  const before = [{ type: "paragraph", content: "before" }] as any;
  const latest = [{ type: "paragraph", content: "latest" }] as any;
  const now = Date.now();
  usePages.setState({
    pages: {
      "page-store-failed": {
        id: "page-store-failed",
        workspaceId: "default",
        content: before,
        isFolder: false,
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  usePages.getState().updatePage("page-store-failed", { content: latest });

  expect(usePages.getState().pages["page-store-failed"].content).toEqual(latest);
  expect(getRecoveryEntry("internal-page", "page-store-failed")?.content).toEqual(
    latest,
  );
});
