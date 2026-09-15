import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { lockWebContentsPageZoom } from "../../electron/main/pageZoom";
import type { WebContents } from "electron";

test("应用菜单不含 Electron 页面缩放项", () => {
  const index = readFileSync(
    new URL("../../electron/main/index.ts", import.meta.url),
    "utf8",
  );
  expect(index).toContain("lockWebContentsPageZoom");
  expect(index).toContain("web-contents-created");
  expect(index).toContain("disable-pinch");
  expect(index).toContain('{ role: "reload" }');
  expect(index).toContain('{ role: "toggleDevTools" }');
  expect(index).toContain('{ role: "togglefullscreen" }');
  expect(index).not.toContain('role: "zoomIn"');
  expect(index).not.toContain('role: "zoomOut"');
  expect(index).not.toContain('role: "resetZoom"');
});

test("新建窗口默认 zoomFactor 为 1", () => {
  const windows = readFileSync(
    new URL("../../electron/main/windows.ts", import.meta.url),
    "utf8",
  );
  expect(windows).toContain("zoomFactor: 1");
});

function fakeContents(type = "window") {
  let destroyed = false;
  let zoomFactor = 2;
  let zoomLevel = 3;
  let visualLimits: [number, number] | null = null;
  const handlers = new Map<string, Array<() => void>>();
  const contents = {
    getType: () => type,
    isDestroyed: () => destroyed,
    setZoomFactor: (value: number) => {
      zoomFactor = value;
    },
    setZoomLevel: (value: number) => {
      zoomLevel = value;
    },
    setVisualZoomLevelLimits: async (min: number, max: number) => {
      visualLimits = [min, max];
    },
    on: (event: string, handler: () => void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    emit: (event: string) => {
      for (const handler of handlers.get(event) ?? []) handler();
    },
    destroy: () => {
      destroyed = true;
    },
    snapshot: () => ({ zoomFactor, zoomLevel, visualLimits }),
  };
  return contents;
}

test("锁页面缩放并在加载完成、缩放事件后钉回 1", () => {
  const contents = fakeContents();
  lockWebContentsPageZoom(contents as unknown as WebContents);
  expect(contents.snapshot()).toEqual({
    zoomFactor: 1,
    zoomLevel: 0,
    visualLimits: [1, 1],
  });

  contents.setZoomFactor(0.5);
  contents.setZoomLevel(-2);
  contents.emit("did-finish-load");
  expect(contents.snapshot().zoomFactor).toBe(1);
  expect(contents.snapshot().zoomLevel).toBe(0);

  contents.setZoomFactor(1.4);
  contents.emit("zoom-changed");
  expect(contents.snapshot().zoomFactor).toBe(1);
});

test("不锁 DevTools 的页面缩放", () => {
  const contents = fakeContents("devtools");
  lockWebContentsPageZoom(contents as unknown as WebContents);
  expect(contents.snapshot()).toEqual({
    zoomFactor: 2,
    zoomLevel: 3,
    visualLimits: null,
  });
});
