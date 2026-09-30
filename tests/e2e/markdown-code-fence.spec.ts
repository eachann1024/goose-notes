import { expect, test } from "playwright/test";

const fixture = [
  { id: "title", type: "heading", content: "围栏转换测试" },
  { id: "open", type: "paragraph", content: "```markdown" },
  { id: "body", type: "paragraph", content: "必须处理" },
  { id: "unchecked", type: "checkListItem", props: { checked: false }, content: "扫码：相机权限 + 扫条码/二维码" },
  { id: "checked", type: "checkListItem", props: { checked: true }, content: "权限文案", children: [
    { id: "nested", type: "bulletListItem", content: "写进隐私政策" },
  ] },
  { id: "close", type: "paragraph", content: "```" },
  { id: "after", type: "paragraph", content: "围栏外内容" },
];

test.beforeEach(async ({ page }) => {
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
});

test("空格合并成对围栏，保留待办、嵌套内容、外围正文，并可一次撤销", async ({ page }) => {
  const before = await page.evaluate((blocks) => {
    const editor = (window as any).__gooseNoteEditor;
    editor.replaceBlocks(editor.document, blocks);
    editor.setTextCursorPosition("open", "end");
    editor.focus();
    return editor.document;
  }, fixture);
  // 模拟在已有正文中触发，避免初始化夹具与用户输入落入同一历史分组。
  await page.waitForTimeout(600);
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => {
    const editor = (window as any).__gooseNoteEditor;
    return {
      ids: editor.document.map((block: any) => block.id),
      type: editor.getBlock("open").type,
      language: editor.getBlock("open").props.language,
      content: editor.getBlock("open").content,
      cursor: editor.getTextCursorPosition().block.id,
    };
  })).toEqual({
    ids: ["title", "open", "after"],
    type: "codeBlock",
    language: "markdown",
    content: [{ type: "text", text: "必须处理\n\n- [ ] 扫码：相机权限 + 扫条码/二维码\n- [x] 权限文案\n  - 写进隐私政策", styles: {} }],
    cursor: "open",
  });
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => page.evaluate(() => (window as any).__gooseNoteEditor.document)).toEqual(before);
});

for (const scenario of ["unclosed", "nested-close", "suffix", "empty-pair"]) {
  test(`围栏边界：${scenario}`, async ({ page }) => {
    await page.evaluate(({ blocks, scenario }) => {
      const editor = (window as any).__gooseNoteEditor;
      let content: any[] = blocks;
      if (scenario === "unclosed") content = blocks.filter((block) => block.id !== "close");
      if (scenario === "nested-close") content = [blocks[0], blocks[1], {
        ...blocks[2], children: [blocks[5]],
      }, blocks[6]];
      if (scenario === "suffix") content = blocks.map((block) => block.id === "open" ? { ...block, content: "```markdown尾部" } : block);
      if (scenario === "empty-pair") content = [blocks[0], blocks[1], blocks[5], blocks[6]];
      editor.replaceBlocks(editor.document, content);
      editor.setTextCursorPosition("open", "end");
      if (scenario === "suffix") editor.transact((tr: any) => tr.setSelection(tr.selection.constructor.create(tr.doc, tr.selection.from - 2)));
      editor.focus();
    }, { blocks: fixture, scenario });
    await page.keyboard.press("Space");
    await expect(page.locator('[data-id="open"] .goose-code-content')).toBeVisible();
    await expect(page.locator('[data-id="after"] .bn-inline-content')).toHaveText("围栏外内容");
    if (scenario === "empty-pair") {
      await expect(page.locator('[data-id="close"]')).toHaveCount(0);
      await page.keyboard.press("ControlOrMeta+z");
      await expect(page.locator('[data-id="close"]').first()).toBeVisible();
    } else {
      await expect(page.locator('[data-id="body"]').first()).toBeVisible();
      if (scenario !== "unclosed") await expect(page.locator('[data-id="close"]').first()).toBeVisible();
      if (scenario === "unclosed") {
        await page.keyboard.press("Backspace");
        await expect(page.locator('[data-id="open"] .bn-inline-content')).toHaveText("```markdown");
      }
    }
  });
}
