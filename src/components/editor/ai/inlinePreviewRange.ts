import type { Node as ProseMirrorNode } from "prosemirror-model";

/** Keep unselected children and gaps outside the highlighted range. */
export function groupInlinePreviewRanges<T extends { blockFrom: number }>(
  doc: ProseMirrorNode,
  parts: T[],
): T[][] {
  const selected = new Map(parts.map((part) => [part.blockFrom, part]));
  const groups: T[][] = [];
  let group: T[] | undefined;
  doc.descendants((node, pos, parent) => {
    if (parent?.type.name !== "blockContainer") return true;
    if (node.type.name === "blockGroup") return true;
    const part = selected.get(pos);
    if (!part) { group = undefined; return false; }
    if (!group) { group = []; groups.push(group); }
    group.push(part);
    return false;
  });
  return groups;
}
