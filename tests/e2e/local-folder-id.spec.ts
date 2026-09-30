import { expect, test, type Page } from "playwright/test";

type LocalPageInfo = {
  id: string;
  workspaceId: string;
  isFolder?: boolean;
  localFilePath?: string;
  content?: unknown;
};

type PagesState = {
  pages: Record<string, LocalPageInfo>;
  activePageId: string | null;
  createLocalPage: (
    parentId?: string,
    workspaceId?: string,
  ) => Promise<string | null>;
  renameLocalPageFile: (pageId: string, newBaseName: string) => Promise<string>;
  saveLocalPageContent: (pageId: string, content: unknown) => Promise<boolean>;
};

type TabsState = {
  openTabs: Array<{ pageId: string; preview?: boolean; pinned?: boolean }>;
  activeTabId: string | null;
  openPreviewTab: (pageId: string) => void;
};

type LocalHarness = {
  setupMockNotebook: () => Promise<{ notebookId: string }>;
  readMockFile: (path: string) => string | null;
  stores: {
    usePages: {
      getState: () => PagesState;
      setState: (
        partial:
          | Partial<PagesState>
          | ((state: PagesState) => Partial<PagesState>),
      ) => void;
    };
    useTabs: {
      getState: () => TabsState;
      setState: (partial: Partial<TabsState>) => void;
    };
  };
};

type LocalHarnessWindow = Window & {
  __GOOSE_E2E__?: boolean;
  __gooseTest?: LocalHarness;
};

async function waitForLocalHarness(page: Page) {
  await page.waitForFunction(() => {
    const harness = (window as LocalHarnessWindow).__gooseTest;
    return Boolean(harness?.stores?.usePages);
  });
}

