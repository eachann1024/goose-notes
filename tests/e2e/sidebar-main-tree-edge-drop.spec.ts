import { expect, test, type Page } from "playwright/test";

/**
 * 主树（SidebarMainTree / react-complex-tree + 原生 HTML5 drag）边缘落点回归。
 * 用真实鼠标按下→多步移动→松开触发原生拖拽（原生 drag 需要连续 dragover，
 * 单次 dispatchEvent 不能证明交互通过）。
 */

type LocalPageInfo = {
  id: string;
  workspaceId: string;
  parentId?: string;
  isFolder?: boolean;
  localFilePath?: string;
};

type LocalHarness = {
  setupMockNotebook: () => Promise<{ notebookId: string }>;
  stores: {
    usePages: {
      getState: () => { pages: Record<string, LocalPageInfo> };
    };
  };
};

type LocalHarnessWindow = Window & {
  __GOOSE_E2E__?: boolean;
  __gooseTest?: LocalHarness;
};

async function bootMainTree(page: Page) {
  await page.addInitScript(() => {
    (window as LocalHarnessWindow).__GOOSE_E2E__ = true;
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(() =>
    Boolean((window as LocalHarnessWindow).__gooseTest?.stores?.usePages),
  );

  const fixture = await page.evaluate(async () => {
    const harness = (window as LocalHarnessWindow).__gooseTest;
    if (!harness) throw new Error("Local folder harness unavailable");
    await harness.setupMockNotebook();
    const pages = Object.values(harness.stores.usePages.getState().pages);
    const idOf = (path: string) =>
      pages.find((page) => page.localFilePath === path)?.id;
    return {
      folderId: idOf("/mock-notes/sub")!,
      nestedId: idOf("/mock-notes/sub/nested.md")!,
      frontmatterId: idOf("/mock-notes/frontmatter.md")!,
      hasTitleId: idOf("/mock-notes/has-title.md")!,
      richId: idOf("/mock-notes/rich.md")!,
    };
  });

  await expect(
    page.locator(`[data-rct-item-id="${fixture.folderId}"]`).first(),
  ).toBeVisible({ timeout: 15_000 });
  return fixture;
}

/** 根级行顺序（展开文件夹的子项不算） */
async function rootRowIds(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll("[data-rct-tree='main'] > ul > li"),
    ).map(
      (li) =>
        li.querySelector("[data-rct-item-id]")?.getAttribute("data-rct-item-id") ??
        "",
    ),
  );
}

/** 最后一行可见行（展开文件夹的子项也算行） */
async function lastVisibleItemId(page: Page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll(
      "[data-rct-tree='main'] [data-rct-item-id]",
    );
    return rows[rows.length - 1]?.getAttribute("data-rct-item-id") ?? "";
  });
}

/** 确保文件夹处于展开状态；行点击是切换，已展开时再点会收起 */
async function ensureFolderExpanded(page: Page, folderId: string, childId: string) {
  if (await page.locator(`[data-rct-item-id="${childId}"]`).count()) return;
  await page.locator(`[data-rct-item-id="${folderId}"]`).first().click();
}

async function parentIdOf(page: Page, pageId: string) {
  return page.evaluate((id) => {
    const harness = (window as LocalHarnessWindow).__gooseTest;
    return harness?.stores.usePages.getState().pages[id]?.parentId ?? null;
  }, pageId);
}

async function listBox(page: Page) {
  const box = await page.locator("[data-rct-tree='main']").boundingBox();
  if (!box) throw new Error("main tree not visible");
  return box;
}

/**
 * 边缘落点目标位置。注意：原生拖拽在浏览器窗口外松手不会派发 drop，
 * 所以越界位置要 clamp 在视口内。
 */
async function edgeTarget(
  page: Page,
  zone: "top" | "bottom" | "bottom-blank",
): Promise<{ x: number; y: number }> {
  const tree = await listBox(page);
  const { innerHeight, lastRowBottom } = await page.evaluate(() => {
    const rows = document.querySelectorAll(
      "[data-rct-tree='main'] [data-rct-item-container='true']",
    );
    const lastRow = rows[rows.length - 1] as HTMLElement | undefined;
    return {
      innerHeight: window.innerHeight,
      lastRowBottom: lastRow ? lastRow.getBoundingClientRect().bottom : 0,
    };
  });
  const x = tree.x + 80;
  if (zone === "top") return { x, y: tree.y - 50 };
  if (zone === "bottom-blank") return { x, y: lastRowBottom + 40 };
  return { x, y: Math.min(tree.y + tree.height + 40, innerHeight - 20) };
}

