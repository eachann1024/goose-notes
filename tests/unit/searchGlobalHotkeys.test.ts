import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, test } from "playwright/test";
import * as accelerator from "../../src/lib/electron/accelerator";

function loadHotkeys() {
  const callbacks = new Map<string, () => void>();
  const removed: string[] = [];
  const sent: string[] = [];
  let focused = 0;
  let destroyed = false;
  let occupied = false;
  const source = readFileSync(new URL("../../electron/main/hotkeys.ts", import.meta.url), "utf8");
  type HotkeyResult = { wakeOk: boolean; quicknoteOk: boolean; searchOk: boolean };
  const exports = {} as {
    registerHotkeys: (keys: { wake: string; quicknote: string; search: string }) => HotkeyResult;
    pauseGlobalHotkeys: () => void;
    resumeGlobalHotkeys: () => HotkeyResult;
    unregisterAllHotkeys: () => void;
  };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports,
    process: { platform: "darwin" },
    require: (id: string) => {
      if (id === "electron") return { globalShortcut: {
        register: (key: string, callback: () => void) => {
          if (occupied) return false;
          callbacks.set(key, callback);
          return true;
        },
        unregister: (key: string) => { removed.push(key); callbacks.delete(key); },
        unregisterAll: () => callbacks.clear(),
      } };
      if (id.endsWith("/accelerator")) return accelerator;
      if (id === "./windows") return {
        getMainWindow: () => ({ isDestroyed: () => destroyed, webContents: { send: (channel: string) => sent.push(channel) } }),
        showAndFocusMainWindow: () => { focused++; },
        toggleQuicknoteWindow: () => {},
        toggleWindow: () => {},
      };
      return createRequire(import.meta.url)(id);
    },
  });
  return { exports, callbacks, removed, sent, focused: () => focused, destroy: () => { destroyed = true; }, occupy: () => { occupied = true; } };
}

test("main-process search rebind, pause/resume, disable and cleanup respect current request", () => {
  const runtime = loadHotkeys();
  const keys = { wake: "", quicknote: "", search: "CmdOrCtrl+Shift+K" };
  expect(runtime.exports.registerHotkeys(keys).searchOk).toBe(true);
  expect(runtime.callbacks.size).toBe(1);
  expect([...runtime.callbacks.keys()][0]).toContain("Shift");
  runtime.exports.registerHotkeys(keys);
  expect(runtime.removed).toEqual([]);
  runtime.callbacks.values().next().value!();
  expect(runtime.focused()).toBe(1);
  expect(runtime.sent).toEqual(["desktop:open-search"]);
  runtime.exports.pauseGlobalHotkeys();
  expect(runtime.callbacks.size).toBe(0);
  runtime.exports.registerHotkeys({ ...keys, search: "CmdOrCtrl+Alt+K" });
  expect(runtime.callbacks.size).toBe(0);
  runtime.exports.resumeGlobalHotkeys();
  expect(runtime.callbacks.size).toBe(1);
  expect([...runtime.callbacks.keys()][0]).toContain("Alt");
  runtime.destroy();
  runtime.callbacks.values().next().value!();
  expect(runtime.sent).toHaveLength(1);
  runtime.exports.registerHotkeys({ ...keys, search: "" });
  runtime.exports.pauseGlobalHotkeys();
  runtime.exports.resumeGlobalHotkeys();
  expect(runtime.callbacks.size).toBe(0);
  runtime.exports.registerHotkeys(keys);
  runtime.exports.unregisterAllHotkeys();
  expect(runtime.callbacks.size).toBe(0);
});

test("main-process search reports registration failure after removing old key", () => {
  const runtime = loadHotkeys();
  const keys = { wake: "", quicknote: "", search: "CmdOrCtrl+Shift+K" };
  runtime.exports.registerHotkeys(keys);
  runtime.occupy();
  expect(runtime.exports.registerHotkeys({ ...keys, search: "CmdOrCtrl+Alt+K" }).searchOk).toBe(false);
  expect(runtime.callbacks.size).toBe(0);
  expect(runtime.removed).toHaveLength(1);
});
