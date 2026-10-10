import {
  Selection,
  TextSelection,
  type SelectionBookmark,
} from "prosemirror-state";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { BlockNoteEditor } from "@blocknote/core";

export function snapshotCurrentSelection(
  editor: BlockNoteEditor<any, any, any>,
) {
  const { selection } = editor.prosemirrorState;
  return { json: selection.toJSON(), bookmark: selection.getBookmark() };
}

export function restoreSelectionAfterFormat(
  editor: BlockNoteEditor<any, any, any>,
  snapshot: { json: any; bookmark?: SelectionBookmark },
) {
  // BlockNote's multiple-node class inherits Selection.fromJSON recursively.
  const resolve = (doc: ProseMirrorNode) =>
    snapshot.json.type === "multiple-node"
      ? (snapshot.bookmark?.resolve(doc) ??
        TextSelection.between(
          doc.resolve(snapshot.json.anchor),
          doc.resolve(snapshot.json.head),
        ))
      : Selection.fromJSON(doc, snapshot.json);
  try {
    const view = editor.prosemirrorView;
    if (view) {
      const sel = resolve(view.state.doc);
      if (!view.state.selection.eq(sel)) {
        view.dispatch(view.state.tr.setSelection(sel));
      }
      return;
    }
    editor.transact((tr) => {
      tr.setSelection(resolve(tr.doc));
    });
  } catch {
    /* 文档结构变了就保持当前选区 */
  }
}

export function restoreTextSelectionRange(
  editor: BlockNoteEditor<any, any, any>,
  range: { from: number; to: number } | null,
): boolean {
  if (!range || range.from === range.to) return false;
  try {
    const view = editor.prosemirrorView;
    if (view) {
      const sel = TextSelection.create(view.state.doc, range.from, range.to);
      if (!view.state.selection.eq(sel)) {
        view.dispatch(view.state.tr.setSelection(sel));
      }
    } else {
      editor.transact((tr) => {
        tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
      });
    }
    return !editor.prosemirrorState.selection.empty;
  } catch {
    return false;
  }
}

export function withPreservedSelection(
  editor: BlockNoteEditor<any, any, any>,
  apply: () => void,
): void {
  const snapshot = snapshotCurrentSelection(editor);
  try {
    editor.focus();
  } catch {
    /* ignore */
  }
  apply();
  restoreSelectionAfterFormat(editor, snapshot);
}