test.describe("local folder stable page ids", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as LocalHarnessWindow).__GOOSE_E2E__ = true;
      window.localStorage.setItem(
        "goose-note-settings",
        JSON.stringify({ state: {}, version: 0 }),
      );
    });
    await page.goto("/?e2eLocalMock");
    await waitForLocalHarness(page);
  });

  test("sidebar renames folders and files without changing IDs or file contents", async ({ page }) => {
    const before = await page.evaluate(async () => {
      const h = (window as LocalHarnessWindow).__gooseTest!;
      const { notebookId } = await h.setupMockNotebook();
      const pages = Object.values(h.stores.usePages.getState().pages);
      const folder = pages.find(p => p.workspaceId === notebookId && p.localFilePath === "/mock-notes/sub")!;
      const child = pages.find(p => p.workspaceId === notebookId && p.localFilePath === "/mock-notes/sub/nested.md")!;
      h.stores.useTabs.getState().openPreviewTab(child.id);
      return { folderId: folder.id, childId: child.id, content: h.readMockFile(child.localFilePath!) };
    });
    const rename = async (label: string, name: string) => {
      await page.locator(`.main-tree-row [aria-label="${label}"]`).click({ button: "right" });
      await page.getByRole("menuitem", { name: "重命名", exact: true }).click();
      await page.getByRole("textbox", { name: "新名称", exact: true }).fill(name);
      await page.getByRole("button", { name: "确认", exact: true }).click();
    };
    await rename("sub", "资料.md");
    await expect(page.locator('.main-tree-row [aria-label="资料.md"]')).toBeVisible();
    await rename("nested", "改名文件");
    await expect(page.locator('.main-tree-row [aria-label="改名文件"]')).toBeVisible();
    const after = await page.evaluate(({ folderId, childId }) => {
      const h = (window as LocalHarnessWindow).__gooseTest!;
      const state = h.stores.usePages.getState();
      return {
        folderPath: state.pages[folderId].localFilePath,
        childPath: state.pages[childId].localFilePath,
        content: h.readMockFile("/mock-notes/资料.md/改名文件.md"),
        old: h.readMockFile("/mock-notes/sub/nested.md"),
        tabOpen: h.stores.useTabs.getState().openTabs.some(t => t.pageId === childId),
      };
    }, before);
    expect(after).toEqual({ folderPath: "/mock-notes/资料.md", childPath: "/mock-notes/资料.md/改名文件.md", content: before.content, old: null, tabOpen: true });
    const failures = await page.evaluate(async ({ folderId }) => {
      const h = (window as LocalHarnessWindow).__gooseTest!;
      const state = h.stores.usePages.getState();
      const errors: string[] = [];
      for (const name of ["../escape", "plain.md"]) {
        try { await state.renameLocalPageFile(folderId, name); }
        catch (error) { errors.push(String(error)); }
      }
      return errors;
    }, before);
    expect(failures).toHaveLength(2);
  });

  test("expanding a local folder preserves the open child and does not create a folder tab", async ({
    page,
  }) => {
    const { folderId, nestedFileId } = await page.evaluate(async () => {
      const harness = (window as LocalHarnessWindow).__gooseTest;
      if (!harness) throw new Error("Local folder harness unavailable");

      const { notebookId } = await harness.setupMockNotebook();
      harness.stores.useTabs.setState({ openTabs: [], activeTabId: null });
      harness.stores.usePages.setState({ activePageId: null });

      const pages = harness.stores.usePages.getState().pages;
      const folder = Object.values(pages).find(
        (page) =>
          page.workspaceId === notebookId &&
          page.isFolder &&
          page.localFilePath === "/mock-notes/sub",
      );
      const nestedFile = Object.values(pages).find(
        (page) =>
          page.workspaceId === notebookId &&
          !page.isFolder &&
          page.localFilePath === "/mock-notes/sub/nested.md",
      );
      if (!folder || !nestedFile) {
        throw new Error("Expected mock folder fixture not found");
      }

      harness.stores.useTabs.getState().openPreviewTab(nestedFile.id);

      return { folderId: folder.id, nestedFileId: nestedFile.id };
    });

    const folderRow = page.locator(`[data-rct-item-id="${folderId}"]`).first();
    const nestedFileRow = page.locator(`[data-rct-item-id="${nestedFileId}"]`);
    const folderDisclosure = folderRow
      .locator("..")
      .getByRole("button", { name: "折叠子项" })
      .first();

    await expect(folderRow).toBeVisible({ timeout: 15_000 });
    await expect(nestedFileRow).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const harness = (window as LocalHarnessWindow).__gooseTest;
          return harness?.stores.usePages.getState().activePageId;
        }),
      )
      .toBe(nestedFileId);

    // 展开控件只改变层级可见性，不承担导航；先折叠，构造“子项仍为活动页”的场景。
    await folderDisclosure.click();
    await expect(nestedFileRow).toBeHidden();
    expect(
      await page.evaluate(() => {
        const harness = (window as LocalHarnessWindow).__gooseTest;
        return harness?.stores.usePages.getState().activePageId;
      }),
    ).toBe(nestedFileId);

    // Electron 本地文件夹只控制展开，不作为页面打开。
    await folderRow.click({ position: { x: 100, y: 14 } });
    await expect(nestedFileRow).toBeVisible();
    const afterExpand = await page.evaluate(() => {
      const harness = (window as LocalHarnessWindow).__gooseTest;
      if (!harness) throw new Error("Local folder harness unavailable");
      return {
        activePageId: harness.stores.usePages.getState().activePageId,
        tabs: harness.stores.useTabs.getState().openTabs,
      };
    });
    expect(afterExpand.activePageId).toBe(nestedFileId);
    expect(afterExpand.tabs.some((tab) => tab.pageId === folderId)).toBe(false);
    expect(afterExpand.tabs.some((tab) => tab.pageId === nestedFileId)).toBe(true);

    await folderRow.click({ position: { x: 100, y: 14 } });
    await expect(nestedFileRow).toBeHidden();
    const afterCollapse = await page.evaluate(() => {
      const harness = (window as LocalHarnessWindow).__gooseTest;
      return harness?.stores.usePages.getState().activePageId;
    });
    expect(afterCollapse).toBe(nestedFileId);
  });

  test("recreating 未命名 after renaming it keeps both files in the page list", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = (window as LocalHarnessWindow).__gooseTest;
      if (!harness) throw new Error("Local folder harness unavailable");

      const { notebookId } = await harness.setupMockNotebook();
      const pagesStore = harness.stores.usePages.getState();

      const firstId = await pagesStore.createLocalPage(undefined, notebookId);
      if (!firstId) throw new Error("Failed to create first local page");

      await pagesStore.renameLocalPageFile(firstId, "Renamed Page");

      const secondId = await pagesStore.createLocalPage(undefined, notebookId);
      if (!secondId) throw new Error("Failed to create second local page");

      const state = harness.stores.usePages.getState();
      const localPages = Object.values(state.pages)
        .filter((page) => page.workspaceId === notebookId && !page.isFolder)
        .map((page) => ({
          id: page.id,
          localFilePath: page.localFilePath,
        }));

      return {
        firstId,
        secondId,
        firstPath: state.pages[firstId]?.localFilePath,
        secondPath: state.pages[secondId]?.localFilePath,
        localPages,
        renamedFile: harness.readMockFile("/mock-notes/Renamed Page.md"),
        newFile: harness.readMockFile("/mock-notes/未命名.md"),
      };
    });

    expect(result.secondId).not.toBe(result.firstId);
    expect(result.firstPath).toBe("/mock-notes/Renamed Page.md");
    expect(result.secondPath).toBe("/mock-notes/未命名.md");
    expect(result.renamedFile).not.toBeNull();
    expect(result.newFile).not.toBeNull();
    expect(result.localPages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.firstId,
          localFilePath: "/mock-notes/Renamed Page.md",
        }),
        expect.objectContaining({
          id: result.secondId,
          localFilePath: "/mock-notes/未命名.md",
        }),
      ]),
    );
  });

  test("saving is rejected when two pages point at the same local file", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = (window as LocalHarnessWindow).__gooseTest;
      if (!harness) throw new Error("Local folder harness unavailable");

      const { notebookId } = await harness.setupMockNotebook();
      const pagesStore = harness.stores.usePages.getState();

      const firstId = await pagesStore.createLocalPage(undefined, notebookId);
      if (!firstId) throw new Error("Failed to create first local page");
      await pagesStore.renameLocalPageFile(firstId, "Collision Target");

      const secondId = await pagesStore.createLocalPage(undefined, notebookId);
      if (!secondId) throw new Error("Failed to create second local page");

      const targetPath = "/mock-notes/Collision Target.md";
      const before = harness.readMockFile(targetPath);

      harness.stores.usePages.setState((state) => ({
        pages: {
          ...state.pages,
          [secondId]: {
            ...state.pages[secondId],
            localFilePath: targetPath,
          },
        },
      }));

      const ok = await harness.stores.usePages
        .getState()
        .saveLocalPageContent(secondId, [
          { type: "paragraph", content: "This must not be written." },
        ]);

      return {
        ok,
        before,
        after: harness.readMockFile(targetPath),
      };
    });

    expect(result.ok).toBe(false);
    expect(result.after).toBe(result.before);
  });

  test("renaming to an already tracked local filename auto-suffixes", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const harness = (window as LocalHarnessWindow).__gooseTest;
      if (!harness) throw new Error("Local folder harness unavailable");

      const { notebookId } = await harness.setupMockNotebook();
      const pagesStore = harness.stores.usePages.getState();

      const firstId = await pagesStore.createLocalPage(undefined, notebookId);
      if (!firstId) throw new Error("Failed to create first local page");
      await pagesStore.renameLocalPageFile(firstId, "Collision Target");

      const secondId = await pagesStore.createLocalPage(undefined, notebookId);
      if (!secondId) throw new Error("Failed to create second local page");

      let errorMessage = "";
      try {
        await harness.stores.usePages
          .getState()
          .renameLocalPageFile(secondId, "Collision Target");
      } catch (error) {
        errorMessage = (error as Error).message;
      }

      return {
        errorMessage,
        firstPath:
          harness.stores.usePages.getState().pages[firstId]?.localFilePath,
        secondPathAfter:
          harness.stores.usePages.getState().pages[secondId]?.localFilePath,
      };
    });

    expect(result.errorMessage).toBe("");
    expect(result.firstPath).toBe("/mock-notes/Collision Target.md");
    expect(result.secondPathAfter).toBe(
      "/mock-notes/Collision Target (1).md",
    );
  });
});
