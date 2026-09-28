// { printf 'process.env.GOOSE_EGO_SPACE="20";\n'; cat tests/unit/outlineLifecycle.browser.mjs; } | ego-browser nodejs
// Uses an existing local Vite mock page; no navigation, notebook writes or new spaces.
const assert = (await import("node:assert/strict")).default;
const space = process.env.GOOSE_EGO_SPACE;
if (!space || !/^[1-9]\d*$/.test(space) || !Number.isSafeInteger(Number(space))) {
  throw new Error("Set process.env.GOOSE_EGO_SPACE to an existing numeric space ID inside ego nodejs before evaluating this script (optional GOOSE_EGO_PAGE defaults to p1).");
}
const task = await taskSpace(Number(space));
const page = task.page(process.env.GOOSE_EGO_PAGE || "p1");
const url = new URL(await page.url());
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.searchParams.has("e2eLocalMock"),
  "Use an existing local Vite ?e2eLocalMock page, not real notes",
);

const result = await page.evaluate(async () => {
  const source = await (await fetch("/src/pages/workspace/components/outline/useHeadings.ts")).text();
  const main = await (await fetch("/src/main.tsx")).text();
  const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1];
  const clientPath = main.match(/from "([^"]*react-dom_client\.js[^"]*)"/)?.[1];
  if (!reactPath || !clientPath) throw new Error("Expected Vite's transformed React module imports");
  const { default: React } = await import(reactPath);
  const { createRoot } = (await import(clientPath)).default;
  const version = Date.now();
  const { useHeadings } = await import(`/src/pages/workspace/components/outline/useHeadings.ts?probe=${version}`);
  const { getHeadingAnchorElement } = await import(`/src/pages/workspace/components/outline/useActiveHeading.ts?probe=${version}`);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;width:1px;height:1px;overflow:hidden";
  document.body.append(host);
  const root = createRoot(host);
  const frames = new Map();
  const originalRequest = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  let capture = false;
  let frameId = 1000000000;
  window.requestAnimationFrame = (callback) => {
    if (!capture) return originalRequest.call(window, callback);
    frames.set(++frameId, callback);
    return frameId;
  };
  window.cancelAnimationFrame = (id) => {
    if (!frames.delete(id)) originalCancel.call(window, id);
  };
  const makeEditor = (text) => ({
    document: [{ id: text, type: "heading", props: { level: 2 }, content: text }],
    prosemirrorView: { dom: document.createElement("div"), composing: false },
    onChange: () => () => {},
  });
  const waitFor = async (condition) => {
    const until = Date.now() + 3000;
    while (!condition() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 10));
    if (!condition()) throw new Error("Probe render timeout");
  };
  function Probe({ editor }) {
    return React.createElement("span", null, useHeadings(editor, editor.document[0].id).map((heading) => heading.text).join(","));
  }
  try {
    const a = makeEditor("heading-A");
    const b = makeEditor("heading-B");
    root.render(React.createElement(Probe, { editor: a }));
    await waitFor(() => host.textContent === "heading-A");
    capture = true;
    a.prosemirrorView.dom.dispatchEvent(new Event("compositionend"));
    a.prosemirrorView.dom.dispatchEvent(new Event("compositionend"));
    capture = false;
    const pendingAfterComposition = frames.size;
    root.render(React.createElement(Probe, { editor: b }));
    await waitFor(() => host.textContent === "heading-B");
    const pendingAfterSwitch = frames.size;
    for (const callback of frames.values()) callback(performance.now());
    frames.clear();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const ime = { pendingAfterComposition, pendingAfterSwitch, actual: host.textContent };
    const selector = [];
    for (const id of ["normal", 'quote"id', "back\\slash", '"]']) {
      const container = document.createElement("div");
      const block = document.createElement("div");
      block.setAttribute("data-id", id);
      container.append(block);
      try {
        selector.push({ id, found: getHeadingAnchorElement(container, id) === block });
      } catch (error) {
        selector.push({ id, found: false, error: String(error) });
      }
    }
    return { ime, selector };
  } finally {
    root.unmount();
    window.requestAnimationFrame = originalRequest;
    window.cancelAnimationFrame = originalCancel;
    host.remove();
  }
});

assert.equal(result.ime.pendingAfterComposition, 1, "compositionend coalesces to one frame");
assert.equal(result.ime.pendingAfterSwitch, 0, "switching editors cancels the old frame");
assert.equal(result.ime.actual, "heading-B", "queued IME refresh must not restore heading-A");
assert.equal(result.selector.length, 4);
for (const entry of result.selector) {
  assert.equal(entry.found, true, `Heading ${JSON.stringify(entry.id)}: ${entry.error || "not found"}`);
}
console.log("outlineLifecycle.browser: PASS", JSON.stringify(result));
