import type { PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { InlinePreviewPart } from "./inlinePreview";
import { groupInlinePreviewRanges } from "./inlinePreviewRange";

/** A sibling layer keeps the outline out of ProseMirror's editable document. */
export function createInlinePreviewOutline(view: EditorView, key: PluginKey<InlinePreviewPart[]>) {
  const host = view.dom.parentElement;
  if (!host) return { update() {}, destroy() {} };
  const layer = view.dom.ownerDocument.createElement("div");
  layer.className = "goose-ai-range-layer";
  layer.setAttribute("aria-hidden", "true");
  host.classList.add("goose-ai-range-host");
  host.append(layer);
  let frame = 0;
  const paint = () => {
    frame = 0;
    if (view.isDestroyed || !view.dom.isConnected) return;
    const hostRect = host.getBoundingClientRect();
    const scaleX = hostRect.width / (host.offsetWidth || hostRect.width || 1);
    const scaleY = hostRect.height / (host.offsetHeight || hostRect.height || 1);
    let index = 0;
    for (const group of groupInlinePreviewRanges(view.state.doc, key.getState(view.state) ?? [])) {
      const rects = group.flatMap((part) => {
        const element = view.nodeDOM(part.blockFrom);
        return element instanceof HTMLElement ? [element.getBoundingClientRect()] : [];
      }).filter((rect) => rect.width > 0 && rect.height > 0);
      if (!rects.length) continue;
      const left = Math.min(...rects.map((rect) => rect.left));
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      const outline = layer.children[index] as HTMLElement | undefined ?? view.dom.ownerDocument.createElement("div");
      if (!outline.parentElement) {
        outline.className = "goose-ai-range-outline";
        layer.append(outline);
      }
      Object.assign(outline.style, {
        left: `${(left - hostRect.left) / scaleX + host.scrollLeft - host.clientLeft - 5}px`,
        top: `${(top - hostRect.top) / scaleY + host.scrollTop - host.clientTop - 4}px`,
        width: `${(right - left) / scaleX + 10}px`,
        height: `${(bottom - top) / scaleY + 8}px`,
      });
      index++;
    }
    while (layer.children.length > index) layer.lastElementChild?.remove();
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const observer = new ResizeObserver(schedule);
  observer.observe(view.dom);
  observer.observe(host);
  view.dom.ownerDocument.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  schedule();
  return {
    update: schedule,
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      view.dom.ownerDocument.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      layer.remove();
      host.classList.remove("goose-ai-range-host");
    },
  };
}
