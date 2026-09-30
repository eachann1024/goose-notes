import { blockToNode, nodeToBlock, type BlockNoteEditor } from "@blocknote/core";
import { Fragment, type Node as ProseMirrorNode } from "prosemirror-model";
import { TextSelection, type SelectionBookmark } from "prosemirror-state";
import { closeHistory } from "@tiptap/pm/history";
import {
  captureInlineSelection,
  captureInlineSelectionParts,
  composeInlineReplacement,
  type InlineSelectionPart,
  type InlineSelectionSnapshot,
} from "@/components/editor/ai/selectionPrivacy";
import { normalizeAiMarkdown } from "./markdown";
import { inheritPresentationFromSource } from "./inheritPresentation";
import { parseMarkdownToBlocks, serializeBlocksToMarkdown } from "./inlineMarkdownApply";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Editor = BlockNoteEditor<any, any, any>;
export interface PrivateInlineTarget extends InlineSelectionSnapshot {
  oldMarkdown: string;
  sourceBlockIds: string[];
  parts: (InlineSelectionPart & { oldMarkdown: string })[];
  bookmark: SelectionBookmark;
}
export interface PrivateInlineDraft {
  edits: { blockId: string; nodes: ProseMirrorNode[]; text: string; formattingChanged: boolean }[];
}

export function capturePrivateInlineTarget(editor: Editor, blockId: string): PrivateInlineTarget {
  const { doc } = editor.prosemirrorState;
  let { selection } = editor.prosemirrorState;
  if (selection.empty) {
    let found = false;
    doc.descendants((node, pos) => {
      if (found) return false;
      if (node.type.name !== "blockContainer" || node.attrs.id !== blockId) return true;
      if (!node.firstChild?.isTextblock) throw new Error("当前块不支持行内文字改写。");
      selection = TextSelection.create(doc, pos + 2, pos + 2 + node.firstChild.content.size);
      found = true;
      return false;
    });
    if (!found) throw new Error("目标块已不在文档中，请重新选择。");
  }
  const parts = captureInlineSelectionParts(doc, selection).map((part) => {
    const selected = part.node.copy(Fragment.from(part.node.firstChild!.copy(
      part.node.firstChild!.content.cut(part.offsetFrom, part.offsetTo),
    )));
    const block = nodeToBlock(selected, editor.prosemirrorState.schema, editor.schema.blockSchema,
      editor.schema.inlineContentSchema, editor.schema.styleSchema);
    return { ...part, oldMarkdown: serializeBlocksToMarkdown(editor, [block]) };
  });
  const first = parts[0];
  const snapshot = captureInlineSelection(doc, first.from, first.to);
  return {
    ...snapshot,
    from: selection.from,
    to: selection.to,
    parts,
    bookmark: selection.getBookmark(),
    sourceBlockIds: parts.map((part) => part.blockId),
    oldMarkdown: parts.map((part) => part.oldMarkdown).join("\n\n"),
  };
}

export function preparePrivateInlineDraft(
  editor: Editor,
  target: PrivateInlineTarget,
  markdown: string | string[],
): PrivateInlineDraft {
  const values = typeof markdown === "string" ? [markdown] : markdown;
  if (values.length !== target.parts.length) throw new Error("AI 建议与选中块数量不一致，请重试。");
  return { edits: target.parts.map((part, index) => {
    const normalized = normalizeAiMarkdown(values[index]).trim();
    if (!normalized) throw new Error("AI 未返回可写入的内容。");
    const parsed = inheritPresentationFromSource([editor.getBlock(part.blockId)], parseMarkdownToBlocks(editor, normalized));
    const nodes = parsed.map((block) => blockToNode(withoutIds(block) as Parameters<typeof blockToNode>[0],
      editor.prosemirrorState.schema, editor.schema.styleSchema));
    for (const node of nodes) {
      const check = (value: ProseMirrorNode) => {
        if (value.type.name === "blockContainer" && !value.firstChild?.isTextblock)
          throw new Error("AI 返回了表格或非文字块，请重试。");
      };
      check(node);
      node.descendants(check);
    }
    const original = part.node.firstChild!;
    const formattingChanged = nodes.length !== 1 || nodes[0].childCount > 1 ||
      formatSignature(nodes[0].firstChild!) !== formatSignature(original.copy(original.content.cut(part.offsetFrom, part.offsetTo)));
    return { blockId: part.blockId, nodes, text: describeInlineDraft(nodes, original.type.name), formattingChanged };
  }) };
}

