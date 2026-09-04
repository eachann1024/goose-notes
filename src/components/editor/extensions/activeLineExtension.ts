import { createExtension } from "@blocknote/core";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const ACTIVE_LINE_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
]);

function isDefaultBackground(value: unknown) {
  return value == null || value === "default" || value === "";
}

/** 光标所在文本块加呈现类，不写入 BlockNote 文档。 */
export function resolveActiveLineDecoration(
  state: EditorState,
): DecorationSet | null {
  const { $head } = state.selection;

  for (let depth = $head.depth; depth > 0; depth -= 1) {
    const node = $head.node(depth);
    if (node.type.name !== "blockContainer") continue;

    const content = node.firstChild;
    if (!content || !ACTIVE_LINE_BLOCK_TYPES.has(content.type.name)) {
      return null;
    }
    if (!isDefaultBackground(content.attrs.backgroundColor)) {
      return null;
    }

    const from = $head.before(depth);
    return DecorationSet.create(state.doc, [
      Decoration.node(from, from + node.nodeSize, {
        class: "goose-active-line",
      }),
    ]);
  }

  return null;
}

const activeLinePlugin = new Plugin({
  key: new PluginKey("goose-active-line"),
  props: {
    decorations(state) {
      return resolveActiveLineDecoration(state);
    },
  },
});

export const gooseActiveLineExtension = createExtension({
  key: "goose-active-line",
  prosemirrorPlugins: [activeLinePlugin],
});
