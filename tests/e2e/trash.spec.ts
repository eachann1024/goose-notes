import { expect, test } from "playwright/test";
import {
  bootApp,
  createPageFromSidebar,
  moveCurrentPageToTrash,
  openTrash,
  writeNote,
} from "./helpers";

test.describe("垃圾箱流程", () => {
  test("页面可以移至垃圾箱", async ({ page }) => {
    const title = `E2E 垃圾箱 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "待删除正文");
    await moveCurrentPageToTrash(page);
    await openTrash(page);

    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("垃圾箱中的页面可以恢复", async ({ page }) => {
    const title = `E2E 恢复 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "恢复正文");
    await moveCurrentPageToTrash(page);
    await openTrash(page);

    await page.getByText(title).first().click();
    await page.locator("main > div").first().locator("button").first().click();

    await page.getByRole("button", { name: "页面", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `展开子页面 ${title}` }),
    ).toBeVisible();
  });

  test("垃圾箱中的页面可以永久删除", async ({ page }) => {
    const title = `E2E 永久删除 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "永久删除正文");
    await moveCurrentPageToTrash(page);
    await openTrash(page);

    await page.getByText(title).first().click();
    await page.locator("main > div").first().locator("button").nth(1).click();

    await page.getByRole("button", { name: "页面", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `展开子页面 ${title}` }),
    ).toHaveCount(0);
  });
});
