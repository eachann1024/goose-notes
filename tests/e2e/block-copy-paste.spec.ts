import { expect, test, type Page } from "playwright/test";

// 验证「完整选中块正文 Ctrl/Cmd+C → 粘贴」后块类型与内联格式完整还原。
// 折叠光标 Cmd+C 复制当前块（与显式选中整块正文相同的块级剪贴板 MIME）。
// 粘贴到空 inline 块：就地替换，不在下方再插一块；光标落在粘贴产物末尾。
// 非空目标段落：块级粘贴插在目标段落之后（doc[targetIdx + 1]）。

// helper 会被序列化进浏览器上下文执行，必须自包含。
function browserHelpers() {
  function blockText(block: Record<string, unknown>): string {
    const content = (block as { content?: unknown }).content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  function hasBoldText(block: Record<string, unknown>, text: string): boolean {
    const content = (block as { content?: unknown }).content;
    if (!Array.isArray(content)) return false;
    return content.some((item) => {
      const node = item as { text?: string; styles?: { bold?: boolean } };
      return node?.text === text && node?.styles?.bold === true;
    });
  }
  function hasTextColor(
    block: Record<string, unknown>,
    text: string,
    color: string,
  ): boolean {
    const content = (block as { content?: unknown }).content;
    if (!Array.isArray(content)) return false;
    return content.some((item) => {
      const node = item as {
        text?: string;
        styles?: { textColor?: string };
      };
      return node?.text === text && node?.styles?.textColor === color;
    });
  }
  /** 用 ProseMirror TextSelection 覆盖 blockContainer 整块正文（非折叠光标）。 */
  function selectFullBlockText(
    editor: {
      document: Array<Record<string, unknown>>;
      transact: (fn: (tr: {
        doc: {
          descendants: (
            fn: (
              node: {
                type: { name: string };
                attrs: { id?: unknown };
                isTextblock?: boolean;
                content: { size: number };
              },
              pos: number,
            ) => boolean | void,
          ) => void;
          nodeAt: (pos: number) => {
            isTextblock?: boolean;
            content: { size: number };
          } | null;
        };
        selection: { constructor: { create: (doc: unknown, from: number, to: number) => unknown } };
        setSelection: (sel: unknown) => void;
      }) => void) => void;
      focus: () => void;
    },
    text: string,
  ) {
    const block = editor.document.find((b) => blockText(b) === text);
    if (!block) throw new Error("block missing: " + text);
    const blockId = String(block.id);
    editor.transact((tr) => {
      let blockPos = -1;
      tr.doc.descendants((node, pos) => {
        if (node.type.name !== "blockContainer") return true;
        if (String(node.attrs.id) !== blockId) return true;
        blockPos = pos;
        return false;
      });
      if (blockPos < 0) throw new Error("blockContainer missing: " + blockId);
      const contentNode = tr.doc.nodeAt(blockPos + 1);
      if (!contentNode?.isTextblock) throw new Error("not textblock: " + blockId);
      const contentFrom = blockPos + 2;
      const contentTo = contentFrom + contentNode.content.size;
      const TextSelection = tr.selection.constructor;
      tr.setSelection(TextSelection.create(tr.doc, contentFrom, contentTo));
    });
    editor.focus();
  }
  function findEmptyParagraph(
    doc: Array<Record<string, unknown>>,
  ): Record<string, unknown> | undefined {
    return doc.find(
      (block) => block.type === "paragraph" && blockText(block) === "",
    );
  }
  return { blockText, hasBoldText, hasTextColor, selectFullBlockText, findEmptyParagraph };
}

// Node 侧断言用的副本（实现保持一致）。
const { blockText, hasBoldText, hasTextColor, findEmptyParagraph } =
  browserHelpers();

const HELPERS = `const { blockText, hasBoldText, hasTextColor, selectFullBlockText, findEmptyParagraph } = (${browserHelpers.toString()})();`;

type Doc = Array<Record<string, unknown>>;

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const bridge = (
      window as Window & {
        __GOOSE_TEST__?: { getPagesState: () => { hydrated: boolean } };
      }
    ).__GOOSE_TEST__;
    return Boolean(bridge?.getPagesState().hydrated);
  });
}

