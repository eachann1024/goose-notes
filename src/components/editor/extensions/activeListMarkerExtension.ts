import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const LIST_CONTENT_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
]);

const activeListMarkerPlugin = new Plugin({
  key: new PluginKey("goose-active-list-marker"),
  props: {
    decorations(state) {
      const { $head } = state.selection;

      for (let depth = $head.depth; depth > 0; depth -= 1) {
        const node = $head.node(depth);
        if (node.type.name !== "blockContainer") continue;
        if (!LIST_CONTENT_TYPES.has(node.firstChild?.type.name ?? "")) {
          return null;
        }

        const from = $head.before(depth);
        return DecorationSet.create(state.doc, [
          Decoration.node(from, from + node.nodeSize, {
            class: "goose-active-list-marker",
          }),
        ]);
      }

      return null;
    },
  },
});

/** 给 ProseMirror 光标所在列表块添加纯呈现类，不写入 BlockNote 文档。 */
export const gooseActiveListMarkerExtension = createExtension({
  key: "goose-active-list-marker",
  prosemirrorPlugins: [activeListMarkerPlugin],
  mount({ dom, signal }) {
    const syncSelection = () => {
      const selection = dom.ownerDocument.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      dom.classList.toggle(
        "goose-checklist-selection",
        Boolean(
          range && !selection?.isCollapsed &&
          dom.contains(range.startContainer) && dom.contains(range.endContainer) &&
          [...dom.querySelectorAll('.bn-block-content[data-content-type="checkListItem"] .bn-inline-content')]
            .some((el) => range.intersectsNode(el)),
        ),
      );
    };
    dom.ownerDocument.addEventListener("selectionchange", syncSelection, { signal });
    dom.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button === 0 &&
          event.target instanceof HTMLInputElement &&
          event.target.closest('.bn-block-content[data-content-type="checkListItem"]')) {
        event.preventDefault(); // Keep the editor's active-line background steady on mouse check.
      }
    }, { capture: true, signal });
    dom.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      const item = event.target.closest('.bn-block-content[data-content-type="checkListItem"]');
      if (!item) return;
      dom.classList.remove("goose-checklist-selection");
      if (!event.target.checked || dom.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const id = item.closest("[data-id]")?.getAttribute("data-id");
      if (!id) return;
      // BlockNote replaces the paragraph on check; animate its replacement, not the removed node.
      requestAnimationFrame(() => {
        const text = dom.querySelector<HTMLElement>(
          `[data-id="${CSS.escape(id)}"] .bn-block-content[data-content-type="checkListItem"][data-checked="true"] .bn-inline-content`,
        );
        if (!text?.textContent) return;
        const range = dom.ownerDocument.createRange();
        range.selectNodeContents(text);
        const left = text.getBoundingClientRect().left;
        // ponytail: 多行同步扫过最长一行；需要逐行接力时再按 rect 分段。
        let width = 0;
        for (const rect of range.getClientRects()) width = Math.max(width, rect.right - left);
        if (!width) return;
        const backgroundSize = `${width * 3}px 100%`;
        text.animate(
          [
            { backgroundSize, backgroundPosition: `-${width * 2}px 0` },
            { backgroundSize, backgroundPosition: "0 0" },
          ],
          { duration: 300, easing: "cubic-bezier(0.42, 0, 1, 1)" },
        );
        text.parentElement?.querySelector("input")?.animate(
          [
            { transform: "scale(0.92)" },
            { transform: "scale(1.12)", offset: 0.6 },
            { transform: "scale(0.98)", offset: 0.85 },
            { transform: "scale(1)" },
          ],
          { duration: 300, easing: "ease-in-out" },
        );
      });
    }, { capture: true, signal });
    signal.addEventListener("abort", () => dom.classList.remove("goose-checklist-selection"), { once: true });
  },
});
