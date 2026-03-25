import { expect, test } from "playwright/test";
import {
  bootApp,
  createPageFromSidebar,
  writeNote,
} from "./helpers";

async function moveCurrentPageToTrash(page: import("playwright/test").Page) {
  await page.evaluate(async () => {
    const { usePages } = await import("/src/stores/usePages.ts");
    const activePageId = usePages.getState().activePageId;
    if (!activePageId) return;
    await usePages.getState().deletePage(activePageId);
  });
}

async function getActivePageId(page: import("playwright/test").Page) {
  return page.evaluate(async () => {
    const { usePages } = await import("/src/stores/usePages.ts");
    return usePages.getState().activePageId;
  });
}

async function restorePageById(page: import("playwright/test").Page, pageId: string) {
  await page.evaluate(async (targetPageId) => {
    const { usePages } = await import("/src/stores/usePages.ts");
    usePages.getState().restorePage(targetPageId);
  }, pageId);
}

async function permanentlyDeletePageById(page: import("playwright/test").Page, pageId: string) {
  await page.evaluate(async (targetPageId) => {
    const { usePages } = await import("/src/stores/usePages.ts");
    await usePages.getState().permanentlyDeletePage(targetPageId);
  }, pageId);
}

async function getPageTrashState(page: import("playwright/test").Page, pageId: string) {
  return page.evaluate(async (targetPageId) => {
    const { usePages } = await import("/src/stores/usePages.ts");
    const target = usePages.getState().pages[targetPageId];
    return {
      exists: Boolean(target),
      trashed: Boolean(target?.trashedAt),
    };
  }, pageId);
}

test.describe("垃圾箱流程", () => {
  test("页面可以移至垃圾箱", async ({ page }) => {
    const title = `E2E 垃圾箱 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "待删除正文");
    const pageId = await getActivePageId(page);
    expect(pageId).toBeTruthy();
    await moveCurrentPageToTrash(page);

    await expect.poll(() => getPageTrashState(page, pageId!)).toMatchObject({
      exists: true,
      trashed: true,
    });
  });

  test("垃圾箱中的页面可以恢复", async ({ page }) => {
    const title = `E2E 恢复 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "恢复正文");
    const pageId = await getActivePageId(page);
    expect(pageId).toBeTruthy();
    await moveCurrentPageToTrash(page);
    await restorePageById(page, pageId!);

    await expect.poll(() => getPageTrashState(page, pageId!)).toMatchObject({
      exists: true,
      trashed: false,
    });
  });

  test("垃圾箱中的页面可以永久删除", async ({ page }) => {
    const title = `E2E 永久删除 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "永久删除正文");
    const pageId = await getActivePageId(page);
    expect(pageId).toBeTruthy();
    await moveCurrentPageToTrash(page);
    await permanentlyDeletePageById(page, pageId!);

    await expect.poll(() => getPageTrashState(page, pageId!)).toMatchObject({
      exists: false,
      trashed: false,
    });
  });
});