async function openEditorPage(page: Page) {
  await page.waitForFunction(() => Boolean(window.__gooseTest));
  await page.evaluate(async () => {
    const harness = window.__gooseTest;
    const bridge = window.__GOOSE_TEST__;
    if (!harness || !bridge) throw new Error("Local test harness unavailable");
    const { notebookId } = await harness.setupMockNotebook();
    const pageId = await harness.stores.usePages.getState().createLocalPage(undefined, notebookId);
    if (!pageId) throw new Error("Could not create a local test page");
    bridge.openPermanentTab(pageId, true);
  });
  await page.waitForFunction(() =>
    Boolean(
      (window as unknown as { __gooseNoteEditor?: unknown }).__gooseNoteEditor,
    ),
  );
  await page.waitForSelector(".bn-editor", { timeout: 30_000 });
}

async function setupBlocks(page: Page, blocks: unknown[]) {
  await page.evaluate(
    ({ blocks }) => {
      const editor = (
        window as unknown as {
          __gooseNoteEditor: {
            document: Array<Record<string, unknown>>;
            replaceBlocks: (remove: unknown[], add: unknown[]) => unknown;
          };
        }
      ).__gooseNoteEditor;
      editor.replaceBlocks(editor.document, blocks);
    },
    { blocks },
  );
  // 等 replaceBlocks 渲染完成：物理首块 H1 文本可见即视为就绪
  const first = blockText(blocks[0] as Record<string, unknown>);
  await page.waitForFunction(
    `${HELPERS}
     (() => (window).__gooseNoteEditor.document.some(
       (block) => blockText(block).includes(${JSON.stringify(first)}),
     ))()`,
  );
}

async function getDocument(page: Page): Promise<Doc> {
  return (await page.evaluate(`${HELPERS}
    (() => JSON.parse(JSON.stringify((window).__gooseNoteEditor.document)))()
  `)) as Doc;
}

/** 完整选中源块正文后复制，再移到目标段落末尾粘贴，返回粘贴后的文档。 */
async function copyThenPaste(page: Page, sourceText: string, targetText: string) {
  await page.evaluate(
    `${HELPERS}
     (() => {
       const editor = (window).__gooseNoteEditor;
       selectFullBlockText(editor, ${JSON.stringify(sourceText)});
     })()
   `,
  );
  await page.keyboard.press("ControlOrMeta+c");
  await page.waitForTimeout(300);

  await page.evaluate(
    `${HELPERS}
     (() => {
       const editor = (window).__gooseNoteEditor;
       const target = ${
         targetText === ""
           ? `findEmptyParagraph(editor.document)`
           : `editor.document.find(
         (block) => blockText(block) === ${JSON.stringify(targetText)},
       )`
       };
       if (!target) throw new Error("target block missing: " + ${JSON.stringify(targetText)});
       editor.setTextCursorPosition(target, "end");
       editor.focus();
     })()
   `,
  );
  await page.keyboard.press("ControlOrMeta+v");
  await page.waitForTimeout(800);

  return getDocument(page);
}

/** 折叠光标在源块内复制，再移到目标段落末尾粘贴。 */
async function copyCollapsedThenPaste(
  page: Page,
  sourceText: string,
  targetText: string,
) {
  // 系统剪贴板跨浏览器 context 保留；空选区复制不应粘贴上一条用例的内容。
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.evaluate(
    `${HELPERS}
     (() => {
       const editor = (window).__gooseNoteEditor;
       const source = editor.document.find(
         (block) => blockText(block) === ${JSON.stringify(sourceText)},
       );
       if (!source) throw new Error("source block missing: " + ${JSON.stringify(sourceText)});
       editor.setTextCursorPosition(source, "end");
       editor.focus();
     })()
   `,
  );
  await page.keyboard.press("ControlOrMeta+c");
  await page.waitForTimeout(300);

  await page.evaluate(
    `${HELPERS}
     (() => {
       const editor = (window).__gooseNoteEditor;
       const target = editor.document.find(
         (block) => blockText(block) === ${JSON.stringify(targetText)},
       );
       if (!target) throw new Error("target block missing: " + ${JSON.stringify(targetText)});
       editor.setTextCursorPosition(target, "end");
       editor.focus();
     })()
   `,
  );
  await page.keyboard.press("ControlOrMeta+v");
  await page.waitForTimeout(500);

  return getDocument(page);
}

