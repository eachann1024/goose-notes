import { expect, test } from "playwright/test";

test("文件名铺满标签页，粗光标居中，回车进入正文末尾", async ({ page }) => {
  await page.addInitScript(() => { window.__GOOSE_E2E__ = true; });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => Boolean(window.__gooseTest && window.__GOOSE_TEST__?.getPagesState().hydrated));
  await page.getByRole("button", { name: "暂时跳过" }).click();
  const id = await page.evaluate(async () => {
    const harness = window.__gooseTest!;
    const { notebookId } = await harness.setupMockNotebook();
    const id = harness.stores.usePages.getState().createUnsavedLocalPage(notebookId);
    window.__GOOSE_TEST__!.openPermanentTab(id);
    return id;
  });

  const input = page.locator(`[data-tab-page-id="${id}"] [data-page-title-field]`);
  await expect(input).toBeFocused();
  await expect(input).toBeEmpty();
  await expect(input).toHaveAttribute("placeholder", "输入文件名称，按回车开始编辑正文");
  await expect(page.locator(`[data-tab-page-id="${id}"] [aria-label="关闭标签页"]`)).toBeHidden();
  await expect(page.locator(`[data-tab-page-id="${id}"]`)).toHaveCSS("outline-style", "dashed");
  await expect(page.locator(`[data-tab-page-id="${id}"]`)).toHaveCSS("outline-offset", "-1px");
  const geometry = await input.evaluate(element => {
    const field = element as HTMLInputElement;
    const shell = field.closest(".page-title-edit-shell")!;
    const caret = shell.querySelector(".page-title-caret")!;
    const box = shell.getBoundingClientRect();
    const bar = caret.getBoundingClientRect();
    return { width: box.width, tabWidth: shell.closest("[role=tab]")!.getBoundingClientRect().width, caretWidth: bar.width, centerDelta: Math.abs((box.top + box.bottom - bar.top - bar.bottom) / 2), hidden: (caret as HTMLElement).hidden };
  });
  expect(geometry.width).toBeGreaterThan(geometry.tabWidth - 32);
  expect(geometry.caretWidth).toBe(5);
  expect(geometry.centerDelta).toBeLessThan(1);
  expect(geometry.hidden).toBe(false);

  await input.fill("我的新笔记");
  await input.press("Enter");
  const editor = page.locator(".bn-editor[contenteditable='true']").first();
  await expect(editor).toBeFocused();
  await editor.fill("第一段");
  await page.keyboard.press("Enter");
  await page.keyboard.type("最后一段");
  const titleButton = page.locator(`[data-tab-page-id="${id}"]`).getByRole("button", { name: "笔记标题" });
  const idleTextX = await titleButton.evaluate(element => element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft));
  await titleButton.click();
  const renamed = page.locator(`[data-tab-page-id="${id}"] [data-page-title-field]`);
  const editTextX = await renamed.evaluate(element => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
  });
  expect(Math.abs(editTextX - idleTextX)).toBeLessThan(1);
  await renamed.click();
  await expect(renamed).toHaveAttribute("placeholder", "修改文件名称，按回车到正文末尾继续编辑");
  await renamed.fill("改名后续写");
  await renamed.press("Enter");
  await expect(editor).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.focusNode?.textContent)).toBe("最后一段");
});

test("侧栏新建文件首次回车进入正文", async ({ page }) => {
  await page.addInitScript(() => { window.__GOOSE_E2E__ = true; });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => Boolean(window.__gooseTest && window.__GOOSE_TEST__?.getPagesState().hydrated));
  await page.getByRole("button", { name: "暂时跳过" }).click();
  await page.evaluate(async () => { await window.__gooseTest!.setupMockNotebook(); });
  await page.getByRole("button", { name: "新建文件", exact: true }).click();
  const input = page.locator("[data-page-title-field]:focus");
  await expect(input).toBeFocused();
  await input.fill("侧栏新建测试");
  await input.press("Enter");
  await expect(page.locator(".bn-editor[contenteditable='true']").first()).toBeFocused();
  await expect(page.getByRole("tab", { name: "笔记标题" })).toContainText("侧栏新建测试");
});
