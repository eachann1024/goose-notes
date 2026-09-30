import { DOMParser, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

/**
 * 侧栏把手在 portal 里起拖：BlockNote 靠 document 上的 dragstart 读
 * `blocknote/html` 才把 `view.dragging.move = true`。读不到时 ProseMirror
 * 会把落下当外部 HTML 粘贴，原块还在，于是轻推几下就多出几行。
 * 在同一次 dragstart 里补上 move，保证是搬块不是复制。
 */
export function ensureBlockMoveDragging(
  view: EditorView | null | undefined,
  dataTransfer: DataTransfer | null,
): void {
  if (!view || view.dragging || !dataTransfer) return;
  const html = dataTransfer.getData("blocknote/html");
  if (!html) return;
  const blockGroup = view.state.schema.nodes.blockGroup;
  if (!blockGroup) return;
  const element = document.createElement("div");
  element.innerHTML = html;
  const parser = DOMParser.fromSchema(view.state.schema);
  const node = parser.parse(element, {
    topNode: blockGroup.create(),
  });
  view.dragging = {
    slice: new Slice(node.content, 0, 0),
    move: true,
  };
}
