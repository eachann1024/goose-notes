import { readFileSync } from "node:fs";
import { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import { expect, test } from "playwright/test";
import { editorSchema } from "../../src/components/editor/core/schema";
import {
  applyHeldColorPatch,
  isColorSwatchSelected,
  resolveHeldColorState,
  resolveHeldTextSelection,
  resolveOpenColorState,
  selectionUsesLastFormatColors,
} from "../../src/components/editor/toolbars/formatting/ColorPicker";
import {
  restoreTextSelectionRange,
  withPreservedSelection,
} from "../../src/components/editor/toolbars/formatting/helpers";

test("clears when the selection already uses both remembered colors", () => {
  expect(
    selectionUsesLastFormatColors(
      { textColor: "red", backgroundColor: "yellow" },
      { textColor: "red", backgroundColor: "yellow" },
    ),
  ).toBe(true);
});

test("applies remembered colors when either side differs", () => {
  expect(
    selectionUsesLastFormatColors(
      { textColor: "red", backgroundColor: "blue" },
      { textColor: "red", backgroundColor: "yellow" },
    ),
  ).toBe(false);
});

test("compares only the remembered side", () => {
  expect(
    selectionUsesLastFormatColors(
      { textColor: "purple", backgroundColor: "blue" },
      { textColor: "purple" },
    ),
  ).toBe(true);
});

test("does not clear when no previous color is remembered", () => {
  expect(
    selectionUsesLastFormatColors(
      { textColor: "default", backgroundColor: "default" },
      {},
    ),
  ).toBe(false);
});

test("keeps the last non-empty text range when the live selection collapses", () => {
  expect(
    resolveHeldTextSelection({ empty: false, from: 12, to: 20 }, null),
  ).toEqual({ from: 12, to: 20 });
  expect(
    resolveHeldTextSelection(
      { empty: true, from: 20, to: 20 },
      { from: 12, to: 20 },
    ),
  ).toEqual({ from: 12, to: 20 });
});

test("keeps the last color state when the live selection is gone", () => {
  const live = { textColor: "default", backgroundColor: "default" };
  const held = { textColor: "red", backgroundColor: "yellow" };
  expect(resolveHeldColorState(live, held, true)).toEqual(live);
  expect(resolveHeldColorState(live, held, false)).toEqual(held);
});

test("keeps both panel highlights while the picker is open", () => {
  const live = { textColor: "default", backgroundColor: "default" };
  const held = { textColor: "red", backgroundColor: "yellow" };
  expect(resolveOpenColorState(live, held, true)).toEqual(held);
  expect(resolveOpenColorState(live, held, false)).toEqual(live);
  expect(applyHeldColorPatch(held, { backgroundColor: "blue" })).toEqual({
    textColor: "red",
    backgroundColor: "blue",
  });
  expect(isColorSwatchSelected("red", "red")).toBe(true);
  expect(isColorSwatchSelected("default", "default")).toBe(true);
  expect(isColorSwatchSelected("__mixed__", "red")).toBe(false);
});

test("restores a collapsed selection before applying color and keeps the range", () => {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [
      { id: "p1", type: "paragraph", content: "选中这段文字" },
    ] as any,
  });
  let range: { from: number; to: number } | null = null;
  editor.prosemirrorState.doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      range = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return range == null;
  });
  if (!range) throw new Error("missing text");

  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
  });
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, range.to));
  });
  expect(editor.prosemirrorState.selection.empty).toBe(true);

  expect(restoreTextSelectionRange(editor, range)).toBe(true);
  withPreservedSelection(editor, () => {
    editor.addStyles({ textColor: "red" });
  });

  expect(editor.prosemirrorState.selection.empty).toBe(false);
  expect(editor.prosemirrorState.selection.from).toBe(range.from);
  expect(editor.prosemirrorState.selection.to).toBe(range.to);
});

test("color picker and toolbar keep selection while the below panel is open", () => {
  const picker = readFileSync(
    new URL(
      "../../src/components/editor/toolbars/formatting/ColorPicker.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const toolbar = readFileSync(
    new URL(
      "../../src/components/editor/toolbars/formatting/index.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  expect(picker).toContain("setFakeSelection");
  expect(picker).toContain("applyWithHeldSelection");
  expect(picker).toContain("isMounted ||");
  expect(toolbar).toContain("!colorPickerOpen");
});
