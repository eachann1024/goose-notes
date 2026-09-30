import { expect, test } from "playwright/test";

for (const type of ["codeBlock", "paragraph"]) {
  for (const key of ["Backspace", "Delete"]) {
    test(`${key} 删除 ${type} 内部空行`, async ({ page }) => {
      await page.addInitScript(() => { (window as any).__GOOSE_E2E__ = true; });
      await page.goto("/?e2eLocalMock");
      await page.waitForFunction(() => (window as any).__GOOSE_TEST__?.getPagesState().hydrated);
      await page.evaluate(async () => {
        const w = window as any;
        const { notebookId } = await w.__gooseTest.setupMockNotebook();
        const id = await w.__gooseTest.stores.usePages.getState().createLocalPage(undefined, notebookId);
        w.__GOOSE_TEST__.openPermanentTab(id, true);
      });
      await page.waitForFunction(() => !!(window as any).__gooseNoteEditor);
      await page.evaluate((type) => {
        const editor = (window as any).__gooseNoteEditor;
        editor.replaceBlocks(editor.document, [{ id: "lines", type, content: "上一行" }]);
      }, type);
      await page.locator('[data-id="lines"] .bn-inline-content').click();
      await page.keyboard.press("End");
      await page.keyboard.press(type === "codeBlock" ? "Enter" : "Shift+Enter");
      await page.keyboard.press(type === "codeBlock" ? "Enter" : "Shift+Enter");
      await page.keyboard.type("next");
      // 把光标放到两次真实换行之间，再用真实删除键验证完整处理链。
      await page.evaluate(() => {
        const editor = (window as any).__gooseNoteEditor;
        editor.setTextCursorPosition("lines", "start");
        editor.transact((tr: any) => {
          tr.setSelection(tr.selection.constructor.create(tr.doc, tr.selection.from + 4));
        });
      });
      await page.keyboard.press(key);
      await expect.poll(() => page.evaluate(() => {
        const editor = (window as any).__gooseNoteEditor;
        const { $from } = editor.prosemirrorState.selection;
        return { text: $from.parent.textBetween(0, $from.parent.content.size, "", "\n"), offset: $from.parentOffset, type: editor.getBlock("lines").type };
      })).toEqual({ text: "上一行\nnext", offset: 3, type });
    });
  }
}

for (const key of ["Backspace", "Delete"]) {
  for (const hasPrevious of [false, true]) {
    test(`${key} 删除${hasPrevious ? "标题后的" : "文首"}空行并保留 YAML`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as any).__GOOSE_E2E__ = true;
      });
      await page.goto("/?e2eLocalMock");
      await page.waitForFunction(() => (window as any).__GOOSE_TEST__?.getPagesState().hydrated);
      await page.evaluate(async () => {
        const w = window as any;
        const { notebookId } = await w.__gooseTest.setupMockNotebook();
        const id = await w.__gooseTest.stores.usePages.getState().createLocalPage(undefined, notebookId);
        w.__GOOSE_TEST__.openPermanentTab(id, true);
      });
      await page.waitForFunction(() => !!(window as any).__gooseNoteEditor);
      await page.evaluate((hasPrevious) => {
        const editor = (window as any).__gooseNoteEditor;
        editor.replaceBlocks(editor.document, [
          ...(hasPrevious ? [{ id: "title", type: "heading", content: "上一行" }] : []),
          { id: "blank", type: "paragraph", content: "" },
          { id: "code", type: "codeBlock", props: { language: "yaml" }, content: "name: goose" },
        ]);
        editor.setTextCursorPosition("blank", "start");
        editor.focus();
      }, hasPrevious);

      await page.locator('[data-id="blank"] .bn-block-content').click({ position: { x: 120, y: 10 } });
      await expect.poll(() => page.evaluate(() =>
        (window as any).__gooseNoteEditor.getTextCursorPosition().block.id,
      )).toBe("blank");
      await page.keyboard.press(key);

      await expect.poll(() => page.evaluate(() => {
        const editor = (window as any).__gooseNoteEditor;
        return {
          ids: editor.document.map((block: any) => block.id),
          cursor: editor.getTextCursorPosition().block.id,
          offset: editor.prosemirrorState.selection.$from.parentOffset,
          code: editor.getBlock("code").content,
        };
      })).toEqual({
        ids: hasPrevious ? ["title", "code"] : ["code"],
        cursor: hasPrevious ? "title" : "code",
        offset: hasPrevious ? 3 : 0,
        code: [{ type: "text", text: "name: goose", styles: {} }],
      });
    });
  }
}
