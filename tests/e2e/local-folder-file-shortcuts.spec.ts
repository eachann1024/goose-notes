import { expect, test } from "playwright/test";

test("本地文件右键菜单显示打开与复制路径的默认快捷键", async ({ page }) => {
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
    const nested = Object.values(pages).find(
      (item: any) =>
        item.workspaceId === notebookId &&
        !item.isFolder &&
        item.localFilePath === "/mock-notes/sub/nested.md",
    ) as { id: string } | undefined;
    if (!nested) throw new Error("Expected mock local file");
    w.__GOOSE_TEST__.openPermanentTab(nested.id, true);
    return { childId: nested.id };
  });

  const nestedRow = page.locator(`[data-rct-item-id="${ids.childId}"]`).first();
  await expect(nestedRow).toBeVisible({ timeout: 15_000 });
  await nestedRow.click({ button: "right" });

  const newFileItem = page
    .getByRole("menuitem")
    .filter({ hasText: /新建文件(?!夹)/ });
  await expect(newFileItem).toBeVisible();
  await expect(newFileItem).toContainText(/⌘N|Ctrl \+ N/);

  const copyItem = page.getByRole("menuitem").filter({ hasText: "复制文件路径" });
  await expect(copyItem).toBeVisible();
  await expect(copyItem).toContainText(/⌘⇧C|Ctrl \+ Shift \+ C/);

  const finderItem = page.getByRole("menuitem").filter({
    hasText: /在访达中显示|在资源管理器中显示|在文件管理器中显示/,
  });
  await expect(finderItem).toBeVisible();
  await expect(finderItem).toContainText(/⌘⇧F|Ctrl \+ Shift \+ F/);

  const editorItem = page
    .getByRole("menuitem")
    .filter({ hasText: "用系统默认打开" });
  await expect(editorItem).toBeVisible();
  await expect(editorItem).toContainText(/⌘⇧A|Ctrl \+ Shift \+ A/);

  const terminalItem = page
    .getByRole("menuitem")
    .filter({ hasText: "在终端中打开" });
  await expect(terminalItem).toBeVisible();
  await expect(terminalItem).toContainText(/⌃`|Ctrl \+ `/);
});
