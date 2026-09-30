import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { useSidebarPageReveal } from "../../src/pages/workspace/components/sidebar/main-tree/useSidebarPageReveal";

// Wiring guard: the hook must receive the same selected/split page as the row highlight.
const sidebarSource = readFileSync("src/pages/workspace/components/sidebar/main-tree/SidebarMainTree.tsx", "utf8");
assert.match(sidebarSource, /selectedPageId !== undefined \? selectedPageId : activePageId/);
assert.match(sidebarSource, /useSidebarPageReveal\(\{[\s\S]*?highlightedPageId,/);
assert.doesNotMatch(sidebarSource, /focusItem\(/);

const { window, document } = parseHTML("<!doctype html><html><body><input id='editor'><div id='host'></div></body></html>");
Object.assign(globalThis, { window, document, MutationObserver: window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
let focusCalls = 0;
let outerScrollCalls = 0;
window.HTMLElement.prototype.focus = () => { focusCalls++; };
window.HTMLElement.prototype.scrollIntoView = () => { outerScrollCalls++; };
const editor = document.getElementById("editor")!;
Object.defineProperty(document, "activeElement", { get: () => editor });
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
window.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
window.cancelAnimationFrame = (id) => { frames.delete(id); };
async function flushFrame() {
  await act(async () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  });
}

const page = (id: string, parentId?: string, workspaceId = "book") => ({ id, parentId, workspaceId });
const allPages = { parent: page("parent"), middle: page("middle", "parent"), a: page("a", "middle"), b: page("b") };
type Options = Parameters<typeof useSidebarPageReveal>[0];
let consumed: string[] = [];
let expansions: string[][] = [];
let state: Omit<Options, "scrollContainerRef">;
let rowIds: string[];
let top = 400;
let container: HTMLDivElement;
let root = createRoot(document.getElementById("host")!);
function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useSidebarPageReveal({ ...state, scrollContainerRef: ref });
  return createElement("div", {
    ref: (node: HTMLDivElement | null) => {
      ref.current = node;
      if (!node) return;
      container = node;
      if (node.scrollTop === undefined) node.scrollTop = 0;
      Object.defineProperty(node, "clientHeight", { configurable: true, value: 100 });
      Object.defineProperty(node, "clientTop", { configurable: true, value: 2 });
      node.getBoundingClientRect = () => ({ top: 10, bottom: 114, height: 104 }) as DOMRect;
    },
  }, rowIds.map((id) => createElement("div", {
    key: id,
    "data-rct-item-id": id,
    ref: (node: HTMLDivElement | null) => {
      if (node) node.getBoundingClientRect = () => ({ top: top - container.scrollTop, bottom: top + 24 - container.scrollTop, height: 24 }) as DOMRect;
    },
  })));
}
async function render(patch: Partial<typeof state> = {}, rows = rowIds) {
  state = { ...state, ...patch };
  rowIds = rows;
  await act(async () => { root.render(createElement(Harness)); });
}
async function reset(patch: Partial<typeof state> = {}, rows: string[] = ["a", "b"]) {
  await act(async () => { root.unmount(); });
  root = createRoot(document.getElementById("host")!);
  consumed = [];
  expansions = [];
  top = 400;
  state = {
    activeNotebookId: "book", highlightedPageId: "a", expandPageId: null,
    pages: allPages, expandedIds: [], treeReady: true,
    setExpanded: (_book, ids) => { expansions.push(ids); },
    consumeRequest: (id) => { consumed.push(id); },
    ...patch,
  };
  await render({}, rows);
}

// Expansion and row rendering are separate commits; neither is completion.
await reset({ expandPageId: "a" }, []);
assert.deepEqual(expansions, [["middle", "parent"]]);
assert.deepEqual(consumed, []);
assert.equal(frames.size, 0);
await render({ expandedIds: ["middle", "parent"] });
assert.equal(frames.size, 1);
await render({ pages: { ...allPages } }); // cleanup cancels the first frame
assert.equal(frames.size, 1);
await flushFrame(); // no row yet: retain intent
assert.deepEqual(consumed, []);
await render({}, ["a"]); // observer notices delayed row commit
await flushFrame();
assert.equal(container.scrollTop, 312);
assert.deepEqual(consumed, ["a"]);
await render({ expandPageId: null });
container.scrollTop = 0;
await render({ expandedIds: [], pages: { ...allPages } }); // manual collapse / edit
await flushFrame();
assert.equal(container.scrollTop, 0);
assert.equal(expansions.length, 1);

// Same page, new explicit request must reveal again, not be deduplicated.
await render({ expandPageId: "a" });
assert.equal(expansions.length, 2);
await render({ expandedIds: ["middle", "parent"] });
await flushFrame();
assert.equal(container.scrollTop, 312);
assert.deepEqual(consumed, ["a", "a"]);

// Latest displayed page (including a focused split) beats an older in-flight request.
await reset({ highlightedPageId: "a", expandPageId: "a", expandedIds: ["middle", "parent"] });
await render({ highlightedPageId: "b" }, ["b"]);
await flushFrame();
assert.equal(container.scrollTop, 312);
assert.deepEqual(consumed, ["a"]);
await render({ expandPageId: null, pages: { ...allPages } });
container.scrollTop = 0;
await flushFrame();
assert.equal(container.scrollTop, 0);

// Automatic reveal survives effect cleanup too, and tracks A -> B -> A.
await reset({ expandedIds: ["middle", "parent"] });
await render({ highlightedPageId: "b" });
await render({ highlightedPageId: "a", pages: { ...allPages } });
await flushFrame();
assert.equal(container.scrollTop, 312);
container.scrollTop = 0;
await render({ highlightedPageId: null });
await render({ highlightedPageId: "a" });
await flushFrame();
assert.equal(container.scrollTop, 312);

// Missing pages and cross-notebook hydration are retried on the committed data.
await reset({ activeNotebookId: "other", highlightedPageId: "b", pages: {}, expandPageId: "a" }, []);
await render({ activeNotebookId: "book", highlightedPageId: null, pages: { a: allPages.a } });
assert.equal(expansions.length, 0);
await render({ pages: allPages });
assert.deepEqual(expansions, [["middle", "parent"]]);
await render({ expandedIds: ["middle", "parent"] }, ["a"]);
await flushFrame();
assert.deepEqual(consumed, ["a"]);

// Loading/empty tree, zero-size hidden tree and delayed mounting cannot consume requests.
await reset({ expandPageId: "b", highlightedPageId: "b", treeReady: false }, []);
await flushFrame();
assert.deepEqual(consumed, []);
await render({ treeReady: true }, ["b"]);
Object.defineProperty(container, "clientHeight", { configurable: true, value: 0 });
await flushFrame();
assert.deepEqual(consumed, []);
await render({ pages: { ...allPages } });
await flushFrame();
assert.deepEqual(consumed, ["b"]);

// Visible rows don't scroll; above-viewport rows align to the container's inner top.
await reset({ highlightedPageId: "b", expandPageId: "b" });
top = 40;
await flushFrame();
assert.equal(container.scrollTop, 0);
await render({ expandPageId: null });
await render({ expandPageId: "b" });
container.scrollTop = 100;
await flushFrame();
assert.equal(container.scrollTop, 28);

// No DOM focus or scrollIntoView calls, even with editor focus while frames run.
assert.equal(document.activeElement, editor);
assert.equal(focusCalls, 0);
assert.equal(outerScrollCalls, 0);
await act(async () => { root.unmount(); });
assert.equal(frames.size, 0);
console.log("sidebarPageReveal selfcheck passed: expansion, cancellation, explicit repeat, split/latest page, hydration, hidden tree, scroll bounds, passive focus");
