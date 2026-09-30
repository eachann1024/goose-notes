import { createExtension } from "@blocknote/core";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const CODE_ACTIVE_LINE_ATTR = "data-goose-code-active-line";

const SKIP_LANGUAGES = new Set(["math", "mermaid"]);

export function lineIndexAtTextOffset(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  if (clamped === 0) return 0;
  let line = 0;
  for (let i = 0; i < clamped; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function readAttr(
  node: { attrs: Record<string, unknown> },
  key: string,
): unknown {
  const direct = node.attrs[key];
  if (direct != null) return direct;
  const props = node.attrs.props;
  if (props && typeof props === "object" && key in props) {
    return (props as Record<string, unknown>)[key];
  }
  return undefined;
}

function isWrapped(node: { attrs: Record<string, unknown> }) {
  return readAttr(node, "wrap") === true;
}

function languageOf(node: { attrs: Record<string, unknown> }) {
  const raw = readAttr(node, "language");
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/** 光标所在代码行（1-based）打到 codeBlock 节点上，供 CSS 画当前行底。 */
export function resolveCodeBlockActiveLine(
  state: EditorState,
): DecorationSet | null {
  const { $head } = state.selection;

  for (let depth = $head.depth; depth > 0; depth -= 1) {
    const node = $head.node(depth);
    if (node.type.name !== "codeBlock") continue;
    if (isWrapped(node)) return null;
    if (SKIP_LANGUAGES.has(languageOf(node))) return null;

    // React node view 会丢掉打在 codeBlock 上的 decoration attrs，
    // 改挂外层 blockContainer（和列表当前行同一层）。
    const containerDepth = depth - 1;
    const container = $head.node(containerDepth);
    if (container.type.name !== "blockContainer") return null;

    const from = $head.before(containerDepth);
    const text = node.textBetween(0, node.content.size, "\n", "\n");
    const lineIndex = lineIndexAtTextOffset(text, $head.pos - $head.start(depth)) + 1;

    return DecorationSet.create(state.doc, [
      Decoration.node(from, from + container.nodeSize, {
        [CODE_ACTIVE_LINE_ATTR]: String(lineIndex),
        style: `--goose-code-active-line: ${lineIndex}`,
      }),
    ]);
  }

  return null;
}

export const gooseCodeBlockActiveLineExtension = createExtension({
  key: "goose-code-block-active-line",
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("goose-code-block-active-line"),
      props: {
        decorations(state) {
          return resolveCodeBlockActiveLine(state);
        },
      },
    }),
  ],
});
