import { expect, test } from "playwright/test";
import {
  focusPastedBlock,
  isEmptyInlineBlock,
  pasteBlocksAtCursor,
  type PasteAtCursorEditor,
} from "../../src/components/editor/utils/pasteAtCursor";

function createFakeEditor() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const editor: PasteAtCursorEditor = {
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
    insertBlocks: (blocks, reference, placement) => {
      calls.push({
        method: "insertBlocks",
        args: [blocks, reference, placement],
      });
      return blocks.map((block, index) => ({
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
  return { editor, calls };
}

test("isEmptyInlineBlock：空 paragraph 为 true", () => {
  expect(isEmptyInlineBlock({ type: "paragraph", content: [] })).toBe(true);
  expect(isEmptyInlineBlock({ type: "paragraph", content: "" })).toBe(true);
});

test("isEmptyInlineBlock：void image 即使 content 空也为 false", () => {
  expect(isEmptyInlineBlock({ type: "image", content: [] })).toBe(false);
});

test("isEmptyInlineBlock：type 缺失时仅空数组为 true", () => {
  expect(isEmptyInlineBlock({ content: [] })).toBe(true);
  expect(isEmptyInlineBlock({ content: "" })).toBe(false);
});

test("pasteBlocksAtCursor：空 blocks 返回 null", () => {
  const { editor } = createFakeEditor();
  expect(
    pasteBlocksAtCursor(editor, [], { id: "target", type: "paragraph", content: [] }),
  ).toBeNull();
});

test("pasteBlocksAtCursor：空 paragraph 单块走 updateBlock 并保留 target id", () => {
  const { editor, calls } = createFakeEditor();
  const target = { id: "target", type: "paragraph", content: [] };
  const block = { type: "paragraph", content: "粘贴内容" };

  const result = pasteBlocksAtCursor(editor, [block], target);

  expect(result).toEqual({ id: "target" });
  expect(calls).toEqual([
    { method: "updateBlock", args: [target, block] },
  ]);
});

test("pasteBlocksAtCursor：空 paragraph 多块走 replaceBlocks", () => {
  const { editor, calls } = createFakeEditor();
  const target = { id: "target", type: "paragraph", content: [] };
  const blocks = [
    { type: "paragraph", content: "第一块" },
    { type: "paragraph", content: "第二块" },
  ];

  const result = pasteBlocksAtCursor(editor, blocks, target);

  expect(result).toEqual({ id: "replaced-1" });
  expect(calls).toEqual([
    { method: "replaceBlocks", args: [[target], blocks] },
  ]);
});

test("pasteBlocksAtCursor：非空目标走 insertBlocks after", () => {
  const { editor, calls } = createFakeEditor();
  const target = { id: "target", type: "paragraph", content: "已有内容" };
  const blocks = [{ type: "paragraph", content: "新块" }];

  const result = pasteBlocksAtCursor(editor, blocks, target);

  expect(result).toEqual({ id: "inserted-0" });
  expect(calls).toEqual([
    { method: "insertBlocks", args: [blocks, target, "after"] },
  ]);
});

test("pasteBlocksAtCursor：void image 空 content 走 insertBlocks after", () => {
  const { editor, calls } = createFakeEditor();
  const target = { id: "img", type: "image", content: [] };
  const blocks = [{ type: "paragraph", content: "说明" }];

  const result = pasteBlocksAtCursor(editor, blocks, target);

  expect(result).toEqual({ id: "inserted-0" });
  expect(calls).toEqual([
    { method: "insertBlocks", args: [blocks, target, "after"] },
  ]);
});

test("focusPastedBlock：setTimeout 后设置光标并 focus", async () => {
  const { editor, calls } = createFakeEditor();
  const block = { id: "pasted" };

  focusPastedBlock(editor, block);
  expect(calls).toEqual([]);

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(calls).toEqual([
    { method: "setTextCursorPosition", args: [block, "end"] },
    { method: "focus", args: [] },
  ]);
});

test("focusPastedBlock：setTextCursorPosition 抛错时不向外抛出", async () => {
  const editor = {
    setTextCursorPosition: () => {
      throw new Error("non-text block");
    },
    focus: () => {},
  };

  expect(() => focusPastedBlock(editor, { id: "void" })).not.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 0));
});
