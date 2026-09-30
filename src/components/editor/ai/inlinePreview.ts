import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { createInlinePreviewOutline } from "./inlinePreviewOutline";

export interface InlinePreviewPart {
  from: number;
  to: number;
  blockFrom: number;
  blockTo: number;
  oldText: string;
  newText?: string;
  reviewing: boolean;
  formattingChanged?: boolean;
}

export function inlineDiffEdges(before: string, after: string) {
  let start = 0;
  let end = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (end < before.length - start && end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  // Do not split a UTF-16 surrogate pair at a shared boundary.
  if (start > 0 && /[\uD800-\uDBFF]/.test(before[start - 1])) start--;
  if (end > 0 && /[\uDC00-\uDFFF]/.test(before[before.length - end])) end--;
  return { start, end };
}

export function createInlinePreviewPlugin() {
  const key = new PluginKey<InlinePreviewPart[]>("goose-inline-ai-preview");
  const plugin = new Plugin<InlinePreviewPart[]>({
    key,
    view: (view) => createInlinePreviewOutline(view, key),
    state: {
      init: () => [],
      apply(tr, value) {
        const next = tr.getMeta(key) as InlinePreviewPart[] | undefined;
        if (next) return next;
        if (!tr.docChanged) return value;
        return value.map((part) => ({ ...part,
          from: tr.mapping.map(part.from), to: tr.mapping.map(part.to),
          blockFrom: tr.mapping.map(part.blockFrom), blockTo: tr.mapping.map(part.blockTo),
        }));
      },
    },
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        for (const part of key.getState(state) ?? []) {
          if (part.blockFrom < 0 || part.blockTo > state.doc.content.size || part.blockFrom >= part.blockTo) continue;
          decorations.push(Decoration.node(part.blockFrom, part.blockTo, {
            class: "goose-ai-preview-target",
            ...(part.reviewing ? { contenteditable: "false", "aria-label": "AI 只读修改预览" } : {}),
          }));
          if (!part.reviewing || part.newText === undefined) continue;
          const { start, end } = inlineDiffEdges(part.oldText, part.newText);
          const from = part.from + start;
          const to = part.to - end;
          if (from < to) decorations.push(Decoration.inline(from, to, { nodeName: "del", class: "goose-ai-preview-deletion" }));
          const added = part.newText.slice(start, part.newText.length - end);
          if (added) decorations.push(Decoration.widget(to, () => {
            const span = document.createElement("ins");
            span.className = "goose-ai-preview-addition";
            span.contentEditable = "false";
            span.setAttribute("aria-label", "新增文字");
            span.textContent = added;
            return span;
          }, { side: -1, key: `${part.blockFrom}:${added}`, ignoreSelection: true }));
          if (part.formattingChanged) decorations.push(Decoration.widget(part.to, () => {
            const label = document.createElement("span");
            label.className = "goose-ai-preview-format-change";
            label.contentEditable = "false";
            label.textContent = "格式 / 结构变更";
            return label;
          }, { side: 1, key: `${part.blockFrom}:format`, ignoreSelection: true }));
        }
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
  return { key, plugin };
}

export function setInlinePreview(view: EditorView, key: PluginKey<InlinePreviewPart[]>, parts: InlinePreviewPart[]) {
  if (view.isDestroyed || !key.getState(view.state) || JSON.stringify(key.getState(view.state)) === JSON.stringify(parts)) return;
  view.dispatch(view.state.tr.setMeta(key, parts).setMeta("addToHistory", false));
}
