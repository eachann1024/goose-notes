import { expect, test } from "playwright/test";

test("side-menu plus adds and dedicated handle moves blocks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__GOOSE_E2E__ = true;
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(
    () => window.__GOOSE_TEST__?.getPagesState().hydrated && window.__gooseTest,
  );
  await page.evaluate(async () => {
    const h = window.__gooseTest!;
    const { notebookId } = await h.setupMockNotebook();
    const id = await h.stores.usePages
      .getState()
      .createLocalPage(undefined, notebookId);
    if (!id) throw Error("page missing");
    window.__GOOSE_TEST__!.openPermanentTab(id, true);
  });
  await page.waitForFunction(() => Boolean((window as any).__gooseNoteEditor));
  const skip = page.getByRole("button", { name: "暂时跳过" });
  if (await skip.isVisible()) await skip.click();
  await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    editor.replaceBlocks(editor.document, [
      { type: "heading", props: { level: 1 }, content: "Drag example" },
      { type: "bulletListItem", content: "first line" },
      { type: "bulletListItem", content: "second line" },
      { type: "bulletListItem", content: "third line" },
    ]);
  });
  const source = page
    .locator(".bn-editor")
    .getByText("first line", { exact: true });
  const target = page
    .locator(".bn-editor")
    .getByText("second line", { exact: true });
  const sourceBox = await source.boundingBox(),
    targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw Error("text missing");
  await page.mouse.move(sourceBox.x + 12, sourceBox.y + sourceBox.height / 2);
  const control = page.getByRole("button", { name: "添加块" });
  const dragHandle = page.getByRole("button", { name: "拖动移动块" });
  await expect(control).toBeVisible();
  await expect(dragHandle).toBeVisible();
  const handle = await dragHandle.boundingBox();
  if (!handle) throw Error("handle missing");
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  // A normal gesture starts vertically; don't prime native drag by moving right first.
  await page.mouse.move(
    handle.x + handle.width / 2,
    targetBox.y + targetBox.height + 8,
    { steps: 25 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__gooseNoteEditor.document.map((b: any) =>
          b.content?.map((part: any) => part.text).join(""),
        ),
      ),
    )
    .toEqual(["Drag example", "second line", "first line", "third line"]);
  const before = await page.evaluate(
    () => (window as any).__gooseNoteEditor.document.length,
  );
  await source.hover({ position: { x: 12, y: sourceBox.height / 2 } });
  await control.click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__gooseNoteEditor.document.length),
    )
    .toBe(before + 1);
});
