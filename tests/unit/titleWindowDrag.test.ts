import { expect, test } from "playwright/test";
import {
  bindOptionWindowDrag,
  computeWindowDragOrigin,
  endWindowDragging,
  OPTION_WINDOW_DRAG_CLASS,
  shouldStartWindowDrag,
  startWindowDragging,
  WINDOW_DRAGGING_CLASS,
} from "../../src/lib/electron/windowDrag";

test("Option switches native drag before a press and clears on blur/unmount", () => {
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  const target = new EventTarget();
  const classes = new Set<string>();
  const classList = {
    contains: (name: string) => classes.has(name),
    remove: (name: string) => { classes.delete(name); },
    toggle: (name: string, on: boolean) => {
      if (on) classes.add(name);
      else classes.delete(name);
    },
  };
  Object.assign(globalThis, {
    window: target,
    document: { documentElement: { classList } },
  });
  const send = (type: string, altKey = false, buttons = 0) => {
    target.dispatchEvent(Object.assign(new Event(type), { altKey, buttons }));
  };
  const unbind = bindOptionWindowDrag();
  try {
    send("keydown", true);
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(true);
    send("keyup");
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(false);
    send("pointermove", true, 1);
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(false);
    send("pointermove", true);
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(true);
    send("blur");
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(false);
    classes.add(WINDOW_DRAGGING_CLASS);
    send("keydown", true);
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(false);
    classes.delete(WINDOW_DRAGGING_CLASS);
    send("keydown", true);
    unbind();
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(false);
    send("keydown", true);
    send("pointermove", true);
    expect(classes.has(OPTION_WINDOW_DRAG_CLASS)).toBe(false);
  } finally {
    unbind();
    Object.assign(globalThis, { window: prevWindow, document: prevDocument });
  }
});

test("title pointer stays a click within the drag threshold", () => {
  expect(shouldStartWindowDrag(10, 10, 12, 11)).toBe(false);
  expect(shouldStartWindowDrag(0, 0, 3, 2)).toBe(false);
});

test("title pointer becomes a window drag once movement crosses the threshold", () => {
  expect(shouldStartWindowDrag(10, 10, 14, 10)).toBe(true);
  expect(shouldStartWindowDrag(0, 0, 0, 5)).toBe(true);
});

test("window origin follows the cursor delta from the press point", () => {
  expect(
    computeWindowDragOrigin({ x: 100, y: 80 }, { x: 140, y: 90 }, { x: 200, y: 110 }),
  ).toEqual({ x: 160, y: 100 });
  expect(
    computeWindowDragOrigin({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 10 }),
  ).toEqual({ x: 0, y: 0 });
});

test("start/end window dragging no-op without gooseDesktop", async () => {
  const prev = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {};
  try {
    await startWindowDragging();
    await endWindowDragging();
  } finally {
    (globalThis as { window?: unknown }).window = prev;
  }
});

test("start/end window dragging toggle grabbing cursor class", async () => {
  const classes = new Set<string>();
  const root = {
    classList: {
      add: (name: string) => void classes.add(name),
      remove: (name: string) => void classes.delete(name),
      contains: (name: string) => classes.has(name),
      toggle: (name: string, on?: boolean) => {
        if (on === undefined) {
          if (classes.has(name)) classes.delete(name);
          else classes.add(name);
          return classes.has(name);
        }
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
    },
  };
  const prev = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { documentElement: root };
  try {
    await startWindowDragging();
    expect(root.classList.contains(WINDOW_DRAGGING_CLASS)).toBe(true);
    await endWindowDragging();
    expect(root.classList.contains(WINDOW_DRAGGING_CLASS)).toBe(false);
  } finally {
    (globalThis as { document?: unknown }).document = prev;
  }
});

test("start/end window dragging call gooseDesktop when present", async () => {
  const prev = (globalThis as { window?: unknown }).window;
  const calls: string[] = [];
  (globalThis as { window?: unknown }).window = {
    gooseDesktop: {
      startWindowDrag: async () => {
        calls.push("start");
      },
      endWindowDrag: async () => {
        calls.push("end");
      },
    },
  };
  try {
    await startWindowDragging();
    await endWindowDragging();
    expect(calls).toEqual(["start", "end"]);
  } finally {
    (globalThis as { window?: unknown }).window = prev;
  }
});
