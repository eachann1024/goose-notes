import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { inlineCodeEdgeAt } from "./inlineCodeCaretExtension";

const strongCaretPlugin = new Plugin({
  key: new PluginKey("goose-strong-caret"),
  view(view) {
    const doc = view.dom.ownerDocument;
    const win = doc.defaultView;
    const caret = doc.createElement("span");
    caret.className = "goose-strong-editor-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.hidden = true;
    doc.body.append(caret);
    let frame = 0;

    const hide = () => {
      caret.hidden = true;
      view.dom.classList.remove("goose-strong-caret-active");
    };
    const position = () => {
      frame = 0;
      const { selection } = view.state;
      // ponytail: 只覆盖普通折叠文本光标；输入法、选区及非文本光标交还原生绘制。
      if (doc.activeElement !== view.dom || view.composing ||
          !(selection instanceof TextSelection) || !selection.empty ||
          !selection.$head.parent.inlineContent) {
        hide();
        return;
      }
      try {
        // 行内代码的边界有两个 DOM 光标位置（盒内/盒外），但只有一个文档位置。
        // PM 的坐标无法区分两侧；这里以 inlineCodeCaret 钉好的真实 DOM 光标为准。
        const codeType = view.state.schema.marks.code;
        const domSelection = doc.getSelection();
        const domRect = codeType && inlineCodeEdgeAt(selection.$head, codeType) &&
          domSelection?.isCollapsed && view.dom.contains(domSelection.anchorNode)
          ? domSelection.getRangeAt(0).getBoundingClientRect()
          : null;
        const rect = domRect?.height ? domRect : view.coordsAtPos(selection.head);
        const viewport = view.dom.closest(".page-scroll-container")?.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= (win?.innerHeight ?? 0) ||
            (viewport && (rect.bottom <= viewport.top || rect.top >= viewport.bottom ||
              rect.left < viewport.left || rect.left >= viewport.right))) {
          hide();
          return;
        }
        caret.style.left = `${rect.left}px`;
        caret.style.top = `${rect.top}px`;
        caret.style.height = `${rect.bottom - rect.top}px`;
        caret.hidden = false;
        view.dom.classList.add("goose-strong-caret-active");
      } catch {
        hide(); // DOM 位置尚不可用时保留原生光标。
      }
    };
    const schedule = () => {
      if (!frame && win) frame = win.requestAnimationFrame(position);
    };
    doc.addEventListener("scroll", schedule, true);
    win?.addEventListener("resize", schedule);
    win?.addEventListener("blur", hide);
    view.dom.addEventListener("focus", schedule);
    view.dom.addEventListener("blur", hide);
    view.dom.addEventListener("compositionstart", hide);
    view.dom.addEventListener("compositionend", schedule);
    schedule();

    return {
      update: schedule,
      destroy() {
        if (frame) win?.cancelAnimationFrame(frame);
        doc.removeEventListener("scroll", schedule, true);
        win?.removeEventListener("resize", schedule);
        win?.removeEventListener("blur", hide);
        view.dom.removeEventListener("focus", schedule);
        view.dom.removeEventListener("blur", hide);
        view.dom.removeEventListener("compositionstart", hide);
        view.dom.removeEventListener("compositionend", schedule);
        hide();
        caret.remove();
      },
    };
  },
});

export const gooseStrongCaretExtension = createExtension({
  key: "goose-strong-caret",
  prosemirrorPlugins: [strongCaretPlugin],
});