/** 真实鼠标拖动：按下后分多步移动（触发连续 dragover），再松手 */
async function dragRowTo(
  page: Page,
  itemId: string,
  target: { x: number; y: number },
  duringDrag?: () => Promise<void>,
) {
  const row = page.locator(`[data-rct-item-id="${itemId}"]`).first();
  const box = await row.boundingBox();
  if (!box) throw new Error(`row not visible: ${itemId}`);
  const startX = box.x + Math.min(box.width / 2, 120);
  const startY = box.y + box.height / 2;
  const steps = 10;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      Math.round(startX + ((target.x - startX) * step) / steps),
      Math.round(startY + ((target.y - startY) * step) / steps),
      { steps: 2 },
    );
  }
  await page.waitForTimeout(80);
  if (duringDrag) await duringDrag();
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test.describe("主树拖到上/下边缘", () => {
  test("拖到列表上方越界处松手 → 置顶（根级首项）", async ({ page }) => {
    const fixture = await bootMainTree(page);
    expect(await rootRowIds(page)).toHaveLength(6);
    const treeBox = await listBox(page);
    await dragRowTo(
      page,
      fixture.richId,
      await edgeTarget(page, "top"),
      async () => {
        // 拖动中：吸附带内应用层接管落点，线画在可视上缘（不是 rct 的行内位置）
        await expect(page.locator("[data-main-tree-edge-drop='top']")).toHaveCount(1);
        const line = page.locator(".main-tree-edge-drop-line");
        await expect(line).toHaveCount(1);
        const lineBox = await line.boundingBox();
        expect(Math.abs((lineBox?.y ?? 0) - treeBox.y)).toBeLessThanOrEqual(4);
        await expect(
          page
            .locator(".main-tree-drop-between-line:not(.main-tree-edge-drop-line)")
            .first(),
        ).toBeHidden();
      },
    );

    await expect
      .poll(async () => (await rootRowIds(page))[0])
      .toBe(fixture.richId);
    // 松手后指示线与接管状态都要收干净
    await expect(page.locator(".main-tree-edge-drop-line")).toHaveCount(0);
    await expect(page.locator("[data-main-tree-edge-drop]")).toHaveCount(0);
  });

  test("拖到末行下方空白处松手 → 置底（根级末项）", async ({ page }) => {
    const fixture = await bootMainTree(page);

    await dragRowTo(
      page,
      fixture.frontmatterId,
      await edgeTarget(page, "bottom-blank"),
    );

    await expect
      .poll(async () => (await rootRowIds(page)).at(-1))
      .toBe(fixture.frontmatterId);
  });

  test("拖到列表下方越界处松手 → 置底（根级末项）", async ({ page }) => {
    const fixture = await bootMainTree(page);

    await dragRowTo(
      page,
      fixture.frontmatterId,
      await edgeTarget(page, "bottom"),
    );

    await expect
      .poll(async () => (await rootRowIds(page)).at(-1))
      .toBe(fixture.frontmatterId);
  });

  test("末行是展开文件夹的子项时，下缘落点仍是根级末位", async ({ page }) => {
    const fixture = await bootMainTree(page);

    // 先把文件夹移到根级末位，再展开，让“末行”真的是该文件夹的子项
    await dragRowTo(page, fixture.folderId, await edgeTarget(page, "bottom"));
    await expect
      .poll(async () => (await rootRowIds(page)).at(-1))
      .toBe(fixture.folderId);

    // 拖到末位后 rct 会顺手展开该文件夹；未展开时补一次点击
    await ensureFolderExpanded(page, fixture.folderId, fixture.nestedId);
    await expect.poll(() => lastVisibleItemId(page)).toBe(fixture.nestedId);

    await dragRowTo(
      page,
      fixture.hasTitleId,
      await edgeTarget(page, "bottom-blank"),
    );

    await expect
      .poll(async () => (await rootRowIds(page)).at(-1))
      .toBe(fixture.hasTitleId);
    expect(await parentIdOf(page, fixture.hasTitleId)).toBeNull();
  });

  test("中部拖到文件夹行仍是拖入该文件夹", async ({ page }) => {
    const fixture = await bootMainTree(page);
    const folder = page.locator(`[data-rct-item-id="${fixture.folderId}"]`).first();
    const box = await folder.boundingBox();
    if (!box) throw new Error("folder row not visible");

    await dragRowTo(page, fixture.frontmatterId, {
      x: box.x + 80,
      y: box.y + box.height / 2,
    });

    await expect
      .poll(() => parentIdOf(page, fixture.frontmatterId))
      .toBe(fixture.folderId);
  });

  test("横向拖到编辑区不置顶", async ({ page }) => {
    const fixture = await bootMainTree(page);
    const viewport = await listBox(page);
    const before = await rootRowIds(page);

    await dragRowTo(page, fixture.richId, {
      x: viewport.x + viewport.width + 320,
      y: viewport.y - 40,
    });

    await page.waitForTimeout(300);
    expect(await rootRowIds(page)).toEqual(before);
  });
});
