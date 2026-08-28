"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAIN_FEATURE_CODE,
  shouldHideOnHotkeyRetrigger,
  hidePluginToBackground,
} = require("./pluginHotkeyToggle.cjs");

test("主入口 code 与 plugin.json 一致", () => {
  assert.equal(MAIN_FEATURE_CODE, "gn");
});

test("首次唤起不关闭", () => {
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "gn",
      from: "hotkey",
      pluginVisible: false,
    }),
    false,
  );
});

test("快捷键再按一次、窗口已显示则关闭", () => {
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "gn",
      from: "hotkey",
      pluginVisible: true,
    }),
    true,
  );
});

test("旧 uTools 不传 from 时，已显示的 gn 再进入仍关闭", () => {
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "gn",
      pluginVisible: true,
    }),
    true,
  );
});

test("搜索框或超级面板进入已打开的窗口只聚焦，不关闭", () => {
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "gn",
      from: "main",
      pluginVisible: true,
    }),
    false,
  );
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "gn",
      from: "panel",
      pluginVisible: true,
    }),
    false,
  );
});

test("redirect 与其它 feature 不走快捷键开关", () => {
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "gn",
      from: "reirect",
      pluginVisible: true,
    }),
    false,
  );
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "new_page",
      from: "hotkey",
      pluginVisible: true,
    }),
    false,
  );
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "open_folder",
      from: "hotkey",
      pluginVisible: true,
    }),
    false,
  );
  assert.equal(
    shouldHideOnHotkeyRetrigger({
      code: "quicknote_save",
      from: "hotkey",
      pluginVisible: true,
    }),
    false,
  );
});

test("收起后台会 hideMainWindow 且 outPlugin(false)", () => {
  const calls = [];
  hidePluginToBackground({
    removeSubInput: () => calls.push("removeSubInput"),
    hideMainWindow: () => calls.push("hideMainWindow"),
    outPlugin: (isKill) => calls.push(["outPlugin", isKill]),
  });
  assert.deepEqual(calls, [
    "removeSubInput",
    "hideMainWindow",
    ["outPlugin", false],
  ]);
});

test("收起后台在 API 缺失或抛错时不中断", () => {
  assert.doesNotThrow(() => hidePluginToBackground(undefined));
  assert.doesNotThrow(() =>
    hidePluginToBackground({
      removeSubInput: () => {
        throw new Error("remove");
      },
      hideMainWindow: () => {
        throw new Error("hide");
      },
      outPlugin: () => {
        throw new Error("out");
      },
    }),
  );
});
