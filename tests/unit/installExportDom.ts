import { parseHTML } from "linkedom";

/** blocksToFullHTML / React headless 渲染需要 document。只给 Node 单测用。 */
export function installExportDom() {
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    return;
  }
  const { window, document: doc } = parseHTML(
    "<!DOCTYPE html><html><body></body></html>",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: window,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: doc,
  });
  if (typeof (globalThis as { Node?: unknown }).Node === "undefined") {
    Object.defineProperty(globalThis, "Node", {
      configurable: true,
      value: window.Node,
    });
  }
  if (typeof (globalThis as { HTMLElement?: unknown }).HTMLElement === "undefined") {
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: window.HTMLElement,
    });
  }
}
