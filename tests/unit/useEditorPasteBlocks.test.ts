import { expect, test } from "playwright/test";
import { GOOSE_BLOCKNOTE_BLOCK_COPY_MIME } from "../../src/components/editor/extensions/copyCurrentBlockExtension";
import {
  finishPasteAtAnchor,
  plainHasGooseMarkdownMarkers,
  resolvePasteAnchor,
  shouldPasteClipboardAsBlocks,
  shouldPasteHtmlAsBlocks,
} from "../../src/components/editor/hooks/useEditorPaste";
import type { PasteAtCursorEditor } from "../../src/components/editor/utils/pasteAtCursor";

function createFakeEditor() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const blocks = new Map<string, { id: string; type?: string; content?: unknown }>();
  const editor: PasteAtCursorEditor & {
    getBlock: (id: string) => { id: string } | undefined;
  } = {
    getBlock: (id) => blocks.get(id),
    updateBlock: (block, update) => {
      calls.push({ method: "updateBlock", args: [block, update] });
      return block;
    },
    replaceBlocks: (blocksToRemove, blocksToInsert) => {
      calls.push({
        method: "replaceBlocks",
        args: [blocksToRemove, blocksToInsert],
      });
      return blocksToInsert.map((block, index) => ({
        ...(typeof block === "object" && block ? block : {}),
        id: `replaced-${index}`,
      }));
    },
    insertBlocks: (inserted, reference, placement) => {
      calls.push({
        method: "insertBlocks",
        args: [inserted, reference, placement],
      });
      return inserted.map((block, index) => ({
        ...(typeof block === "object" && block ? block : {}),
        id: `inserted-${index}`,
      }));
    },
    setTextCursorPosition: (block, placement) => {
      calls.push({ method: "setTextCursorPosition", args: [block, placement] });
    },
    focus: () => {
      calls.push({ method: "focus", args: [] });
    },
  };
  return { editor, calls, blocks };
}

test("shouldPasteHtmlAsBlocks：MIME 或块级 data 属性为 true", () => {
  expect(shouldPasteHtmlAsBlocks("", true)).toBe(true);
  expect(
    shouldPasteHtmlAsBlocks('<p data-background-color="yellow">x</p>'),
  ).toBe(true);
  expect(shouldPasteHtmlAsBlocks('<p data-text-alignment="center">x</p>')).toBe(
    true,
  );
});

test("shouldPasteHtmlAsBlocks：default 块属性与行内 strong 为 false", () => {
  expect(shouldPasteHtmlAsBlocks("<p><strong>bold</strong></p>")).toBe(false);
  expect(shouldPasteHtmlAsBlocks('<span style="color:red">x</span>')).toBe(
    false,
  );
  expect(
    shouldPasteHtmlAsBlocks('<p data-background-color="default">x</p>'),
  ).toBe(false);
  expect(
    shouldPasteHtmlAsBlocks('<p data-text-alignment="left">x</p>'),
  ).toBe(false);
});

test("shouldPasteClipboardAsBlocks：读取 DataTransfer MIME", () => {
  const clipboard = {
    getData: (type: string) =>
      type === GOOSE_BLOCKNOTE_BLOCK_COPY_MIME ? "1" : "",
  } as DataTransfer;
  expect(shouldPasteClipboardAsBlocks(clipboard, "")).toBe(true);
});

test("plainHasGooseMarkdownMarkers：Goose 标记与 style span", () => {
  expect(
    plainHasGooseMarkdownMarkers(
      '<!-- goose-note:block-props=%7B%22v%22%3A1%7D -->',
    ),
  ).toBe(true);
  expect(
    plainHasGooseMarkdownMarkers(
      '<span data-goose-note-block-props="v1">text</span>',
    ),
  ).toBe(true);
  expect(plainHasGooseMarkdownMarkers("**bold** only")).toBe(false);
});

test("resolvePasteAnchor：优先用 getBlock 最新块", () => {
  const target = { id: "a", type: "paragraph", content: [] };
  const live = { id: "a", type: "paragraph", content: "updated" };
  const editor = { getBlock: (id: string) => (id === "a" ? live : undefined) };
  expect(resolvePasteAnchor(editor, target)).toBe(live);
  expect(resolvePasteAnchor({ getBlock: () => undefined }, target)).toBe(target);
});

test("finishPasteAtAnchor：空目标单块走 updateBlock 并 focus", async () => {
  const { editor, calls } = createFakeEditor();
  const target = { id: "t", type: "paragraph", content: [] };
  const block = { type: "paragraph", content: "粘贴" };

  const ok = finishPasteAtAnchor(editor, [block], target);

  expect(ok).toBe(true);
  expect(calls.filter((c) => c.method === "updateBlock")).toHaveLength(1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(calls.some((c) => c.method === "focus")).toBe(true);
});
