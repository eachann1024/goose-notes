import { expect, test } from "playwright/test";
import { shell } from "../../src/lib/utools/shell";

test.afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("Electron 无 utools API 时 openPath / showItemInFolder / openUrl 回退 gooseDesktop", async () => {
  const calls: string[] = [];
  (globalThis as any).window = {
    gooseDesktop: {
      openPath: async (p: string) => {
        calls.push(`openPath:${p}`);
      },
      showItemInFolder: async (p: string) => {
        calls.push(`showItemInFolder:${p}`);
      },
      openUrl: async (u: string) => {
        calls.push(`openUrl:${u}`);
      },
    },
  };

  // 无 utools 时 openPath / showItemInFolder 应返回 true 并把调用交给 gooseDesktop。
  expect(await shell.openPath("/root/pearl/note.md")).toBe(true);
  expect(await shell.showItemInFolder("/root/pearl/note.md")).toBe(true);
  shell.openUrl("https://example.com/pearl");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(calls).toEqual([
    "openPath:/root/pearl/note.md",
    "showItemInFolder:/root/pearl/note.md",
    "openUrl:https://example.com/pearl",
  ]);
});

test("gooseDesktop 不可用时 openPath / showItemInFolder 返回 false", async () => {
  (globalThis as any).window = {};
  expect(await shell.openPath("/x/note.md")).toBe(false);
  expect(await shell.showItemInFolder("/x/note.md")).toBe(false);
});
