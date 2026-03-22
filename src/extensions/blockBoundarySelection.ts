import { Selection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export type BlockBoundaryTarget = "before" | "after" | "end";

export function moveSelectionToBlockBoundary(
  view: EditorView,
  blockPos: number,
  target: BlockBoundaryTarget,
) {
  const { state } = view;
  const { doc, tr } = state;
  const blockNode = doc.nodeAt(blockPos);

  if (!blockNode) return false;

  let resolvePos = blockPos;
  let bias = 1;

  if (target === "before") {
    if (blockPos <= 0) return false;
    resolvePos = blockPos - 1;
    bias = -1;
  } else if (target === "after") {
    const afterPos = blockPos + blockNode.nodeSize;
    if (afterPos >= doc.content.size) return false;
    resolvePos = afterPos + 1;
  } else {
    resolvePos = Math.max(1, blockPos + blockNode.nodeSize - 1);
    bias = -1;
  }

  try {
    tr.setSelection(Selection.near(doc.resolve(resolvePos), bias));
    view.dispatch(tr);
    return true;
  } catch {
    return false;
  }
}
