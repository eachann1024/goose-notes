import { expect, test } from "bun:test";
import { BlockNoteEditor } from "@blocknote/core";
import { EditorState, Selection, TextSelection } from "@tiptap/pm/state";
import { history, undo, redo, undoDepth } from "@tiptap/pm/history";
import { PageUndoHistory } from "./pageUndoHistory";

// Resolve the private registered BlockNote constructor without entering its
// inherited recursive JSON decoder, then construct the actual selection class.
function multipleNodeSelection(doc, from, to) {
  const decode = Selection.fromJSON;
  let constructor;
  Selection.fromJSON = function () { constructor = this; return null; };
  try { decode.call(Selection, doc, { type: "multiple-node" }); }
  finally { Selection.fromJSON = decode; }
  return constructor.create(doc, from, to);
}
function state() {
  const editor = BlockNoteEditor.create({ initialContent: [
    { id: "a", type: "paragraph", content: "first", children: [
      { id: "child", type: "paragraph", content: "nested" },
    ] },
    { id: "b", type: "paragraph", content: "second" },
  ] });
  return EditorState.create({ doc: editor.prosemirrorState.doc, plugins: [history()] });
}
for (const remount of [false, true]) {
  test(`real BlockNote multiple-node selection restores safely (${remount ? "new schema" : "same schema"})`, () => {
    const initial = state();
    let edited = initial.apply(initial.tr.insertText("!", 3));
    const selection = multipleNodeSelection(edited.doc, 1, edited.doc.content.size - 1);
    expect(selection.toJSON().type).toBe("multiple-node");
    expect(selection.nodes.map((node) => node.attrs.id)).toEqual(["a", "b"]);
    edited = edited.apply(edited.tr.setSelection(selection));
    const cache = new PageUndoHistory();
    cache.visit("a"); cache.save("a", edited, "edited"); cache.visit("b");
    const fresh = remount ? state() : initial;
    expect(fresh.schema === initial.schema).toBe(!remount);
    let restored = cache.restore("a", fresh, "edited");
    expect(restored.doc.toJSON()).toEqual(edited.doc.toJSON());
    expect(restored.schema).toBe(fresh.schema);
    expect(restored.selection instanceof TextSelection).toBe(true);
    expect(restored.selection.$from.parent.isTextblock).toBe(true);
    expect(restored.selection.$to.parent.isTextblock).toBe(true);
    expect(restored.selection.$from.doc).toBe(restored.doc);
    const expected = selection.getBookmark().resolve(restored.doc);
    expect(restored.selection.eq(expected)).toBe(true);
    expect(undoDepth(restored)).toBe(1);
    expect(undo(restored, (tr) => { restored = restored.apply(tr); })).toBe(true);
    expect(restored.doc.toJSON()).toEqual(initial.doc.toJSON());
    expect(redo(restored, (tr) => { restored = restored.apply(tr); })).toBe(true);
    expect(restored.doc.toJSON()).toEqual(edited.doc.toJSON());
  });
}

const { snapshotCurrentSelection, restoreSelectionAfterFormat } = await import("../toolbars/formatting/helpers");
const { CellSelection } = await import("prosemirror-tables");
for (const withView of [true, false]) {
  test(`formatting restores real multiple-node selection (${withView ? "view" : "transaction"})`, () => {
    const initial = state();
    const selection = multipleNodeSelection(initial.doc, 1, initial.doc.content.size - 1);
    let current = initial.apply(initial.tr.setSelection(selection));
    const editor = {
      get prosemirrorState() { return current; },
      get prosemirrorView() { return withView ? {
        get state() { return current; }, dispatch(tr) { current = current.apply(tr); },
      } : undefined; },
      transact(fn) { const tr = current.tr; fn(tr); current = current.apply(tr); },
    };
    const snapshot = snapshotCurrentSelection(editor);
    current = current.apply(current.tr.addMark(3, 8, current.schema.marks.bold.create()));
    restoreSelectionAfterFormat(editor, snapshot);
    expect(current.selection instanceof TextSelection).toBe(true);
    expect(current.selection.eq(snapshot.bookmark.resolve(current.doc))).toBe(true);
    expect(current.doc.rangeHasMark(3, 8, current.schema.marks.bold)).toBe(true);
    // Legacy JSON-only callers must also avoid the recursive decoder.
    restoreSelectionAfterFormat(editor, { json: snapshot.json });
    expect(current.selection.$from.parent.isTextblock).toBe(true);
  });
}

test("formatting retains ordinary text and table cell selection behavior", () => {
  const blocknote = BlockNoteEditor.create({ initialContent: [
    { id: "text", type: "paragraph", content: "text" },
    { id: "table", type: "table", content: { type: "tableContent", rows: [{ cells: ["one", "two"] }] } },
  ] });
  let current = EditorState.create({ doc: blocknote.prosemirrorState.doc });
  const cells = [];
  current.doc.descendants((node, pos) => { if (node.type.spec.tableRole === "cell") cells.push(pos); });
  expect(cells.length).toBe(2);
  const editor = {
    get prosemirrorState() { return current; },
    get prosemirrorView() { return { get state() { return current; }, dispatch(tr) { current = current.apply(tr); } }; },
  };
  for (const selection of [TextSelection.create(current.doc, 3, 6), CellSelection.create(current.doc, cells[0], cells[1])]) {
    current = current.apply(current.tr.setSelection(selection));
    const snapshot = snapshotCurrentSelection(editor);
    current = current.apply(current.tr.setSelection(TextSelection.create(current.doc, 3)));
    restoreSelectionAfterFormat(editor, snapshot);
    expect(current.selection.eq(selection)).toBe(true);
  }
});