function formatSignature(node: ProseMirrorNode): string {
  return JSON.stringify(node.toJSON(), (key, value) => key === "text" ? undefined : value);
}

function describeInlineDraft(nodes: ProseMirrorNode[], sourceType: string): string {
  const rows: string[] = [];
  const visit = (node: ProseMirrorNode, depth: number, index: number) => {
    const content = node.firstChild!;
    const type = content.type.name;
    const prefix = nodes.length === 1 && depth === 0 && type === sourceType ? "" :
      type === "bulletListItem" ? "• " : type === "numberedListItem" ? `${index + 1}. ` :
      type === "checkListItem" ? (content.attrs.checked ? "☑ " : "☐ ") :
      type === "heading" ? `${"#".repeat(Number(content.attrs.level) || 1)} ` :
      type === "quote" ? "> " : "";
    rows.push("  ".repeat(depth) + prefix + content.textBetween(0, content.content.size, "\n", "\n"));
    if (node.childCount > 1) node.child(1).forEach((child, _offset, childIndex) => visit(child, depth + 1, childIndex));
  };
  nodes.forEach((node, index) => visit(node, 0, index));
  return rows.join("\n");
}

/** Re-locate by stable ID: unrelated edits may move offsets without invalidating a draft. */
export function locatePrivateInlineTarget(editor: Editor, target: PrivateInlineTarget) {
  const locations = new Map<string, { node: ProseMirrorNode; pos: number }>();
  const doc = editor.prosemirrorState.doc;
  doc.descendants((node, pos) => {
    if (node.type.name === "blockContainer" && target.sourceBlockIds.includes(String(node.attrs.id))) {
      if (locations.has(String(node.attrs.id))) throw new Error("原文块 ID 重复，请重新选择。");
      locations.set(String(node.attrs.id), { node, pos });
    }
  });
  return target.parts.map((part) => {
    const found = locations.get(part.blockId);
    const ancestors: string[] = [];
    if (found) {
      const resolved = doc.resolve(found.pos);
      for (let depth = 0; depth <= resolved.depth; depth++)
        if (resolved.node(depth).type.name === "blockContainer") ancestors.push(String(resolved.node(depth).attrs.id));
    }
    // Each remounted editor owns a distinct schema; node.eq would compare type identities.
    if (!found || JSON.stringify(found.node.firstChild?.toJSON()) !== JSON.stringify(part.node.firstChild!.toJSON()) ||
      JSON.stringify(ancestors) !== JSON.stringify(part.ancestors)) {
      throw new Error("原文已变化或块已移动，请重新选择后生成，原文未修改。");
    }
    return { ...part, node: found.node, from: found.pos + 2 + part.offsetFrom, to: found.pos + 2 + part.offsetTo };
  });
}

export function assertPrivateInlineTarget(editor: Editor, target: PrivateInlineTarget): void {
  if (!editor.isEditable) throw new Error("当前页面不可编辑。");
  locatePrivateInlineTarget(editor, target);
}

export function applyPrivateInlineDraft(editor: Editor, target: PrivateInlineTarget, draft: PrivateInlineDraft): void {
  assertPrivateInlineTarget(editor, target);
  const parts = locatePrivateInlineTarget(editor, target);
  if (draft.edits.length !== parts.length) throw new Error("AI 建议不完整，请重试。");
  editor.transact((tr) => {
    closeHistory(tr);
    // Descendants are applied first. Parents are re-read from this transaction so their children survive.
    for (const part of [...parts].sort((a, b) => b.from - a.from)) {
      const edit = draft.edits.find((item) => item.blockId === part.blockId);
      if (!edit) throw new Error("AI 建议不完整，请重试。");
      let pos: number | undefined;
      tr.doc.descendants((node, offset) => {
        if (node.type.name === "blockContainer" && node.attrs.id === part.blockId) { pos = offset; return false; }
      });
      if (pos === undefined) throw new Error("目标块已不在文档中。");
      const snapshot = captureInlineSelection(tr.doc, pos + 2 + part.offsetFrom, pos + 2 + part.offsetTo);
      tr.replaceWith(snapshot.replaceFrom, snapshot.replaceTo, composeInlineReplacement(snapshot, edit.nodes));
    }
  });
  // Prevent a subsequent keystroke from joining this batch's undo event.
  editor.transact((tr) => closeHistory(tr));
}

function withoutIds(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const block = { ...value as Record<string, unknown> };
  delete block.id;
  if (Array.isArray(block.children)) block.children = block.children.map(withoutIds);
  return block;
}
