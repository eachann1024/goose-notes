import { expect, test } from "playwright/test";

for (const editorContext of [false, true]) {
  test(`ContextMenu 在矮窗口内可滚动且子菜单不被裁切（editorContext=${editorContext}）`, async ({
    page,
  }) => {
    await page.goto("/?e2eLocalMock");
    await page.waitForFunction(() => Boolean(window.__gooseTest));
    await page.evaluate(async (editorContext) => {
      const testHandle = (window as any).__gooseTest;
      const React = testHandle.React;
      const ReactDOM = testHandle.ReactDOM;
      const menu = await import("/src/components/ui/context-menu.tsx");
      const h = React.createElement;
      const host = document.createElement("div");
      host.style.cssText =
        "position:fixed;right:10px;bottom:10px;z-index:21000";
      document.body.append(host);
      ReactDOM.createRoot(host).render(
        h(
          menu.ContextMenu,
          null,
          h(
            menu.ContextMenuTrigger,
            { asChild: true },
            h("button", { id: "viewport-trigger" }, "右键目标"),
          ),
          h(
            menu.ContextMenuContent,
            { editorContext, "aria-label": "视口菜单" },
            ...Array.from({ length: 20 }, (_, i) =>
              h(menu.ContextMenuItem, { key: i }, `动作 ${i}`),
            ),
            h(
              menu.ContextMenuSub,
              null,
              h(menu.ContextMenuSubTrigger, null, "更多动作"),
              h(
                menu.ContextMenuSubContent,
                {
                  editorContext,
                  "aria-label": "视口子菜单",
                  className: "max-h-[min(18rem,calc(100dvh-16px))]",
                },
                ...Array.from({ length: 20 }, (_, i) =>
                  h(
                    menu.ContextMenuItem,
                    {
                      key: i,
                      onSelect: () => {
                        document.body.dataset.viewportAction = String(i);
                      },
                    },
                    `子动作 ${i}`,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }, editorContext);

    await page.locator("#viewport-trigger").click({ button: "right" });
    const menu = page.getByRole("menu", { name: "视口菜单", exact: true });
    const expectWithinViewport = async (
      locator: typeof menu,
      height: number,
    ) => {
      await expect
        .poll(async () => {
          const box = await locator.boundingBox();
          return Boolean(
            box &&
            box.y >= 7 &&
            box.y + box.height <= height - 7 &&
            box.x >= 7 &&
            box.x + box.width <= 368,
          );
        })
        .toBe(true);
    };
    await page.setViewportSize({ width: 375, height: 240 });
    await expectWithinViewport(menu, 240);
    const surface = editorContext ? menu.locator(".goose-menu-surface") : menu;
    await expect
      .poll(() =>
        surface.evaluate(
          (el) =>
            el.scrollHeight > el.clientHeight &&
            getComputedStyle(el).overflowY === "auto",
        ),
      )
      .toBe(true);
    await page.keyboard.press("End");
    await expect(
      page.getByRole("menuitem", { name: "更多动作", exact: true }),
    ).toBeFocused();
    await expect
      .poll(() => surface.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press("ArrowRight");
    const sub = page.getByRole("menu", { name: "视口子菜单", exact: true });
    await expectWithinViewport(sub, 240);
    await page.keyboard.press("End");
    await expect(
      page.getByRole("menuitem", { name: "子动作 19", exact: true }),
    ).toBeFocused();
    await page.setViewportSize({ width: 375, height: 200 });
    await expectWithinViewport(menu, 200);
    await expectWithinViewport(sub, 200);
    await page.screenshot({
      path: `output/playwright/context-menu-viewport-${editorContext}.png`,
    });
    await page.keyboard.press("Enter");
    await expect(page.locator("body")).toHaveAttribute(
      "data-viewport-action",
      "19",
    );
    await expect(menu).toHaveCount(0);

    await page.locator("#viewport-trigger").click({ button: "right" });
    await expectWithinViewport(menu, 200);
    await surface.hover();
    await page.mouse.wheel(0, 1000);
    await expect
      .poll(() => surface.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });
}
