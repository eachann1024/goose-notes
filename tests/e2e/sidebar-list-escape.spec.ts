import { expect, test } from "playwright/test";

test("点击侧栏页面列表后按 Escape 收起其它文件夹并保持当前笔记可见", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__GOOSE_E2E__ = true;
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(
    () => (window as any).__GOOSE_TEST__?.getPagesState().hydrated,
  );

  const ids = await page.evaluate(async () => {
    const w = window as any;
    const { notebookId } = await w.__gooseTest.setupMockNotebook();
    const pages = w.__gooseTest.stores.usePages.getState().pages;
    const folder = Object.values(pages).find(
      (page: any) =>
        page.workspaceId === notebookId &&
        page.isFolder &&
        page.localFilePath === "/mock-notes/sub",
    ) as { id: string } | undefined;
    const nested = Object.values(pages).find(
      (page: any) =>
        page.workspaceId === notebookId &&
        !page.isFolder &&
        page.localFilePath === "/mock-notes/sub/nested.md",
    ) as { id: string } | undefined;
    if (!folder || !nested) throw new Error("Expected mock folder fixture");
    const { useSidebarView } = await import("/src/stores/useSidebarView.ts");
    useSidebarView
      .getState()
      .setExpanded(notebookId, [folder.id, "extra-folder"]);
    w.__GOOSE_TEST__.openPermanentTab(nested.id, true);
    return { notebookId, parentId: folder.id, childId: nested.id };
  });

  const nestedRow = page.locator(`[data-rct-item-id="${ids.childId}"]`).first();
  await expect(nestedRow).toBeVisible({ timeout: 15_000 });
  await nestedRow.click();
  await page.keyboard.press("Escape");

  await expect
    .poll(() =>
      page.evaluate(async (notebookId) => {
        const { useSidebarView } = await import(
          "/src/stores/useSidebarView.ts"
        );
        return useSidebarView.getState().expandedByNotebook[notebookId] ?? [];
      }, ids.notebookId),
    )
    .toEqual([ids.parentId]);
});

test("点编辑器后再按 Escape 不收起侧栏展开项", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__GOOSE_E2E__ = true;
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(
    () => (window as any).__GOOSE_TEST__?.getPagesState().hydrated,
  );

  const ids = await page.evaluate(async () => {
    const w = window as any;
    const { notebookId } = await w.__gooseTest.setupMockNotebook();
    const pages = w.__gooseTest.stores.usePages.getState();
    const parentId = pages.createPage(undefined, notebookId);
    const childId = pages.createPage(parentId, notebookId);
    const { useSidebarView } = await import("/src/stores/useSidebarView.ts");
    useSidebarView.getState().setExpanded(notebookId, [parentId]);
    w.__GOOSE_TEST__.openPermanentTab(childId, true);
    return { notebookId, parentId };
  });

  await page.waitForFunction(() => !!(window as any).__gooseNoteEditor);
  await page.locator(".bn-editor").click({ position: { x: 24, y: 24 } });
  await page.keyboard.press("Escape");

  await expect
    .poll(() =>
      page.evaluate(async (notebookId) => {
        const { useSidebarView } = await import(
          "/src/stores/useSidebarView.ts"
        );
        return useSidebarView.getState().expandedByNotebook[notebookId] ?? [];
      }, ids.notebookId),
    )
    .toEqual([ids.parentId]);
});

test("设置快捷键页列出收起侧栏全部展开项", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__GOOSE_E2E__ = true;
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(
    () => (window as any).__GOOSE_TEST__?.getPagesState().hydrated,
  );
  await page.evaluate(async () => {
    const w = window as any;
    const { notebookId } = await w.__gooseTest.setupMockNotebook();
    const id = w.__gooseTest.stores.usePages
      .getState()
      .createPage(undefined, notebookId);
    w.__GOOSE_TEST__.openPermanentTab(id, true);
  });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
  });
  await page.getByRole("button", { name: "快捷键" }).click();
  await expect(
    page.getByText("收起侧栏其它文件夹（当前选中笔记保持可见）"),
  ).toBeVisible();
});
