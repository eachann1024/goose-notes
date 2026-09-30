import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { useSidebarResize } from "../../src/pages/workspace/components/sidebar/hooks/useSidebarResize";

const { window: testWindow, document: testDocument } = parseHTML("<html><body></body></html>");
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const storage = new Map<string, string>();
const globals = {
  window: testWindow,
  document: testDocument,
  HTMLElement: testWindow.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  },
  cancelAnimationFrame: (id: number) => frames.delete(id),
};
const originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
afterAll(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

let root: Root | null = null;
let result: ReturnType<typeof useSidebarResize>;
let renders = 0;
let previews: number[] = [];
const preview = (width: number) => previews.push(width);
function Harness({ maxWidth = 480, disabled = false }: { maxWidth?: number; disabled?: boolean }) {
  result = useSidebarResize({ onWidthPreview: preview, maxWidth, disableResize: disabled });
  renders++;
  return null;
}
function mount(maxWidth = 480) {
  const container = testDocument.createElement("div");
  testDocument.body.append(container);
  root = createRoot(container);
  act(() => root!.render(createElement(Harness, { maxWidth })));
}
function begin() {
  act(() => result.handleResizePointerDown({
    button: 0, isPrimary: true, pointerId: 1, clientX: 100, currentTarget: {}, preventDefault() {},
  } as never));
}
function pointer(type: string, clientX: number, pointerId = 1) {
  const event = new testWindow.Event(type);
  Object.assign(event, { clientX, pointerId });
  act(() => testDocument.dispatchEvent(event));
}
function frame() {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(0)));
}
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  frames.clear();
  storage.clear();
  previews = [];
  renders = 0;
  testDocument.body.innerHTML = "";
});

describe("sidebar resize gesture", () => {
  test("coalesces movement without rerendering the tree and commits the release position", () => {
    mount();
    begin();
    const startedRenders = renders;
    for (let x = 101; x <= 150; x++) pointer("pointermove", x);
    expect(frames.size).toBe(1);
    expect(renders).toBe(startedRenders);
    expect(result.width).toBe(288);
    frame();
    expect(previews).toEqual([338]);
    expect(renders).toBe(startedRenders);
    pointer("pointerup", 160);
    expect(result.width).toBe(348);
    expect(result.isResizing).toBe(false);
    expect(previews.at(-1)).toBe(348);
    expect(frames.size).toBe(0);
    pointer("pointermove", 200);
    expect(frames.size).toBe(0);
  });

  test("ignores unrelated pointers and respects overlay bounds", () => {
    mount(319);
    begin();
    pointer("pointermove", 300, 2);
    pointer("pointerup", 300, 2);
    expect(frames.size).toBe(0);
    expect(result.isResizing).toBe(true);
    pointer("pointermove", 300);
    frame();
    expect(previews.at(-1)).toBe(319);
    pointer("pointerup", -100);
    expect(result.width).toBe(268);
  });

  test("blur and cancel preserve the last position and restore body styles", () => {
    testDocument.body.style.cursor = "crosshair";
    testDocument.body.style.userSelect = "text";
    mount();
    begin();
    pointer("pointermove", 140);
    act(() => testWindow.dispatchEvent(new testWindow.Event("blur")));
    expect(result.width).toBe(328);
    expect(result.isResizing).toBe(false);
    expect(testDocument.body.style.cursor).toBe("crosshair");
    expect(testDocument.body.style.userSelect).toBe("text");
    begin();
    pointer("pointermove", 120);
    pointer("pointercancel", 0);
    expect(result.width).toBe(348);
    expect(frames.size).toBe(0);
  });

  test("unmount cancels pending frames and listeners", () => {
    mount();
    begin();
    pointer("pointermove", 140);
    act(() => root!.unmount());
    root = null;
    expect(frames.size).toBe(0);
    expect(previews).toEqual([]);
    pointer("pointermove", 160);
    expect(frames.size).toBe(0);
  });

  test("viewport changes end the gesture and clamp the committed width", () => {
    mount();
    begin();
    pointer("pointermove", 240);
    act(() => root!.render(createElement(Harness, { maxWidth: 319 })));
    expect(result.width).toBe(319);
    expect(result.isResizing).toBe(false);
    expect(frames.size).toBe(0);
  });
});
