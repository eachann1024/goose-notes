import assert from "node:assert/strict";
import { act, createElement } from "react";
import { readFileSync } from "node:fs";
import { normalizeMainTreeDragOver, dropLineTopPx } from "../../src/pages/workspace/components/sidebar/main-tree/mainTreeDragGeometry";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { ControlledTreeEnvironment, InteractionMode, Tree, type DraggingPosition, type TreeItem } from "react-complex-tree";

// DOM contract test against the installed RCT, not a replacement drop evaluator.
// linkedom supplies events; fixed rectangles supply layout (it has no layout engine).
const { window, document } = parseHTML("<html><body><div id='host'></div></body></html>");
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Element: window.Element, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  getComputedStyle: () => ({ marginTop: "0px", marginBottom: "0px" }),
});
const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 300, width: 300, height }) as DOMRect;
window.HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.hasAttribute("data-rct-tree")) return rect(100, 320);
  const row = this.closest("[data-rct-item-container]");
  const rows = [...document.querySelectorAll("[data-rct-item-container]")];
  return rect(100 + rows.indexOf(row!) * 32, 32);
};
Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", { get: () => 32 });
window.HTMLElement.prototype.focus = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
const items: Record<string, TreeItem> = {
  root: { index: "root", isFolder: true, children: ["project", "daily", "astra", "folder", "last"], data: "root" },
  project: { index: "project", isFolder: true, children: ["guide", "ignore"], data: "New Project" },
  guide: { index: "guide", children: [], data: "guide" },
  ignore: { index: "ignore", children: [], data: "git ignore" },
  daily: { index: "daily", children: [], data: "daily" },
  astra: { index: "astra", children: [], data: "Astra" },
  folder: { index: "folder", isFolder: true, children: [], data: "folder" },
  last: { index: "last", children: [], data: "last" },
};
let drops: DraggingPosition[] = [];
let lastPosition: DraggingPosition | undefined;
let normalize = false;
const root = createRoot(document.getElementById("host")!);
await act(async () => {
  root.render(createElement(ControlledTreeEnvironment, {
    items, getItemTitle: (item) => String(item.data),
    viewState: { main: { expandedItems: ["project"], selectedItems: ["ignore"], focusedItem: "ignore" } },
    defaultInteractionMode: InteractionMode.ClickArrowToExpand,
    canDragAndDrop: true, canReorderItems: true, canDropOnFolder: true, canDropOnNonFolder: false, renderDepthOffset: 18,
    onDrop: (_items, target) => { drops.push(target); },
    renderItem: ({ item, context, children }) => createElement("li", context.itemContainerWithChildrenProps,
      createElement("div", context.itemContainerWithoutChildrenProps,
        createElement("div", { ...context.interactiveElementProps, "data-main-tree-folder": item.isFolder ? "true" : "false" }, String(item.data))), children),
    renderItemsContainer: ({ children, containerProps }) => createElement("ul", containerProps, children),
    renderTreeContainer: ({ children, containerProps }) => createElement("div", { ...containerProps,
      onDragOver: (e) => containerProps.onDragOver?.(normalize ? normalizeMainTreeDragOver(e, e.currentTarget) : e),
    }, children),
    renderDragBetweenLine: ({ draggingPosition, lineProps }) => { lastPosition = draggingPosition; return createElement("div", lineProps); },
  }, createElement(Tree, { treeId: "main", rootItem: "root", treeLabel: "test" })));
});
async function event(type: string, element: EventTarget, y: number, x = 100) {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, dataTransfer: { dropEffect: "move", types: ["text/plain"] } });
  await act(async () => { element.dispatchEvent(e); });
}
async function dropAt(y: number, targetId = "astra", x = 100) {
  drops = []; lastPosition = undefined;
  await event("dragstart", document.querySelector('[data-rct-item-id="ignore"]')!, 180);
  await event("dragover", document.querySelector(`[data-rct-item-id="${targetId}"]`)!, y, x);
  const position = lastPosition;
  await event("drop", window, y, x);
  if (drops[0]?.targetType === "between-items") assert.deepEqual(position, drops[0], "visible line and committed target agree");
  await event("dragend", window, y, x);
  return drops[0];
}
// Screenshot geometry: Astra is row 4, center = 244.
assert.equal(await dropAt(244), undefined, "upstream exact file center has no drop target");
assert.equal((await dropAt(243))?.targetType, "between-items");
assert.equal((await dropAt(245))?.targetType, "between-items");
normalize = true;
assert.deepEqual(await dropAt(244), {
  targetType: "between-items", treeId: "main", parentItem: "root", depth: 0,
  linearIndex: 5, childIndex: 3, linePosition: "bottom",
}, "file center moves the nested source to root after Astra");
assert.equal((await dropAt(243))?.childIndex, 2, "upper half remains before Astra");
assert.equal((await dropAt(245))?.childIndex, 3, "lower half remains after Astra");
assert.equal((await dropAt(140, "guide"))?.parentItem, "project", "same-directory reordering");
assert.equal((await dropAt(140, "guide"))?.childIndex, 0);
assert.equal((await dropAt(276, "folder"))?.targetType, "item", "folder center remains nesting");
assert.equal((await dropAt(276, "folder"))?.targetItem, "folder");
assert.equal((await dropAt(290, "folder"))?.parentItem, "root", "folder lower edge remains sibling insertion");
assert.equal((await dropAt(290, "folder"))?.childIndex, 4);
assert.equal((await dropAt(194, "ignore", 7))?.parentItem, "root", "outdent at subtree end retains root target");
assert.equal(await dropAt(180, "ignore"), undefined, "cannot drop onto source");
// Internal notebooks model notes as folders; do not normalize their center.
const file = document.querySelector('[data-rct-item-id="astra"]')!;
file.setAttribute("data-main-tree-folder", "true");
const centerEvent = { clientY: 244 } as Parameters<typeof normalizeMainTreeDragOver>[0];
assert.equal(normalizeMainTreeDragOver(centerEvent, document.querySelector('[data-rct-tree]')!), centerEvent);
assert.equal(dropLineTopPx(3, [0, 33, 67], 34), 101);
// Guard the application wiring as well as the real dependency contract above.
const itemSource = readFileSync("src/pages/workspace/components/sidebar/main-tree/MainTreeItem.tsx", "utf8");
const treeSource = readFileSync("src/pages/workspace/components/sidebar/main-tree/SidebarMainTree.tsx", "utf8");
assert.match(itemSource, /onDragOver\?\.\(normalizeMainTreeDragOver\(event, event.currentTarget\)\)/);
assert.match(itemSource, /data-main-tree-folder=\{item.isFolder \? "true" : "false"\}/);
assert.doesNotMatch(itemSource, /hideSortLine|captureLocalFolderDropParent/);
assert.doesNotMatch(treeSource, /capturedDir|takeLocalFolderDropParent/);
assert.match(treeSource, /if \(target.targetType === "between-items"\) \{\s*const pid = String\(target.parentItem\);\s*newParentId = pid === "root" \? undefined : pid;\s*insertIndex = target.childIndex;/);
await act(async () => root.unmount());
console.log("mainTreeDrop: PASS — upstream center regression, root/sibling/nesting targets, line/drop agreement, internal folder semantics");
