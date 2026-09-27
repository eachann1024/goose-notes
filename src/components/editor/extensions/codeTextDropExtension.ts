import { createExtension } from "@blocknote/core";
import { TextSelection } from "prosemirror-state";

export const gooseCodeTextDropExtension = createExtension(({ editor }) => ({
  key: "goose-code-text-drop",
  mount({ dom, signal }) {
    const view = editor.prosemirrorView;
    let pressed: {
      from: number; to: number; text: string;
      doc: typeof view.state.doc; x: number; y: number;
    } | null = null;
    // ponytail: Chromium doesn't start native cross-block text drags here;
    // remove this mouse fallback when the editor starts them reliably.
    dom.addEventListener("mousedown", (event) => {
      pressed = null;
      const selection = view.state.selection;
      if (event.button !== 0 || !(selection instanceof TextSelection) || selection.empty ||
          selection.$from.parent === selection.$to.parent ||
          !(event.target instanceof Element) || !event.target.closest(".bn-inline-content")) return;
      const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (!hit || hit.pos < selection.from || hit.pos > selection.to) return;
      const text = window.getSelection()?.toString().replace(/\r\n?/g, "\n");
      if (!text) return;
      pressed = { from: selection.from, to: selection.to, text, doc: view.state.doc, x: event.clientX, y: event.clientY };
    }, { capture: true, signal });

    dom.addEventListener("dragstart", () => { pressed = null; }, { signal });
    document.addEventListener("mouseup", (event) => {
      const source = pressed;
      pressed = null;
      if (!source || Math.hypot(event.clientX - source.x, event.clientY - source.y) < 6 ||
          !view.state.doc.eq(source.doc)) return;
      const pre = event.target instanceof Element
        ? event.target.closest<HTMLElement>(".goose-code-pre:not(.goose-code-pre-hidden)")
        : null;
      if (pre) moveIntoCode(pre, event.clientX, event.clientY, source.text, source.from, source.to);
    }, { capture: true, signal });

    function moveIntoCode(pre: HTMLElement, x: number, y: number, text: string, start: number, end: number) {
      const id = pre.closest<HTMLElement>('[data-node-type="blockContainer"]')?.dataset.id;
      if (!id) return false;
      const { doc } = view.state;
      let destination: { from: number; to: number; pos: number; size: number } | undefined;
      doc.descendants((node, pos) => {
        if (node.type.name !== "blockContainer" || node.attrs.id !== id) return true;
        const content = node.firstChild;
        if (content?.type.name === "codeBlock") destination = { from: pos + 2, to: pos + 2 + content.content.size, pos, size: node.nodeSize };
        return false;
      });
      if (!destination || (start < destination.pos + destination.size && end > destination.pos)) return false;
      const coords = view.posAtCoords({ left: x, top: y });
      const insertAt = coords ? Math.max(destination.from, Math.min(coords.pos, destination.to)) : destination.to;
      const tr = view.state.tr.setSelection(TextSelection.create(doc, start, end)).deleteSelection();
      const mapped = tr.mapping.map(insertAt);
      tr.insertText(text, mapped);
      tr.setSelection(TextSelection.near(tr.doc.resolve(mapped + text.length)));
      view.dragging = null;
      view.dispatch(tr.setMeta("uiEvent", "drop"));
      view.focus();
      return true;
    }

    // React's code-block NodeView swallows ProseMirror's bubble-phase drop handler.
    dom.addEventListener(
      "drop",
      (event) => {
        pressed = null;
        const target = event.target instanceof Element ? event.target : null;
        const pre = target?.closest<HTMLElement>(
          ".goose-code-pre:not(.goose-code-pre-hidden)",
        );
        const id = pre?.closest<HTMLElement>(
          '[data-node-type="blockContainer"]',
        )?.dataset.id;
        const { selection } = view.state;
        // Leave block-handle drags and external files/HTML to BlockNote.
        if (
          !id ||
          !view.dragging?.move ||
          !(selection instanceof TextSelection) ||
          selection.empty
        )
          return;
        const text = event.dataTransfer
          ?.getData("text/plain")
          .replace(/\r\n?/g, "\n");
        if (!text) return;

        if (moveIntoCode(pre, event.clientX, event.clientY, text, selection.from, selection.to)) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true, signal },
    );
  },
}));
