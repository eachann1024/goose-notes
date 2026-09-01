import { expect, test, type Page } from "playwright/test";

// 验证「光标折叠在块内 Ctrl/Cmd+C 复制整块 → 粘贴」后，
// 块类型与内联格式（bold/软换行）都完整还原。
// 这是 Electron 桌面端反馈的「复制块再粘贴全变纯文本」问题的回归测试。
// 粘贴产物位置：块级粘贴会插到「目标段落」之后，即 doc[targetIdx + 1]。

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
  return { blockText, hasBoldText };
}

// Node 侧断言用的副本（实现保持一致）。
const { blockText, hasBoldText } = browserHelpers();

const HELPERS = `const { blockText, hasBoldText } = (${browserHelpers.toString()})();`;

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
  await page.evaluate(() => {
    const bridge = (
      window as Window & {
        __GOOSE_TEST__?: {
          createPage: (parentId?: string, workspaceId?: string) => string;
          openPermanentTab: (pageId: string, pin?: boolean) => void;
          getNotebooksState: () => { activeNotebookId: string | null };
        };
      }
    ).__GOOSE_TEST__;
    if (!bridge) throw new Error("Test bridge unavailable");
    const notebookId =
      bridge.getNotebooksState().activeNotebookId ?? "default-notebook";
    const pageId = bridge.createPage(undefined, notebookId);
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

/** 光标折叠放进源块复制整块，再移到目标段落末尾粘贴，返回粘贴后的文档。 */
async function copyThenPaste(page: Page, sourceText: string, targetText: string) {
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

  return (await page.evaluate(`${HELPERS}
    (() => JSON.parse(JSON.stringify((window).__gooseNoteEditor.document)))()
  `)) as Doc;
}

/** 块级粘贴会把产物插在目标段落之后，返回该位置（含越界保护）。 */
function pastedBlockAfterTarget(doc: Doc, targetText: string) {
  const targetIdx = doc.findIndex(
    (block) => blockText(block) === targetText,
  );
  expect(targetIdx, "target block present").toBeGreaterThanOrEqual(0);
  return doc[targetIdx + 1] as Record<string, unknown> | undefined;
}

test.describe("block copy paste keeps formatting", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __GOOSE_E2E__?: boolean }).__GOOSE_E2E__ = true;
    });
    await page.goto("/");
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

    const doc = await copyThenPaste(page, "加粗项目", "目标段落");
    console.log("DOC=" + JSON.stringify(doc));

    const pasted = pastedBlockAfterTarget(doc, "目标段落");
    expect(pasted, "pasted block should exist after target").toBeTruthy();
    expect(pasted!.type).toBe("bulletListItem");
    expect(hasBoldText(pasted!, "加粗项目")).toBe(true);
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
    console.log("DOC=" + JSON.stringify(doc));

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
    console.log("DOC=" + JSON.stringify(doc));

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
});
