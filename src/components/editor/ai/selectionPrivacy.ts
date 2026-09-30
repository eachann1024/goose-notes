import { Fragment, type Node as ProseMirrorNode } from "prosemirror-model";
import { TextSelection, type Selection } from "prosemirror-state";

export interface InlineSelectionPart {
  blockId: string;
  node: ProseMirrorNode;
  ancestors: string[];
  from: number;
  to: number;
  offsetFrom: number;
  offsetTo: number;
}

/** Node selections select their explicit containers, never implicit descendants. */
export function captureInlineSelectionParts(
  doc: ProseMirrorNode,
  selection: Selection,
): InlineSelectionPart[] {
  const { from, to } = selection;
  const textSelection = selection instanceof TextSelection;
  const parts: InlineSelectionPart[] = [];
  const unsupported = () => new Error("选区含表格或非文字块，请只选择正文文字后重试。");
  // Body-wide selection (second Cmd+A) can end between containers instead of
  // inside inline text. Validate those ranges per block below, while still
  // rejecting positions inside tables and other non-inline content.
  if (textSelection && [selection.$from, selection.$to].some((pos) => {
    if (["doc", "blockGroup", "blockContainer"].includes(pos.parent.type.name)) return false;
    return !pos.parent.isTextblock || pos.depth < 2 || pos.node(-1).type.name !== "blockContainer";
  })) throw unsupported();
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "blockContainer") return true;
    const content = node.firstChild;
    const start = pos + 2;
    const end = start + (content?.content.size ?? 0);
    const wholeNode = !textSelection && pos >= from && pos + node.nodeSize <= to;
    const wholeContent = !textSelection && pos + 1 === from && pos + 1 + (content?.nodeSize ?? 0) === to;
    const intersects = textSelection && (from < end && to > start || from === to && from === start);
    if (!content?.isTextblock) {
      if (wholeNode || (pos < to && pos + node.nodeSize > from)) throw unsupported();
      return false;
    }
    if (wholeNode || wholeContent || intersects) {
      const offsetFrom = textSelection ? Math.max(0, from - start) : 0;
      const offsetTo = textSelection ? Math.min(content.content.size, to - start) : content.content.size;
      const resolved = doc.resolve(pos);
      const ancestors: string[] = [];
      for (let depth = 0; depth <= resolved.depth; depth++) {
        if (resolved.node(depth).type.name === "blockContainer") ancestors.push(String(resolved.node(depth).attrs.id));
      }
      if (!node.attrs.id || parts.some((part) => part.blockId === node.attrs.id)) throw unsupported();
      parts.push({ blockId: String(node.attrs.id), node, ancestors, from: start + offsetFrom, to: start + offsetTo, offsetFrom, offsetTo });
      if (!textSelection) return false;
    }
    return true;
  });
  if (!parts.length) throw unsupported();
  return parts;
}

export interface InlineSelectionSnapshot {
  document: ProseMirrorNode;
  from: number;
  to: number;
  replaceFrom: number;
  replaceTo: number;
  sourceNodes: ProseMirrorNode[];
  selectedNodes: ProseMirrorNode[];
  prefix: Fragment;
  suffix: Fragment;
}

/** Freeze character boundaries before the menu takes focus; never expand to words. */
export function captureInlineSelection(
  doc: ProseMirrorNode,
  from: number,
  to: number,
): InlineSelectionSnapshot {
  const start = doc.resolve(from);
  const end = doc.resolve(to);
  if (
    !start.parent.isTextblock ||
    !end.parent.isTextblock ||
    start.depth < 2 ||
    end.depth !== start.depth ||
    start.node(-1).type.name !== "blockContainer" ||
    end.node(-1).type.name !== "blockContainer" ||
    start.before(start.depth - 1) > end.before(end.depth - 1) ||
    start.start(start.depth - 2) !== end.start(end.depth - 2)
  ) {
    throw new Error(
      "请在同一层级的正文块中选择文字后重试；表格或跨层级选区暂不支持行内改写。",
    );
  }
  const replaceFrom = start.before(start.depth - 1);
  const replaceTo = end.after(end.depth - 1);
  const sourceNodes: ProseMirrorNode[] = [];
  const selectedNodes: ProseMirrorNode[] = [];
  const group = start.node(start.depth - 2);
  let pos = start.start(start.depth - 2);
  group.forEach((node) => {
    if (pos >= replaceFrom && pos < replaceTo) {
      const content = node.firstChild;
      if (node.type.name !== "blockContainer" || !content?.isTextblock) {
        throw new Error("选区含非文字块，请缩小范围后重试。");
      }
      sourceNodes.push(node);
      const selected = content.copy(
        content.content.cut(
          Math.max(0, from - pos - 2),
          Math.min(content.content.size, to - pos - 2),
        ),
      );
      const children = [selected];
      if (pos + node.nodeSize < replaceTo) {
        for (let i = 1; i < node.childCount; i++) children.push(node.child(i));
      }
      selectedNodes.push(node.copy(Fragment.fromArray(children)));
    }
    pos += node.nodeSize;
  });
  return {
    document: doc,
    from,
    to,
    replaceFrom,
    replaceTo,
    sourceNodes,
    selectedNodes,
    prefix: start.parent.content.cut(0, start.parentOffset),
    suffix: end.parent.content.cut(end.parentOffset),
  };
}

/** Build a replacement off-document, retaining untouched text, marks and descendants. */
export function composeInlineReplacement(
  target: InlineSelectionSnapshot,
  generated: ProseMirrorNode[],
): Fragment {
  if (!generated.length) throw new Error("AI 未返回可写入的内容。");
  const first = target.sourceNodes[0];
  const last = target.sourceNodes.at(-1)!;
  const firstContent = first.firstChild!;
  const lastContent = last.firstChild!;
  const trailingChildren: ProseMirrorNode[] = [];
  for (let i = 1; i < last.childCount; i++)
    trailingChildren.push(last.child(i));
  const single =
    generated.length === 1 && generated[0].childCount === 1
      ? generated[0].firstChild
      : null;
  // Ordinary rewrites stay inline (including existing heading/list formatting).
  if (
    single?.isTextblock &&
    (single.type.name === "paragraph" || single.type === firstContent.type)
  ) {
    const content = firstContent.copy(
      target.prefix.append(single.content).append(target.suffix),
    );
    return Fragment.from(
      first.copy(Fragment.fromArray([content, ...trailingChildren])),
    );
  }
  const result: ProseMirrorNode[] = [];
  if (target.prefix.size)
    result.push(first.copy(Fragment.from(firstContent.copy(target.prefix))));
  result.push(...generated);
  if (target.suffix.size) {
    // A split within one source block must not duplicate its id.
    const attrs =
      first === last && target.prefix.size
        ? { ...last.attrs, id: null }
        : last.attrs;
    result.push(
      last.type.create(
        attrs,
        Fragment.fromArray([
          lastContent.copy(target.suffix),
          ...trailingChildren,
        ]),
      ),
    );
  } else if (trailingChildren.length) {
    const tail = result[result.length - 1];
    // Keep the old descendants as a separate boundary block if generated output has its own children.
    if (tail.childCount > 1) {
      result.push(
        last.type.create({ ...last.attrs, id: null }, [
          lastContent.copy(Fragment.empty),
          ...trailingChildren,
        ]),
      );
    } else {
      result[result.length - 1] = tail.copy(
        tail.content.append(Fragment.fromArray(trailingChildren)),
      );
    }
  }
  return Fragment.fromArray(result);
}
