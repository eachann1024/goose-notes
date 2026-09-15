import { expect, test, type Page } from "playwright/test";

const menuSelector =
  "[data-goose-floating-content].goose-notebook-menu-surface";

async function boot(page: Page, reduced = false) {
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() => Boolean(window.__gooseTest));
  await page.evaluate(async () => {
    const h = window.__gooseTest!;
    const { notebookId, pages } = await h.setupMockNotebook();
    const base = h.stores.useNotebooks.getState().notebooks[notebookId];
    h.stores.useNotebooks.setState({
      activeNotebookId: notebookId,
      notebooks: Object.fromEntries(
        Array.from({ length: 4 }, (_, i) => {
          const id = i === 0 ? notebookId : `motion-mock-${i}`;
          return [
            id,
            { ...base, id, name: `动画测试笔记本 ${i + 1}`, order: i },
          ];
        }),
      ),
    });
    h.stores.useTabs.getState().openPermanentTab(pages[0].id);
  });
  const trigger = page.locator(".sidebar-notebook-trigger");
  const menu = page.locator(menuSelector);
  await expect(trigger).toBeVisible();
  await expect(page.getByRole("tree")).toBeVisible();
  await expect(trigger).toHaveAttribute("data-state", "closed");
  await expect(menu).toBeHidden();
  return { trigger, menu, shell: page.locator(".goose-notebook-shell") };
}

test("笔记本菜单反复开关及 Esc 后鼠标重开，按钮不位移、退出立即 inert", async ({
  page,
}) => {
  const { trigger, menu, shell } = await boot(page);
  const rect = await trigger.boundingBox();
  for (let i = 0; i < 3; i++) {
    await expect(trigger).toHaveAttribute("data-state", "closed");
    await trigger.click();
    await expect(menu).toHaveAttribute("data-state", "open");
    await expect(menu.getByRole("menuitem")).toHaveCount(4);
    await expect
      .poll(() =>
        shell.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m22),
      )
      .toBeCloseTo(1, 3);
    expect(await trigger.boundingBox()).toEqual(rect);
    await trigger.click();
    expect(
      await menu.evaluate((e) => ({
        inert: e.hasAttribute("inert"),
        aria: e.getAttribute("aria-hidden"),
      })),
    ).toEqual({ inert: true, aria: "true" });
    await expect(menu).toHaveAttribute("hidden", "");
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("hidden", "");
    await trigger.click();
    await expect(trigger).toHaveAttribute("data-motion", "full");
    await expect
      .poll(() =>
        shell.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m22),
      )
      .toBeCloseTo(1, 3);
    await trigger.click();
    await expect(menu).toHaveAttribute("hidden", "");
  }
});

test("真实 pointerdown 前采样覆盖展开中间态和快速反转", async ({ page }) => {
  const { trigger, menu, shell } = await boot(page);
  // 在真实输入前监听，避免 click 的自动等待吞掉动画开头。
  await trigger.evaluate((element, selector) => {
    const state = window as typeof window & {
      motionSamples: { scale: number; opacity: number }[];
      motionDone: boolean;
    };
    state.motionSamples = [];
    state.motionDone = false;
    element.addEventListener(
      "pointerdown",
      () => {
        const start = performance.now();
        const sample = () => {
          const shell = document.querySelector(".goose-notebook-shell");
          const menu = document.querySelector(selector);
          if (shell && menu)
            state.motionSamples.push({
              scale: new DOMMatrix(getComputedStyle(shell).transform).m22,
              opacity: Number(getComputedStyle(menu).opacity),
            });
          if (performance.now() - start < 500) requestAnimationFrame(sample);
          else state.motionDone = true;
        };
        requestAnimationFrame(sample);
      },
      { once: true },
    );
  }, menuSelector);
  await trigger.click();
  await expect(menu).toHaveAttribute("data-state", "open");
  await trigger.click();
  await expect(menu).toHaveAttribute("inert", "");
  await trigger.click();
  await expect(menu).toHaveAttribute("data-state", "open");
  await page.waitForFunction(
    () => (window as typeof window & { motionDone: boolean }).motionDone,
  );
  const samples = await page.evaluate(
    () =>
      (
        window as typeof window & {
          motionSamples: { scale: number; opacity: number }[];
        }
      ).motionSamples,
  );
  expect(samples.length).toBeGreaterThanOrEqual(8);
  expect(samples.some((s) => s.scale > 0 && s.scale < 0.99)).toBe(true);
  expect(new Set(samples.map((s) => s.scale.toFixed(3))).size).toBeGreaterThan(
    2,
  );
  expect(samples.some((s) => s.opacity > 0 && s.opacity < 1)).toBe(true);
  await expect
    .poll(() =>
      shell.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m22),
    )
    .toBeCloseTo(1, 3);
  await trigger.click();
  await expect(menu).toHaveAttribute("hidden", "");
});

test("系统 reduced-motion 去掉 reveal，键盘重复开关即时", async ({ page }) => {
  const { trigger, menu, shell } = await boot(page, true);
  await trigger.click();
  await expect(trigger).toHaveAttribute("data-motion", "reduced");
  await expect
    .poll(() => menu.evaluate((e) => getComputedStyle(e).clipPath))
    .toBe("none");
  await expect
    .poll(() =>
      shell.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m22),
    )
    .toBeCloseTo(1, 3);
  await trigger.click();
  await expect(menu).toHaveAttribute("hidden", "");
  for (let i = 0; i < 3; i++) {
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("data-motion", "instant");
    expect(await menu.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
    expect(
      await shell.evaluate(
        (e) => new DOMMatrix(getComputedStyle(e).transform).m22,
      ),
    ).toBeCloseTo(1, 3);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("hidden", "");
    await expect(trigger).toBeFocused();
  }
});

test("hover 展开后立即进入首行保持打开，移出收起", async ({ page }) => {
  const { trigger, menu } = await boot(page);
  await page.evaluate(async () => {
    const { useSettings } = await import("/src/stores/useSettings.ts");
    useSettings.getState().setNotebookDropdownHoverExpand(true);
  });
  await trigger.hover();
  await expect(menu).toHaveAttribute("data-state", "open");
  await menu.getByRole("menuitem").first().hover();
  await expect(menu).toHaveAttribute("data-state", "open");
  await expect(menu).not.toHaveAttribute("inert", "");
  await page.mouse.move(700, 100);
  await expect(menu).toHaveAttribute("data-state", "closed");
  await expect(menu).toHaveAttribute("hidden", "");
});
