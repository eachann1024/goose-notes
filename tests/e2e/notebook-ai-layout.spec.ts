import { expect, test } from "playwright/test";

for (const width of [1440, 900]) {
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
        const composer = element.querySelector(".notebook-ai-composer-shell")!.getBoundingClientRect();
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
