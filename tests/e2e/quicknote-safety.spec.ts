import { expect, test } from "playwright/test";

async function openCleanQuickNote(page: import("playwright/test").Page) {
  await page.goto("/quicknote.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("radio", { name: "便签 1，空白" })).toBeChecked();
}

test.describe("quick-note draft safety", () => {
  test("keeps immediate edits across slot changes, undo, popovers, and reload", async ({
    page,
  }) => {
    await openCleanQuickNote(page);

    const editor = page.getByRole("textbox").first();
    await editor.click();
    await editor.pressSequentially("速记切换不会丢失");

    // 不等待编辑器 debounce，立即切换并切回；最新输入必须同步提交。
    await page.keyboard.press("Control+2");
    await expect(
      page.getByRole("radio", { name: "便签 1，有内容" }),
    ).not.toBeChecked();
    await page.keyboard.press("Control+1");
    await expect(editor).toHaveText("速记切换不会丢失");

    // 新输入后立刻走持久化撤销栈，不能被编辑器自身的 debounce 吞掉。
    await editor.pressSequentially("马上撤销");
    await page.keyboard.press("Control+z");
    await expect(editor).toHaveText("速记切换不会丢失");

    const titlebar = page.locator(".quicknote-titlebar-reveal-zone");
    await titlebar.hover();
    await expect(
      page.getByRole("button", { name: "保存到笔记本" }),
    ).toBeVisible();

    // Escape 应先关闭帮助弹层，不能同时收起整个速记窗口。
    await page.getByRole("button", { name: "使用说明" }).click();
    await expect(page.getByText("速记便签 · 用法")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("速记便签 · 用法")).toBeHidden();
    await expect(editor).toBeVisible();

    await page.reload();
    await expect(page.getByRole("textbox").first()).toHaveText(
      "速记切换不会丢失",
    );
    await expect(
      page.getByRole("radio", { name: "便签 1，有内容" }),
    ).toBeChecked();
  });
});