/** 块级粘贴会把产物插在目标段落之后，返回该位置（含越界保护）。 */
function pastedBlockAfterTarget(doc: Doc, targetText: string) {
  const targetIdx = doc.findIndex(
    (block) => blockText(block) === targetText,
  );
  expect(targetIdx, "target block present").toBeGreaterThanOrEqual(0);
  return doc[targetIdx + 1] as Record<string, unknown> | undefined;
}

async function waitForCursorOnBlock(
  page: Page,
  blockId: string,
  timeout = 5_000,
) {
  await page.waitForFunction(
    (expectedId) => {
      const editor = (
        window as unknown as {
          __gooseNoteEditor?: {
            getTextCursorPosition: () => { block: { id: string } };
          };
        }
      ).__gooseNoteEditor;
      if (!editor) return false;
      try {
        return editor.getTextCursorPosition().block.id === expectedId;
      } catch {
        return false;
      }
    },
    blockId,
    { timeout },
  );
}

test.describe("block copy paste keeps formatting", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __GOOSE_E2E__?: boolean }).__GOOSE_E2E__ = true;
    });
    await page.goto("/?e2eLocalMock");
    await waitForHydration(page);
  });

  test("list block pastes back as a bold bulletListItem", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorPage(page);
    await setupBlocks(page, [
      { type: "heading", content: "复制粘贴测试" },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "加粗项目", styles: { bold: true } }],
      },
      { type: "paragraph", content: "目标段落" },
    ]);

    const sourceId = await page.evaluate(
      `${HELPERS}
       (() => {
         const editor = (window).__gooseNoteEditor;
         const source = editor.document.find((b) => blockText(b) === "加粗项目");
         return source?.id ?? null;
       })()`,
    );

    const doc = await copyThenPaste(page, "加粗项目", "目标段落");

    const pasted = pastedBlockAfterTarget(doc, "目标段落");
    expect(pasted, "pasted block should exist after target").toBeTruthy();
    expect(pasted!.type).toBe("bulletListItem");
    expect(hasBoldText(pasted!, "加粗项目")).toBe(true);

    await waitForCursorOnBlock(page, pasted!.id as string);
    const cursorId = await page.evaluate(
      () =>
        (
          window as unknown as {
            __gooseNoteEditor: {
              getTextCursorPosition: () => { block: { id: string } };
            };
          }
        ).__gooseNoteEditor.getTextCursorPosition().block.id,
    );
    expect(cursorId).toBe(pasted!.id);
    expect(cursorId).not.toBe(sourceId);
  });

  test("heading block pastes back as a level-2 heading", async ({ page }) => {
    test.setTimeout(120_000);
    await openEditorPage(page);
    await setupBlocks(page, [
      { type: "heading", content: "复制粘贴测试" },
      { type: "paragraph", content: "目标段落" },
      {
        type: "heading",
        props: { level: 2 },
        content: [
          { type: "text", text: "二级", styles: { bold: true } },
          { type: "text", text: "标题" },
        ],
      },
    ]);

    const doc = await copyThenPaste(page, "二级标题", "目标段落");

    const pasted = pastedBlockAfterTarget(doc, "目标段落");
    expect(pasted, "pasted block should exist after target").toBeTruthy();
    expect(pasted!.type).toBe("heading");
    expect((pasted!.props as { level?: number } | undefined)?.level).toBe(2);
    expect(hasBoldText(pasted!, "二级")).toBe(true);
  });

  test("multi-line rich paragraph keeps bold and line break", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openEditorPage(page);
    await setupBlocks(page, [
      { type: "heading", content: "复制粘贴测试" },
      { type: "paragraph", content: "目标段落" },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "第一行", styles: { bold: true } },
          { type: "text", text: "\n第二行" },
        ],
      },
    ]);

    const doc = await copyThenPaste(page, "第一行\n第二行", "目标段落");

    const pasted = pastedBlockAfterTarget(doc, "目标段落");
    expect(pasted, "pasted block should exist after target").toBeTruthy();
    expect(pasted!.type).toBe("paragraph");
    // bold 片段实际为「第一行\n」（软换行并入 bold 段），按前缀匹配
    const boldFirstLine = (
      (pasted!.content as Array<{ text?: string; styles?: { bold?: boolean } }> | undefined) ?? []
    ).some(
      (node) =>
        typeof node?.text === "string" &&
        node.text.startsWith("第一行") &&
        node.styles?.bold === true,
    );
    expect(boldFirstLine).toBe(true);
    expect(blockText(pasted!)).toContain("第二行");
  });

  test("collapsed cursor copy pastes current block after target", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openEditorPage(page);
    await setupBlocks(page, [
      { type: "heading", content: "复制粘贴测试" },
      {
        type: "bulletListItem",
        content: [{ type: "text", text: "加粗项目", styles: { bold: true } }],
      },
      { type: "paragraph", content: "目标段落" },
    ]);

    const countBefore = (await getDocument(page)).length;
    const doc = await copyCollapsedThenPaste(page, "加粗项目", "目标段落");

    expect(doc.length).toBe(countBefore + 1);
    const pasted = pastedBlockAfterTarget(doc, "目标段落");
    expect(pasted, "pasted block should exist after target").toBeTruthy();
    expect(pasted!.type).toBe("bulletListItem");
    expect(hasBoldText(pasted!, "加粗项目")).toBe(true);
    const matches = doc.filter((block) => blockText(block) === "加粗项目");
    expect(matches).toHaveLength(2);
  });

  test("paste into empty paragraph replaces in place with block colors", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openEditorPage(page);
    await setupBlocks(page, [
      { type: "heading", content: "复制粘贴测试" },
      { type: "paragraph", content: "" },
      {
        type: "heading",
        props: { level: 2, backgroundColor: "yellow" },
        content: [
          {
            type: "text",
            text: "鸿蒙开发",
            styles: { bold: true, textColor: "orange" },
          },
        ],
      },
    ]);

    const emptyBlockId = await page.evaluate(
      `${HELPERS}
       (() => {
         const empty = findEmptyParagraph((window).__gooseNoteEditor.document);
         return empty?.id ?? null;
       })()`,
    );
    expect(emptyBlockId).toBeTruthy();

    const countBefore = (await getDocument(page)).length;
    const doc = await copyThenPaste(page, "鸿蒙开发", "");

    expect(doc.length).toBe(countBefore);
    const replaced = doc.find((block) => block.id === emptyBlockId);
    expect(replaced, "empty paragraph should be replaced in place").toBeTruthy();
    expect(blockText(replaced!)).toBe("鸿蒙开发");
    expect(replaced!.type).toBe("heading");
    expect((replaced!.props as { level?: number; backgroundColor?: string })?.level).toBe(2);
    expect(
      (replaced!.props as { backgroundColor?: string })?.backgroundColor,
    ).toBe("yellow");
    expect(hasBoldText(replaced!, "鸿蒙开发")).toBe(true);
    expect(hasTextColor(replaced!, "鸿蒙开发", "orange")).toBe(true);

    const harmonyBlocks = doc.filter((block) => blockText(block) === "鸿蒙开发");
    expect(harmonyBlocks).toHaveLength(2);

    await waitForCursorOnBlock(page, emptyBlockId as string);
  });
});
