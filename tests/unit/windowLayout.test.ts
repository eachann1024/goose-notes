import { expect, test } from "playwright/test";
import path from "node:path";
import {
  clampBoundsToWorkArea,
  computeOffsetBounds,
  DEFAULT_WORKSPACE_HEIGHT,
  DEFAULT_WORKSPACE_WIDTH,
  MIN_QUICKNOTE_HEIGHT,
  MIN_QUICKNOTE_WIDTH,
  MIN_WORKSPACE_HEIGHT,
  MIN_WORKSPACE_WIDTH,
  NEW_WINDOW_OFFSET_PX,
  parseWindowLayout,
  serializeWindowLayout,
  windowLayoutFilePath,
} from "../../electron/main/windowLayout";

const workArea = { x: 0, y: 25, width: 1920, height: 1080 };

test("window-layout.json lives under userData", () => {
  expect(windowLayoutFilePath("/tmp/Goose Note")).toBe(
    path.join("/tmp/Goose Note", "window-layout.json"),
  );
});

test("parseWindowLayout keeps valid windows, chrome flags and quicknote", () => {
  const parsed = parseWindowLayout(
    JSON.stringify({
      version: 1,
      windows: [
        {
          id: "alpha",
          bounds: { x: 80, y: 60, width: 1250, height: 800 },
          tabs: [{ id: "tab-1", pageId: "page-1", type: "page", pinned: false }],
          maximized: true,
          fullScreen: false,
        },
        { id: "skip-me" },
        {
          id: "beta",
          bounds: { x: 112, y: 92, width: 1250, height: 800 },
          fullScreen: true,
        },
      ],
      quicknote: { bounds: { x: 40, y: 80, width: 480, height: 350 } },
    }),
  );
  expect(parsed).toEqual({
    version: 1,
    windows: [
      {
        id: "alpha",
        bounds: { x: 80, y: 60, width: 1250, height: 800 },
        tabs: [{ id: "tab-1", pageId: "page-1", type: "page", pinned: false }],
        maximized: true,
      },
      {
        id: "beta",
        bounds: { x: 112, y: 92, width: 1250, height: 800 },
        fullScreen: true,
      },
    ],
    quicknote: { bounds: { x: 40, y: 80, width: 480, height: 350 } },
  });
});

test("parseWindowLayout rejects corrupt or mismatched payloads", () => {
  expect(parseWindowLayout("{")).toBeNull();
  expect(parseWindowLayout(JSON.stringify({ version: 2, windows: [] }))).toBeNull();
  expect(parseWindowLayout(JSON.stringify({ version: 1, windows: "nope" }))).toBeNull();
});

test("serializeWindowLayout round-trips through parse", () => {
  const layout = {
    version: 1 as const,
    windows: [
      { id: "w", bounds: { x: 10, y: 20, width: 1250, height: 800 } },
    ],
  };
  expect(parseWindowLayout(serializeWindowLayout(layout))).toEqual(layout);
});

test("new window offsets +32,+32 and stays inside the work area", () => {
  expect(
    computeOffsetBounds(
      { x: 100, y: 80, width: 1250, height: 800 },
      workArea,
    ),
  ).toEqual({
    x: 100 + NEW_WINDOW_OFFSET_PX,
    y: 80 + NEW_WINDOW_OFFSET_PX,
    width: DEFAULT_WORKSPACE_WIDTH,
    height: DEFAULT_WORKSPACE_HEIGHT,
  });

  const clamped = computeOffsetBounds(
    { x: 1400, y: 800, width: 1250, height: 800 },
    workArea,
  );
  expect(clamped.x + clamped.width).toBeLessThanOrEqual(workArea.x + workArea.width);
  expect(clamped.y + clamped.height).toBeLessThanOrEqual(workArea.y + workArea.height);
});

test("missing source window is centered in the work area", () => {
  const centered = computeOffsetBounds(null, workArea);
  expect(centered.width).toBe(DEFAULT_WORKSPACE_WIDTH);
  expect(centered.height).toBe(DEFAULT_WORKSPACE_HEIGHT);
  expect(centered.x).toBe(
    workArea.x + Math.round((workArea.width - DEFAULT_WORKSPACE_WIDTH) / 2),
  );
});

test("workspace clamp uses Chrome-like 500 min width", () => {
  expect(MIN_WORKSPACE_WIDTH).toBe(500);
  expect(MIN_WORKSPACE_HEIGHT).toBe(560);
  const clamped = clampBoundsToWorkArea(
    { x: 10, y: 30, width: 200, height: 100 },
    workArea,
  );
  expect(clamped.width).toBe(MIN_WORKSPACE_WIDTH);
  expect(clamped.height).toBe(MIN_WORKSPACE_HEIGHT);
});

test("clampBoundsToWorkArea can use quicknote min size", () => {
  const clamped = clampBoundsToWorkArea(
    { x: 10, y: 30, width: 200, height: 100 },
    workArea,
    { width: MIN_QUICKNOTE_WIDTH, height: MIN_QUICKNOTE_HEIGHT },
  );
  expect(clamped.width).toBe(MIN_QUICKNOTE_WIDTH);
  expect(clamped.height).toBe(MIN_QUICKNOTE_HEIGHT);
  expect(clamped.x).toBe(10);
  expect(clamped.y).toBe(30);
});

test("clampBoundsToWorkArea never exceeds the display", () => {
  const clamped = clampBoundsToWorkArea(
    { x: -200, y: -40, width: 3000, height: 2000 },
    workArea,
  );
  expect(clamped.x).toBe(workArea.x);
  expect(clamped.y).toBe(workArea.y);
  expect(clamped.width).toBe(workArea.width);
  expect(clamped.height).toBe(workArea.height);
});
