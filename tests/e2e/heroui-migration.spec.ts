import { expect, test } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => Boolean(window.__gooseTest));
});

async function mountControls(page: import("playwright/test").Page) {
  await page.evaluate(async () => {
    const testHandle = (window as any).__gooseTest;
    const React = testHandle.React;
    const ReactDOM = testHandle.ReactDOM;
    const menu = await import("/src/components/ui/context-menu.tsx");
    const tip = await import("/src/components/ui/tooltip.tsx");
    const pop = await import("/src/components/ui/popover.tsx");
    const h = React.createElement;
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;inset:40px;z-index:1000;background:white;padding:30px";
    document.body.append(host);
    const root = ReactDOM.createRoot(host);
    const controls = h(
      "div",
      null,
      h(
        "button",
        { id: "outside" },
        "外部",
      ),
      h(
        menu.ContextMenu,
        null,
        h(
          menu.ContextMenuTrigger,
          { asChild: true },
          h("button", { id: "context-trigger" }, "右键目标"),
        ),
        h(
          menu.ContextMenuContent,
          { "aria-label": "测试菜单" },
          h(menu.ContextMenuItem, { disabled: true }, "禁用"),
          h(
            menu.ContextMenuItem,
            {
              onSelect: () => {
                document.body.dataset.action = "once";
              },
            },
            "动作",
          ),
          h(
            menu.ContextMenuSub,
            null,
            h(menu.ContextMenuSubTrigger, null, "子菜单"),
            h(
              menu.ContextMenuSubContent,
              { "aria-label": "测试子菜单" },
              h(menu.ContextMenuItem, null, "子动作"),
            ),
          ),
        ),
      ),
      h(
        pop.Popover,
        null,
        h(
          pop.PopoverTrigger,
          { asChild: true },
          h("button", { id: "popover-trigger" }, "普通浮层"),
        ),
        h(
          pop.PopoverContent,
          { "aria-label": "普通浮层" },
          h("input", { "aria-label": "浮层输入" }),
        ),
      ),
      h(
        pop.Popover,
        null,
        h(
          pop.PopoverTrigger,
          { asChild: true },
          h("button", { id: "no-focus-trigger" }, "不抢焦点"),
        ),
        h(
          pop.PopoverContent,
          {
            "aria-label": "不抢焦点",
            onOpenAutoFocus: (e) => e.preventDefault(),
            onCloseAutoFocus: (e) => e.preventDefault(),
          },
          h("input", { "aria-label": "不抢焦点输入" }),
        ),
      ),
      h(
        tip.TooltipProvider,
        {
          delayDuration: 400,
          skipDelayDuration: 100,
          disableHoverableContent: true,
        },
        ...[1, 2].map((n) =>
          h(
            tip.Tooltip,
            { key: n },
            h(
              tip.TooltipTrigger,
              { asChild: true },
              h("button", { id: `tip-${n}` }, `提示${n}`),
            ),
            h(tip.TooltipContent, null, `提示内容${n}`),
          ),
        ),
      ),
    );
    function ControlledTooltip() {
      const [open, setOpen] = React.useState(false);
      return h(
        "div",
        null,
        h(
          "button",
          { id: "controlled-close", onClick: () => setOpen(false) },
          "关闭受控提示",
        ),
        h(
          tip.Tooltip,
          { open, onOpenChange: setOpen, delayDuration: 300 },
          h(
            tip.TooltipTrigger,
            { asChild: true },
            h("button", { id: "controlled-tip" }, "受控提示"),
          ),
          h(tip.TooltipContent, null, "受控内容"),
        ),
      );
    }
    root.render(h(React.Fragment, null, controls, h(ControlledTooltip)));
    (window as any).__migrationUnmount = () => {
      root.unmount();
      host.remove();
    };
  });
}

