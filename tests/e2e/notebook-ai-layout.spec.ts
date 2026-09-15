import { expect, test } from "playwright/test";

for (const width of [1440, 1200]) {
  for (const layout of ["side-panel", "fullscreen"] as const) {
    test(`AI ${layout} geometry at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((mode) => {
        localStorage.setItem("goose-note-ai-layout-mode", mode);
      }, layout);
      await page.goto("/?e2eLocalMock");
      await page.waitForFunction(() => Boolean(window.__gooseTest));
      await page.evaluate(async () => {
        const harness = window.__gooseTest!;
        const { pages } = await harness.setupMockNotebook();
        harness.stores.useTabs.getState().openPermanentTab(pages[0].id);
        const { useSettings } = await import("/src/stores/useSettings.ts");
        useSettings.setState((state) => ({ ai: { ...state.ai, enabled: true } }));
      });
      await expect(page.locator(".electron-titlebar")).toBeVisible();
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("goose-note:open-ai-panel"));
      });
      const panel = page.locator(`[data-ai-panel-layout="${layout}"]`);
      await expect(panel).toBeVisible();
      await expect(panel.locator(".notebook-ai-composer-shell")).toBeVisible();
      await expect.poll(async () => panel.evaluate((element) => {
        const sheet = element.querySelector(".notebook-ai-zoom-slot")!.getBoundingClientRect();
        const composer = element.querySelector(".bui-prompt-bar")!.getBoundingClientRect();
        const header = document.querySelector(".electron-titlebar")!.getBoundingClientRect();
        const toolbar = document.querySelector(".electron-titlebar [role=tab]")?.getBoundingClientRect();
        const host = document.querySelector(".notebook-ai-fullscreen-host")?.getBoundingClientRect();
        const inset = parseFloat(getComputedStyle(document.documentElement).fontSize) / 2;
        if (element.getAttribute("data-ai-panel-layout") === "side-panel") {
          return Math.abs(composer.left - sheet.left - inset) < 1 &&
            Math.abs(sheet.right - composer.right - inset) < 1 &&
            Math.abs(sheet.bottom - composer.bottom - inset) < 1;
        }
        return Boolean(toolbar && host && header.height <= 48 && toolbar.bottom <= header.bottom + 1 && host.top >= header.bottom - 1 && document.querySelectorAll(".electron-titlebar [role=tab]").length === 1);
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${layout}-${width}.png`) });
    });
  }
}

test("全屏 AI 失焦后 Escape 关闭面板", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("goose-note-ai-layout-mode", "fullscreen");
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => Boolean(window.__gooseTest));
  await page.evaluate(async () => {
    const harness = window.__gooseTest!;
    const { pages } = await harness.setupMockNotebook();
    harness.stores.useTabs.getState().openPermanentTab(pages[0].id);
    const { useSettings } = await import("/src/stores/useSettings.ts");
    useSettings.setState((state) => ({
      ai: {
        ...state.ai,
        enabled: true,
        selectedModelId: "gpt-test",
        customModelOptions: [{ id: "gpt-test", label: "GPT Test" }],
      },
    }));
  });
  await expect(page.locator(".electron-titlebar")).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("goose-note:open-ai-panel"));
  });
  const panel = page.locator('[data-ai-panel-layout="fullscreen"]');
  const editor = panel.locator("[data-ai-composer-editor]");
  await expect(panel).toBeVisible();
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.click();
  await expect(editor).toBeFocused();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await expect(editor).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("AI 输入条单行和多行都是 20px 圆角", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("goose-note-ai-layout-mode", "side-panel");
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => Boolean(window.__gooseTest));
  await page.evaluate(async () => {
    const harness = window.__gooseTest!;
    const { pages } = await harness.setupMockNotebook();
    harness.stores.useTabs.getState().openPermanentTab(pages[0].id);
    const { useSettings } = await import("/src/stores/useSettings.ts");
    useSettings.setState((state) => ({
      ai: {
        ...state.ai,
        enabled: true,
        selectedModelId: "gpt-test",
        customModelOptions: [{ id: "gpt-test", label: "GPT Test" }],
      },
    }));
  });
  await expect(page.locator(".electron-titlebar")).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("goose-note:open-ai-panel"));
  });
  const panel = page.locator('[data-ai-panel-layout="side-panel"]');
  const shell = panel.locator(".notebook-ai-composer-shell");
  const bar = panel.locator(".bui-prompt-bar");
  await expect(shell).toBeVisible();

  const radii = async () =>
    shell.evaluate((element) => {
      const style = getComputedStyle(element);
      const barStyle = getComputedStyle(element.closest(".bui-prompt-bar")!);
      return {
        shell: style.borderTopLeftRadius,
        bar: barStyle.borderTopLeftRadius,
        expanded: element.getAttribute("data-expanded") === "true",
      };
    });

  await expect.poll(radii).toEqual({
    shell: "20px",
    bar: "20px",
    expanded: false,
  });
  await expect
    .poll(() =>
      bar.evaluate((element) => getComputedStyle(element).borderTopWidth),
    )
    .toBe("1px");
  await bar.screenshot({
    path: testInfo.outputPath("composer-single-line.png"),
  });

  const editor = panel.locator("[data-ai-composer-editor]");
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.click();
  await editor.pressSequentially(
    "试试：总结当前笔记，并画出要点关系图，再根据内容生成一张趋势图。",
  );
  await expect.poll(radii).toEqual({
    shell: "20px",
    bar: "20px",
    expanded: true,
  });
  await bar.screenshot({
    path: testInfo.outputPath("composer-multiline.png"),
  });
});
