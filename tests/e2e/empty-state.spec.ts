import { expect, test } from "playwright/test";
import { bootApp, createPageFromSidebar } from "./helpers";

test.describe("启动与创建流程", () => {
  test("首次进入显示新手引导页", async ({ page }) => {
    await bootApp(page);

    await expect(page.getByText("第一次使用，建议先做这 4 步")).toBeVisible();
    await expect(page.locator('button[aria-label="新建页面"]')).toBeVisible();
  });

  test("可以从侧边栏创建页面", async ({ page }) => {
    await bootApp(page);
    await createPageFromSidebar(page);

    await expect(page.locator(".ProseMirror h1").first()).toBeVisible();
  });
});