test("context-menu: 右键定位、禁用项、子菜单方向键、Escape、store强制关闭和键盘触发", async ({
  page,
}) => {
  await mountControls(page);
  const trigger = page.locator("#context-trigger");
  await trigger.click({ button: "right", position: { x: 10, y: 10 } });
  const menu = page.getByRole("menu", { name: "测试菜单", exact: true });
  await expect(menu).toBeVisible();
  await expect
    .poll(() => menu.evaluate((el) => getComputedStyle(el).borderTopWidth))
    .toBe("1px");
  await expect(
    page.getByRole("menuitem", { name: "动作", exact: true }),
  ).toBeFocused();
  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(Math.abs(menuBox!.x - triggerBox!.x - 10)).toBeLessThan(3);
  expect(Math.abs(menuBox!.y - triggerBox!.y - 10)).toBeLessThan(3);
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "子菜单", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menuitem", { name: "子动作" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("menu", { name: "测试子菜单" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.evaluate(async () => {
    const { useContextMenu } =
      await import("/src/components/editor/state/contextMenu.ts");
    useContextMenu.getState().close();
  });
  await expect(menu).toHaveCount(0);
  await trigger.press("ContextMenu");
  await expect(menu).toBeVisible();
  await page
    .getByRole("menuitem", { name: "动作", exact: true })
    .press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-action", "once");
  await trigger.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 150,
    clientY: 140,
  });
  await page.waitForTimeout(750);
  await expect(menu).toBeVisible();
  await trigger.dispatchEvent("pointerup", { pointerType: "touch" });
  await trigger.click({ position: { x: 20, y: 20 } });
  await expect(menu).toHaveCount(0);
  await trigger.click({ button: "right", position: { x: 10, y: 10 } });
  await expect(menu).toBeVisible();
  await page.locator("#outside").click();
  await expect(menu).toHaveCount(0);
  await trigger.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 150,
    clientY: 140,
  });
  await page.evaluate(() => (window as any).__migrationUnmount());
  await page.waitForTimeout(750);
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("popover: 进入与恢复焦点、可取消自动焦点和外部点击", async ({ page }) => {
  await mountControls(page);
  await page.locator("#popover-trigger").click();
  const popover = page.getByRole("dialog", { name: "普通浮层" });
  await expect(popover).toBeVisible();
  await expect
    .poll(() => popover.evaluate((el) => getComputedStyle(el).borderTopWidth))
    .toBe("1px");
  await expect(page.getByLabel("浮层输入", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#popover-trigger")).toBeFocused();
  await page.locator("#no-focus-trigger").click();
  await expect(page.locator("#no-focus-trigger")).toBeFocused();
  await page.getByLabel("不抢焦点输入", { exact: true }).click();
  await page.locator("#outside").click();
  await expect(page.locator("#outside")).toBeFocused();
  await expect(page.getByRole("dialog", { name: "不抢焦点" })).toHaveCount(0);
});

test("tooltip: 400ms、skipDelay100、禁hoverable、键盘focus/Escape与卸载timer", async ({
  page,
}) => {
  await mountControls(page);
  await page.locator("#tip-1").hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toHaveText("提示内容1");
  await expect(page.locator("#tip-1")).toHaveAttribute(
    "aria-describedby",
    /.+/,
  );
  await page.locator("#tip-2").hover();
  await expect(page.getByRole("tooltip")).toHaveText("提示内容2", {
    timeout: 250,
  });
  await page.locator("#outside").hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.locator("#tip-1").focus();
  await expect(page.getByRole("tooltip")).toHaveText("提示内容1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.locator("#outside").focus();
  await page.locator("#controlled-tip").hover();
  await expect(page.getByRole("tooltip")).toHaveText("受控内容");
  await page.locator("#controlled-close").click();
  await page.waitForTimeout(450);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.locator("#tip-2").hover();
  await page.evaluate(() => (window as any).__migrationUnmount());
  await page.waitForTimeout(500);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("HeroUI Modal/Tabs 和原生 Switch 键盘行为", async ({ page }) => {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const setting = page.getByRole("switch", { name: "自动打开上次笔记" });
  const checked = await setting.isChecked();
  await setting.focus();
  await page.keyboard.press("Space");
  await expect(setting).toBeChecked({ checked: !checked });
  await page.getByRole("button", { name: "数据管理", exact: true }).click();
  const localTab = page.getByRole("tab", { name: "本地备份" });
  const localColor = await localTab.evaluate((el) => getComputedStyle(el).color);
  const rgb = localColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  expect(rgb, `未选中 Tab 字色应可见，实际 ${localColor}`).toBeTruthy();
  const luminance =
    (0.2126 * Number(rgb![1]) +
      0.7152 * Number(rgb![2]) +
      0.0722 * Number(rgb![3])) /
    255;
  expect(luminance).toBeLessThan(0.65);
  await localTab.hover();
  const hovered = await localTab.evaluate((el) => ({
    opacity: getComputedStyle(el).opacity,
    transitionProperty: getComputedStyle(el).transitionProperty,
  }));
  expect(Number(hovered.opacity)).toBe(1);
  expect(hovered.transitionProperty).toBe("none");
  await page.getByRole("tab", { name: "WebDAV备份" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "本地备份" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel", { name: "本地备份" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("编辑器选区跨 LinkButton 双重触发桥保留，链接只插入一次", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const h = window.__gooseTest!;
    const { pages } = await h.setupMockNotebook();
    h.stores.useTabs.getState().openPermanentTab(pages[0].id);
  });
  await expect(page.locator(".bn-editor")).toBeVisible();
  await page.evaluate(async () => {
    const { TextSelection } =
      await import("/node_modules/.vite/deps/prosemirror-state.js");
    const editor = (window as any).__gooseNoteEditor;
    let start = 0;
    editor.prosemirrorState.doc.descendants((node: any, position: number) => {
      if (node.isText && node.text.startsWith("This file")) start = position;
    });
    editor.prosemirrorView.dispatch(
      editor.prosemirrorState.tr.setSelection(
        TextSelection.create(editor.prosemirrorState.doc, start, start + 9),
      ),
    );
    editor.focus();
  });
  await page.getByRole("button", { name: "添加链接", exact: true }).click();
  await expect(page.locator('input[placeholder="https://..."]')).toBeVisible();
  await page
    .locator('input[placeholder="https://..."]')
    .fill("https://example.com");
  await page.keyboard.press("Enter");
  await expect(
    page.locator('.bn-editor a[href="https://example.com"]'),
  ).toHaveText("This file");
  await expect(
    page.locator('.bn-editor a[href="https://example.com"]'),
  ).toHaveCount(1);
});

test("HeroUI 单选菜单与混合面板内导出菜单键盘退出", async ({ page }) => {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "本地文件夹", exact: true }).click();
  await page
    .getByRole("button", { name: "系统默认（访达）", exact: true })
    .click();
  const selectedRadio = page.getByRole("menuitemradio", {
    name: "系统默认（访达）",
  });
  await expect(selectedRadio).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () =>
      selectedRadio.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).paddingInlineStart),
      ),
    )
    .toBeGreaterThanOrEqual(28);
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("menuitemradio", { name: "系统默认（访达）" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitemradio", { name: "自定义" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(async () => {
    const h = window.__gooseTest!;
    const { pages } = await h.setupMockNotebook();
    h.stores.useTabs.getState().openPermanentTab(pages[0].id);
  });
  await page.getByRole("button", { name: "更多操作", exact: true }).click();
  const exportTrigger = page.getByRole("button", { name: "导出", exact: true });
  const generateImage = page.getByRole("button", { name: "生成图片", exact: true });
  const exportBox = await exportTrigger.boundingBox();
  const generateBox = await generateImage.boundingBox();
  expect(exportBox).toBeTruthy();
  expect(generateBox).toBeTruthy();
  expect(exportBox!.width).toBeGreaterThan(generateBox!.width * 0.9);
  await exportTrigger.hover();
  const markdownItem = page.getByRole("menuitem", { name: "Markdown", exact: true });
  await expect(markdownItem).toBeVisible();
  const submenu = page.getByRole("menu");
  const triggerBox = await exportTrigger.boundingBox();
  const submenuBox = await submenu.boundingBox();
  expect(triggerBox).toBeTruthy();
  expect(submenuBox).toBeTruthy();
  expect(submenuBox!.y).toBeLessThan(triggerBox!.y + triggerBox!.height);
  expect(submenuBox!.y + submenuBox!.height).toBeGreaterThan(triggerBox!.y);
  const besideTrigger =
    submenuBox!.x + 8 >= triggerBox!.x + triggerBox!.width ||
    submenuBox!.x + submenuBox!.width <= triggerBox!.x + 8;
  expect(besideTrigger).toBe(true);
  await exportTrigger.click();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("menuitem", { name: "Markdown", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "HTML", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "导出", exact: true }),
  ).toBeFocused();
});

test("深色模式弹层关闭图标保持可见", async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.evaluate(async () => {
    const testHandle = (window as any).__gooseTest;
    const React = testHandle.React;
    const ReactDOM = testHandle.ReactDOM;
    const dialog = await import("/src/components/ui/dialog.tsx");
    const h = React.createElement;
    const host = document.createElement("div");
    document.body.append(host);
    const root = ReactDOM.createRoot(host);
    root.render(
      h(
        dialog.Dialog,
        { open: true },
        h(
          dialog.DialogContent,
          null,
          h(dialog.DialogTitle, null, "深色图标"),
          h(dialog.DialogDescription, null, "关闭按钮应可见"),
        ),
      ),
    );
    (window as any).__darkDialogUnmount = () => {
      root.unmount();
      host.remove();
    };
  });
  const close = page.getByRole("button", { name: "关闭" });
  await expect(close).toBeVisible();
  const svg = close.locator("svg");
  await expect(svg).toBeVisible();
  const luminance = await svg.evaluate((el) => {
    const color = getComputedStyle(el).color;
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return 0;
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  });
  expect(luminance).toBeGreaterThan(0.4);
  await page.evaluate(() => (window as any).__darkDialogUnmount?.());
});
