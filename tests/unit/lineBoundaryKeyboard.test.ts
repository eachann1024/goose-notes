import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  lineBoundaryShortcut,
  lineBoundaryTransaction,
  logicalLineEnd,
  logicalLineStart,
  resolveLineBoundaryPos,
} from "../../src/components/editor/extensions/lineBoundaryKeyboardExtension";
import type { CaretCoords } from "../../src/components/editor/extensions/trailingBlankClickExtension";

function key(
  partial: Partial<{
    key: string;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    isComposing: boolean;
  }> & { key: string },
) {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    ...partial,
  };
}

function createEditor() {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "title",
        type: "heading",
        props: { level: 1 },
        content: "123",
      },
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
      {
        id: "tail",
        type: "paragraph",
        content: "后面还有很多内容",
      },
    ] as never,
  });
}

function contentRange(
  editor: ReturnType<typeof createEditor>,
  blockId: string,
) {
  let range: { from: number; to: number } | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") return true;
    if (String(node.attrs.id) !== blockId) return true;
    const textblock = node.firstChild;
    if (!textblock?.isTextblock) return false;
    range = { from: pos + 2, to: pos + 2 + textblock.content.size };
    return false;
  });
  if (!range) throw new Error(`missing block ${blockId}`);
  return range;
}

test("macOS Cmd+←/→ 是行首行尾，Windows 的 Meta 方向键不是", () => {
  expect(
    lineBoundaryShortcut(key({ key: "ArrowRight", metaKey: true }), "mac"),
  ).toEqual({ direction: "end", extend: false });
  expect(
    lineBoundaryShortcut(
      key({ key: "ArrowLeft", metaKey: true, shiftKey: true }),
      "mac",
    ),
  ).toEqual({ direction: "start", extend: true });
  expect(
    lineBoundaryShortcut(key({ key: "ArrowRight", metaKey: true }), "windows"),
  ).toBeNull();
  expect(
    lineBoundaryShortcut(key({ key: "ArrowRight", ctrlKey: true }), "mac"),
  ).toBeNull();
  expect(
    lineBoundaryShortcut(key({ key: "ArrowRight", altKey: true }), "mac"),
  ).toBeNull();
});

test("各平台 Home/End 是行首行尾，Ctrl/Meta 变体放行给文档首尾", () => {
  expect(lineBoundaryShortcut(key({ key: "End" }), "windows")).toEqual({
    direction: "end",
    extend: false,
  });
  expect(
    lineBoundaryShortcut(key({ key: "Home", shiftKey: true }), "linux"),
  ).toEqual({ direction: "start", extend: true });
  expect(
    lineBoundaryShortcut(key({ key: "End", ctrlKey: true }), "windows"),
  ).toBeNull();
  expect(
    lineBoundaryShortcut(key({ key: "Home", metaKey: true }), "mac"),
  ).toBeNull();
});

test("硬换行把逻辑行截在当前行，不会走到下一块", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "code",
        type: "codeBlock",
        content: "first\nsecond\nthird",
      },
      { id: "after", type: "paragraph", content: "尾段" },
    ] as never,
  });
  const range = contentRange(editor, "code");
  const doc = editor.prosemirrorState.doc;
  expect(logicalLineEnd(doc, range.from, range.to)).toBe(range.from + 5);
  expect(logicalLineStart(doc, range.from + 7, range.from)).toBe(
    range.from + 6,
  );
  expect(logicalLineEnd(doc, range.from + 6, range.to)).toBe(range.from + 12);
});

test("视觉折行与硬换行取更近的那一个", () => {
  const twoLineCoords = (pos: number): CaretCoords => {
    if (pos <= 5) {
      return { top: 0, bottom: 20, left: pos * 10, right: pos * 10 + 8 };
    }
    const col = pos - 6;
    return { top: 20, bottom: 40, left: col * 10, right: col * 10 + 8 };
  };
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "wrap", type: "paragraph", content: "0123456789" },
    ] as never,
  });
  const range = contentRange(editor, "wrap");
  const doc = editor.prosemirrorState.doc;
  expect(
    resolveLineBoundaryPos({
      from: range.from + 2,
      start: range.from,
      end: range.to,
      direction: "end",
      doc,
      coordsAtPos: (pos) => twoLineCoords(pos - range.from),
    }),
  ).toBe(range.from + 5);
  expect(
    resolveLineBoundaryPos({
      from: range.from + 8,
      start: range.from,
      end: range.to,
      direction: "start",
      doc,
      coordsAtPos: (pos) => twoLineCoords(pos - range.from),
    }),
  ).toBe(range.from + 6);
});

test("行内代码行首 Cmd+→ 落到本行末，而不是整篇笔记末尾", () => {
  const editor = createEditor();
  const cmd = contentRange(editor, "cmd");
  const tail = contentRange(editor, "tail");
  const state = editor.prosemirrorState;
  const atStart = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, cmd.from)),
  );
  const tr = lineBoundaryTransaction(atStart, "end", false);
  expect(tr).not.toBeNull();
  expect(tr!.selection.head).toBe(cmd.to);
  expect(tr!.selection.head).toBeLessThan(tail.to);
  expect(tr!.selection.empty).toBe(true);
});

test("Shift+行尾把选区扩到本行末，锚点不动", () => {
  const editor = createEditor();
  const cmd = contentRange(editor, "cmd");
  const state = editor.prosemirrorState;
  const atStart = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, cmd.from)),
  );
  const tr = lineBoundaryTransaction(atStart, "end", true);
  expect(tr).not.toBeNull();
  expect(tr!.selection.anchor).toBe(cmd.from);
  expect(tr!.selection.head).toBe(cmd.to);
});

test("代码块行首走到当前逻辑行尾，不停在整个代码块末尾", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      {
        id: "code",
        type: "codeBlock",
        content: "npx start\nsecond line",
      },
      { id: "after", type: "paragraph", content: "尾段" },
    ] as never,
  });
  const range = contentRange(editor, "code");
  const state = editor.prosemirrorState;
  const atStart = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, range.from)),
  );
  const tr = lineBoundaryTransaction(atStart, "end", false);
  expect(tr).not.toBeNull();
  expect(tr!.selection.head).toBe(range.from + "npx start".length);
  expect(tr!.selection.head).toBeLessThan(range.to);
});
