import { expect, test } from "playwright/test";

test("行内代码行首按 End 停在本行末，不跳到笔记末尾", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__GOOSE_E2E__ = true;
  });
  await page.goto("/?e2eLocalMock");
  await page.waitForFunction(
    () => (window as any).__GOOSE_TEST__?.getPagesState().hydrated,
  );
  await page.evaluate(async () => {
    const w = window as any;
    const { notebookId } = await w.__gooseTest.setupMockNotebook();
    const id = await w.__gooseTest.stores.usePages
      .getState()
      .createLocalPage(undefined, notebookId);
    w.__GOOSE_TEST__.openPermanentTab(id, true);
  });
  await page.waitForFunction(() => !!(window as any).__gooseNoteEditor);
  await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    editor.replaceBlocks(editor.document, [
      { id: "title", type: "heading", props: { level: 1 }, content: "123" },
      {
        id: "cmd",
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "npx --no-install devecocli emulator start phone1",
            styles: { code: true },
          },
        ],
      },
      { id: "tail", type: "paragraph", content: "后面还有很多内容" },
    ]);
    editor.setTextCursorPosition("cmd", "start");
    editor.focus();
  });

  await page.locator('[data-id="cmd"] .bn-inline-content').click({
    position: { x: 8, y: 8 },
  });
  await page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    editor.setTextCursorPosition("cmd", "start");
    editor.focus();
  });
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowRight" : "End",
  );

  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = (window as any).__gooseNoteEditor;
        const { selection, doc } = editor.prosemirrorState;
        const $head = selection.$head;
        return {
          blockId: editor.getTextCursorPosition().block.id,
          offset: $head.parentOffset,
          parentSize: $head.parent.content.size,
          atDocEnd: selection.head >= doc.content.size - 1,
        };
      }),
    )
    .toEqual({
      blockId: "cmd",
      offset: "npx --no-install devecocli emulator start phone1".length,
      parentSize: "npx --no-install devecocli emulator start phone1".length,
      atDocEnd: false,
    });
});
