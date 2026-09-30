import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { DropdownMenuIconSlot } from "../../src/components/ui/dropdown-menu";

const { window, document } = parseHTML("<!doctype html><html><body><div id='root'></div></body></html>");
Object.assign(globalThis, { window, document, IS_REACT_ACT_ENVIRONMENT: true });
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
window.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
window.cancelAnimationFrame = (id) => { frames.delete(id); };
const root = createRoot(document.getElementById("root")!);
const render = async (icon?: unknown, loading = false) => {
  await act(async () => { root.render(createElement(DropdownMenuIconSlot, { icon, loading })); });
};
const flush = async () => { const callbacks = [...frames.values()]; frames.clear(); await act(async () => callbacks.forEach((callback) => callback(0))); };

await render();
assert.equal(document.querySelector("[aria-hidden='true']"), null);
await render(undefined, true);
assert.ok(document.querySelector(".animate-pulse"));
await render(createElement("svg"), false);
await flush();
assert.ok(document.querySelector("svg"));
console.log("dropdown icon slot passed");
process.exit(0);
