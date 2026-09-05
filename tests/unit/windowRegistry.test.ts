import { expect, test } from "playwright/test";
import {
  shouldHideInsteadOfClose,
  WindowRegistry,
} from "../../electron/main/windowRegistry";

test("registry tracks workspace and quicknote separately", () => {
  const registry = new WindowRegistry<string>();
  registry.register({ id: "w1", kind: "workspace", win: "main" });
  registry.register({ id: "q1", kind: "quicknote", win: "note" });

  expect(registry.workspaceCount()).toBe(1);
  expect(registry.quicknote()?.id).toBe("q1");
  expect(registry.findByWin("main")?.id).toBe("w1");
  expect(registry.all().map((record) => record.id)).toEqual(["w1", "q1"]);
});

test("last focused workspace falls back to the first remaining window", () => {
  const registry = new WindowRegistry<number>();
  registry.register({ id: "a", kind: "workspace", win: 1 });
  registry.register({ id: "b", kind: "workspace", win: 2 });
  registry.markFocused("b");
  expect(registry.lastFocusedWorkspace()?.id).toBe("b");

  registry.unregister("b");
  expect(registry.lastFocusedWorkspace()?.id).toBe("a");
  expect(registry.isLastWorkspace("a")).toBe(true);
});

test("quicknote is ignored when resolving last focused workspace", () => {
  const registry = new WindowRegistry<string>();
  registry.register({ id: "q", kind: "quicknote", win: "note" });
  registry.markFocused("q");
  expect(registry.lastFocusedWorkspace()).toBeUndefined();

  registry.register({ id: "w", kind: "workspace", win: "main" });
  expect(registry.lastFocusedWorkspace()?.id).toBe("w");
});

test("snapshotLayout serializes bounds and optional tabs", () => {
  const registry = new WindowRegistry<{ x: number }>();
  registry.register({
    id: "w1",
    kind: "workspace",
    win: { x: 40 },
    tabs: [{ id: "t1", pageId: "p1", pinned: true }],
  });
  registry.register({ id: "q", kind: "quicknote", win: { x: 0 } });

  expect(
    registry.snapshotLayout((win) => ({
      x: win.x,
      y: 10,
      width: 1250,
      height: 800,
    })),
  ).toEqual({
    version: 1,
    windows: [
      {
        id: "w1",
        bounds: { x: 40, y: 10, width: 1250, height: 800 },
        tabs: [{ id: "t1", pageId: "p1", pinned: true }],
      },
    ],
  });
});

test("only the last workspace hides instead of closing unless quitting", () => {
  expect(
    shouldHideInsteadOfClose({
      quitting: false,
      kind: "workspace",
      isLastWorkspace: true,
    }),
  ).toBe(true);
  expect(
    shouldHideInsteadOfClose({
      quitting: false,
      kind: "workspace",
      isLastWorkspace: false,
    }),
  ).toBe(false);
  expect(
    shouldHideInsteadOfClose({
      quitting: false,
      kind: "quicknote",
      isLastWorkspace: false,
    }),
  ).toBe(false);
  expect(
    shouldHideInsteadOfClose({
      quitting: true,
      kind: "workspace",
      isLastWorkspace: true,
    }),
  ).toBe(false);
  expect(
    shouldHideInsteadOfClose({
      quitting: true,
      kind: "quicknote",
      isLastWorkspace: false,
    }),
  ).toBe(false);
});
