import { expect, test } from "playwright/test";
import { bootApp, createPageFromSidebar, writeNote } from "./helpers";

test.describe("编辑流程", () => {
  test("编辑标题后侧边栏与标签同步更新", async ({ page }) => {
    const title = `E2E 标题同步 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, "标题同步正文");

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator(`[title="${title}"]`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: `展开子页面 ${title}` }),
    ).toBeVisible();
  });

  test("编辑正文后刷新仍能保留内容", async ({ page }) => {
    const title = `E2E 持久化 ${Date.now()}`;
    const body = `正文持久化校验 ${Date.now()}`;

    await bootApp(page);
    await createPageFromSidebar(page);
    await writeNote(page, title, body);

    await page.reload();
    await page.getByRole("button", { name: `展开子页面 ${title}` }).click();

    await expect(page.locator(".ProseMirror").first()).toContainText(title);
    await expect(page.locator(".ProseMirror").first()).toContainText(body);
  });

  test("输入斜杠后退格可删除斜杠字符", async ({ page }) => {
    await bootApp(page);
    await createPageFromSidebar(page);

    // 点击正文区域并定位到空段落
    const editor = page.locator(".ProseMirror");
    await editor.click();
    // 移到标题后，另起一行
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    // 输入斜杠，菜单应出现
    await page.keyboard.type("/");
    await expect(page.locator(".slash-command-capsule")).toBeVisible();
    // 退格删除斜杠，菜单应消失
    await page.keyboard.press("Backspace");
    await expect(page.locator(".slash-command-capsule")).not.toBeVisible();
  });
});
