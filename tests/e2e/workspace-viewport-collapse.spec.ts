import { expect, test } from "playwright/test";

test("窗口变窄先收右栏再收左栏，拉宽后恢复", async ({ page }) => {
  await page.setViewportSize({ width: 1250, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem("goose-note-ai-layout-mode", "side-panel");
    localStorage.setItem("goose-note-ai-panel-open", "false");
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => Boolean(window.__gooseTest));
  await page.evaluate(async () => {
    const harness = window.__gooseTest!;
    const { pages } = await harness.setupMockNotebook();
    harness.stores.useTabs.getState().openPermanentTab(pages[0].id);
    const { useSettings } = await import("/src/stores/useSettings.ts");
    useSettings.setState((state) => ({ ai: { ...state.ai, enabled: true } }));
  });
  await expect(page.locator(".workspace-shell")).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("goose-note:open-ai-panel", {
        detail: { layout: "side-panel" },
      }),
    );
  });

  const sidePanel = page.locator('[data-ai-panel-layout="side-panel"]');
  await expect(sidePanel).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-sidebar-collapsed");

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(sidePanel).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-sidebar-collapsed");

  await page.setViewportSize({ width: 500, height: 900 });
  await expect(page.locator("html")).toHaveAttribute("data-sidebar-collapsed", "");

  await page.setViewportSize({ width: 1250, height: 900 });
  await expect(page.locator("html")).not.toHaveAttribute("data-sidebar-collapsed");
  await expect(sidePanel).toBeVisible();
});
