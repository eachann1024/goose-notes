import { createExtension } from "@blocknote/core";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const HEADING_CARET_ATTR = "data-goose-heading-caret";

/** 光标落在 heading 块内容内时，给该 PM 节点打呈现用属性（不写 BlockNote 文档）。 */
export function resolveHeadingCaretDecoration(
  state: EditorState,
): DecorationSet | null {
  const { $head } = state.selection;

  for (let depth = $head.depth; depth > 0; depth -= 1) {
    const node = $head.node(depth);
    if (node.type.name !== "heading") continue;

    const from = $head.before(depth);
    return DecorationSet.create(state.doc, [
      Decoration.node(from, from + node.nodeSize, {
        [HEADING_CARET_ATTR]: "true",
      }),
    ]);
  }

  return null;
}

const activeHeadingCaretPlugin = new Plugin({
  key: new PluginKey("goose-active-heading-caret"),
  props: {
    decorations(state) {
      return resolveHeadingCaretDecoration(state);
    },
  },
});

export const gooseActiveHeadingCaretExtension = createExtension({
  key: "goose-active-heading-caret",
  prosemirrorPlugins: [activeHeadingCaretPlugin],
});
