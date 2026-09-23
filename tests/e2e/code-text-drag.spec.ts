import { expect, test } from "playwright/test";

test("selected lines move into an existing code block as text", async ({
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
  const skipSetup = page.getByRole("button", { name: "暂时跳过" });
  if (await skipSetup.isVisible()) await skipSetup.click();
  await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    editor.replaceBlocks(editor.document, [
      { type: "heading", props: { level: 1 }, content: "Drag example" },
      { type: "paragraph", content: "first line" },
      { type: "bulletListItem", content: "second line" },
      { type: "codeBlock", content: "existing" },
    ]);
  });
  const first = await page
    .getByText("first line", { exact: true })
    .boundingBox();
  const second = await page
    .getByText("second line", { exact: true })
    .boundingBox();
  if (!first || !second) throw Error("text not rendered");
  await page.mouse.move(first.x + 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    second.x + second.width - 2,
    second.y + second.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(await page.evaluate(() => getSelection()?.toString())).toContain(
    "second line",
  );
  await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    editor.transact((tr: any) => {
      let from = -1,
        to = -1;
      tr.doc.descendants((node: any, pos: number) => {
        if (node.type.name !== "blockContainer") return true;
        const text = node.textContent;
        if (text === "first line") from = pos + 2;
        if (text === "second line") to = pos + 2 + node.firstChild.content.size;
        return true;
      });
      if (from < 0 || to < 0) throw Error("selection missing");
      tr.setSelection(tr.selection.constructor.create(tr.doc, from, to));
    });
    editor.focus();
  });
  const source = page.getByText("second line", { exact: true });
  const destination = page
    .locator(".goose-code-pre:not(.goose-code-pre-hidden)")
    .first();
  await expect(source).toBeVisible();
  await expect(destination).toBeVisible();
  const a = await source.boundingBox(),
    b = await destination.boundingBox();
  if (!a || !b) throw Error("drag endpoints missing");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 30, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const blocks = (window as any).__gooseNoteEditor.document;
        return blocks
          .find((block: any) => block.type === "codeBlock")
          ?.content?.map((part: any) => part.text)
          .join("");
      }),
    )
    .toContain("first line");
  const result = await page.evaluate(
    () => (window as any).__gooseNoteEditor.document,
  );
  const code = result
    .find((block: any) => block.type === "codeBlock")!
    .content.map((part: any) => part.text)
    .join("");
  expect(code).toContain("second line");
  expect(code.replace(/first line[\s\S]*?second line/, "")).toBe("existing");
  expect(
    result
      .filter((block: any) => block.type !== "codeBlock")
      .map((block: any) => JSON.stringify(block.content))
      .join(" "),
  ).not.toContain("second line");
});
