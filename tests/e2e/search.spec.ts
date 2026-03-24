import { expect, test } from "playwright/test";
import { bootApp, createPageFromSidebar, getSearchInput, openSearch, writeNote } from "./helpers";

test.describe("搜索流程", () => {
  test("正文关键词可以被搜索命中", async ({ page }) => {
    const title = `E2E 搜索标题 ${Date.now()}`;
    const keyword = `搜索关键词 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, keyword);
    await openSearch(page);

    await getSearchInput(page).fill(keyword);

    await expect(page.getByText(title).first()).toBeVisible();
  });
});
