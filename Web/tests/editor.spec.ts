import { expect, test, type Page } from "@playwright/test";

async function openSidebarIfNeeded(page: Page) {
  const showSidebar = page.getByRole("button", { name: "显示侧边栏" });
  if (await showSidebar.isVisible()) await showSidebar.click();
}

async function closeCompactSidebarIfNeeded(page: Page) {
  const closeSidebar = page.getByRole("button", { name: "关闭侧边栏" });
  if (await closeSidebar.isVisible()) await closeSidebar.click();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/harness.html");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("editor-surface")).toBeVisible();
  await page.waitForTimeout(250);
  expect(errors).toEqual([]);
});

test("新建页面、编辑标题和正文后显示已保存", async ({ page }) => {
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: "新建页面" }).last().click();
  await closeCompactSidebarIfNeeded(page);
  const title = page.getByRole("textbox", { name: "页面标题" });
  await expect(title).toHaveValue("");
  await title.fill("周一工作记录");
  const editor = page.locator(".bn-editor");
  await editor.click();
  await page.keyboard.type("完成原生桥接与浏览器验收");
  await expect(page.locator(".save-status")).toHaveText("正在保存…");
  await expect(page.getByRole("button", { name: /周一工作记录/ }).first()).toBeVisible();
  await expect(page.locator(".save-status")).toContainText("已保存", { timeout: 4000 });
});

test("单击复用预览标签，编辑后将标签固定", async ({ page }) => {
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: "七月阅读清单" }).first().click();
  await page.getByRole("button", { name: "零散想法" }).first().click();
  await closeCompactSidebarIfNeeded(page);
  const previewTab = page.getByRole("tab", { name: /零散想法/ });
  await expect(previewTab).toHaveClass(/is-preview/);
  await page.getByRole("textbox", { name: "页面标题" }).fill("整理后的想法");
  await expect(page.locator(".save-status")).toContainText("已保存", { timeout: 4000 });
  await expect(page.getByRole("tab", { name: /整理后的想法/ })).not.toHaveClass(/is-preview/);
});

test("搜索、收藏、回收站和恢复流程自然", async ({ page }) => {
  await openSidebarIfNeeded(page);
  await page.getByRole("button", { name: /搜索笔记/ }).click();
  await page.getByRole("textbox", { name: "搜索标题和正文" }).fill("气泡水");
  await page.getByRole("option", { name: /五一千岛湖露营/ }).click();
  await expect(page.getByRole("textbox", { name: "页面标题" })).toHaveValue("五一千岛湖露营 · 两日计划");

  await page.getByRole("button", { name: "取消收藏" }).click();
  await expect(page.getByRole("button", { name: "收藏页面" })).toBeVisible();
  await page.getByRole("button", { name: "移到回收站" }).click();
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await expect(page.locator(".page-row").filter({ hasText: "五一千岛湖露营 · 两日计划" })).toBeVisible();
  await page.getByRole("button", { name: "恢复五一千岛湖露营 · 两日计划" }).click();
  await expect(page.getByRole("textbox", { name: "页面标题" })).toHaveValue("五一千岛湖露营 · 两日计划");
});

test("深色模式、侧边栏与紧凑窗口状态正确", async ({ page }, testInfo) => {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("app-shell")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("app-shell")).toHaveCSS("background-color", "rgb(31, 31, 30)");
  if (testInfo.project.name === "compact") {
    await expect(page.locator(".harness-sidebar")).toHaveClass(/is-collapsed/);
    await expect(page.getByRole("button", { name: "显示侧边栏" })).toBeVisible();
    const titleBounds = await page.getByRole("textbox", { name: "页面标题" }).boundingBox();
    expect(titleBounds).not.toBeNull();
    expect(titleBounds!.x).toBeGreaterThanOrEqual(0);
    expect(titleBounds!.x + titleBounds!.width).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "显示侧边栏" }).click();
    await expect(page.getByRole("button", { name: /搜索笔记/ })).toBeVisible();
    await page.getByRole("button", { name: "关闭侧边栏" }).click();
    await expect(page.locator(".harness-sidebar")).toHaveClass(/is-collapsed/);
  } else {
    await page.getByRole("button", { name: "隐藏侧边栏" }).click();
    await expect(page.locator(".harness-sidebar")).toHaveClass(/is-collapsed/);
    await expect(page.locator(".harness-sidebar")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("button", { name: /搜索笔记/ })).toHaveCount(0);
    await page.getByRole("button", { name: "显示侧边栏" }).click();
    await expect(page.locator(".harness-sidebar")).not.toHaveClass(/is-collapsed/);
    await expect(page.getByRole("button", { name: /搜索笔记/ })).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test("保存后的页面在刷新后仍可恢复", async ({ page }, testInfo) => {
  if (testInfo.project.name === "compact") {
    await page.getByRole("button", { name: "显示侧边栏" }).click();
  }
  await page.getByRole("button", { name: "新建页面" }).last().click();
  if (testInfo.project.name === "compact") {
    await page.getByRole("button", { name: "关闭侧边栏" }).click();
  }
  await page.getByRole("textbox", { name: "页面标题" }).fill("持久化复测");
  await page.locator(".bn-editor").click();
  await page.keyboard.type("刷新后仍然存在");
  await expect(page.locator(".save-status")).toContainText("已保存", { timeout: 4000 });
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("goose-notes.browser-harness.v1"))).toContain("持久化复测");

  await page.reload();
  await expect(page.getByRole("textbox", { name: "页面标题" })).toHaveValue("持久化复测");
  await expect(page.locator(".bn-editor")).toContainText("刷新后仍然存在");
});

test("搜索层支持 Escape 关闭并将焦点还给触发按钮", async ({ page }) => {
  await openSidebarIfNeeded(page);
  const trigger = page.getByRole("button", { name: /搜索笔记/ });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "搜索笔记" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "搜索笔记" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("关闭最后一个标签后显示明确空状态且不保留页面操作", async ({ page }) => {
  await page.getByRole("button", { name: "关闭五一千岛湖露营 · 两日计划" }).click();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText("选择一个页面开始写作")).toBeVisible();
  await expect(page.getByRole("button", { name: "收藏页面" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "移到回收站" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "更多页面操作" })).toHaveCount(0);
});
