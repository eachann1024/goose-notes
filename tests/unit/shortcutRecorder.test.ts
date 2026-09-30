import { expect, test } from "playwright/test";
import { getShortcutFromKeyEvent } from "../../src/pages/workspace/components/sidebar/settings/ShortcutField";
import {
  getAllConfiguredShortcuts,
  normalizeShortcutForConflict,
} from "../../src/pages/workspace/components/sidebar/settings/SettingsShortcuts";
import { canonicalizeRecordedShortcut } from "../../src/lib/shortcut-platform";
import { getFixedAppShortcuts } from "../../src/lib/fixed-app-shortcuts";
import { DEFAULT_APP_SHORTCUTS } from "../../src/stores/settings/slices/shortcutsSlice";
import { DEFAULT_CLOSE_TAB_SHORTCUT } from "../../src/stores/settings/types";

function shortcutEvent(init: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}) {
  return {
    key: init.key,
    code: init.code ?? "",
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false,
    preventDefault() {},
    stopPropagation() {},
  };
}

test("shortcut recorder supports Space and defers modifier-only input", () => {
  expect(
    getShortcutFromKeyEvent(shortcutEvent({ key: " ", code: "Space" })),
  ).toBe("Space");
  expect(
    getShortcutFromKeyEvent(
      shortcutEvent({ key: " ", code: "Space", metaKey: true, shiftKey: true }),
    ),
  ).toBe("Meta+Shift+Space");
  expect(
    getShortcutFromKeyEvent(shortcutEvent({ key: "Meta", metaKey: true })),
  ).toBe("");
  expect(
    getShortcutFromKeyEvent(shortcutEvent({ key: "Control", ctrlKey: true })),
  ).toBe("");
});

test("shortcut recorder keeps the plus key unambiguous", () => {
  expect(
    getShortcutFromKeyEvent(
      shortcutEvent({ key: "+", code: "Equal", shiftKey: true }),
    ),
  ).toBe("Shift+Plus");
});

test("shortcut recorder restores physical bracket keys after macOS Option composition", () => {
  expect(
    getShortcutFromKeyEvent(
      shortcutEvent({
        key: "“",
        code: "BracketLeft",
        metaKey: true,
        altKey: true,
      }),
    ),
  ).toBe("Meta+Alt+[");
  expect(
    getShortcutFromKeyEvent(
      shortcutEvent({
        key: "‘",
        code: "BracketRight",
        metaKey: true,
        altKey: true,
      }),
    ),
  ).toBe("Meta+Alt+]");
  // 未发生合成时仍保留输入法/布局提供的 event.key。
  expect(
    getShortcutFromKeyEvent(
      shortcutEvent({ key: "[", code: "BracketLeft", metaKey: true }),
    ),
  ).toBe("Meta+[");
});

test("conflict normalization aligns Mod with the current platform primary modifier", () => {
  expect(normalizeShortcutForConflict("Mod+K", true)).toBe(
    normalizeShortcutForConflict("Meta+K", true),
  );
  expect(normalizeShortcutForConflict("Mod+K", false)).toBe(
    normalizeShortcutForConflict("Ctrl+K", false),
  );
  expect(normalizeShortcutForConflict("Shift+Ctrl+K", false)).toBe(
    normalizeShortcutForConflict("Control+Shift+K", false),
  );
  expect(normalizeShortcutForConflict("Mod+K", "linux")).not.toBe(
    normalizeShortcutForConflict("Super+K", "linux"),
  );
  expect(normalizeShortcutForConflict("Super+K", "linux")).toBe(
    normalizeShortcutForConflict("Meta+K", "linux"),
  );
});

test("recorded primary modifiers canonicalize to portable Mod or explicit Super", () => {
  expect(canonicalizeRecordedShortcut("Meta+K", "mac")).toBe("Mod+K");
  expect(canonicalizeRecordedShortcut("Ctrl+K", "windows")).toBe("Mod+K");
  expect(canonicalizeRecordedShortcut("Ctrl+K", "linux")).toBe("Mod+K");
  expect(canonicalizeRecordedShortcut("Meta+K", "linux")).toBe("Super+K");
  expect(canonicalizeRecordedShortcut("Meta+K", "windows")).toBe("Super+K");
  expect(canonicalizeRecordedShortcut("Ctrl+K", "mac")).toBe("Ctrl+K");
});

test("configured shortcut conflicts include fixed shortcuts", () => {
  const configured = getAllConfiguredShortcuts({}, "", "", "unused");
  expect(configured).toContain(normalizeShortcutForConflict("Mod+N"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+F"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Shift+T"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+1"));
  expect(configured).toContain(normalizeShortcutForConflict("Ctrl+Tab"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Shift+G"));
  expect(configured).toContain(normalizeShortcutForConflict("Shift+F3"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+S"));
  expect(configured).not.toContain(normalizeShortcutForConflict("Mod+B"));
  expect(configured).not.toContain(normalizeShortcutForConflict("Mod+K"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Z"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Shift+Z"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Y"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Shift+M"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Shift+A"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Shift+F"));
  expect(configured).toContain(normalizeShortcutForConflict("Mod+Shift+C"));
  expect(configured).toContain(normalizeShortcutForConflict("Ctrl+`"));
});

test("Windows reserves save shortcuts without blocking editor formatting or Super", () => {
  const configured = getAllConfiguredShortcuts({}, "", "", "unused", false);
  expect(configured).not.toContain(normalizeShortcutForConflict("Ctrl+B", false));
  expect(configured).not.toContain(normalizeShortcutForConflict("Ctrl+K", false));
  expect(configured).toContain(normalizeShortcutForConflict("Ctrl+S", false));
  expect(configured).not.toContain(
    normalizeShortcutForConflict("Ctrl+D", false),
  );
  expect(configured).not.toContain(
    normalizeShortcutForConflict("Alt+K", false),
  );
  expect(configured).not.toContain(
    normalizeShortcutForConflict("Meta+K", false),
  );
});

test("single-tab mode ignores inactive tab-only shortcuts for conflict detection", () => {
  const appShortcuts = {
    ...DEFAULT_APP_SHORTCUTS,
  };
  const isMac = true;
  const multiTab = getAllConfiguredShortcuts(
    appShortcuts,
    "Mod+W",
    "Esc",
    "openSearch",
    isMac,
    false,
  );
  expect(multiTab).toContain(normalizeShortcutForConflict("Mod+[", isMac));
  expect(multiTab).toContain(normalizeShortcutForConflict("Mod+]", isMac));
  expect(multiTab).toContain(normalizeShortcutForConflict("Mod+T", isMac));
  expect(multiTab).toContain(normalizeShortcutForConflict("Mod+W", isMac));
  expect(multiTab).toContain(normalizeShortcutForConflict("Mod+1", isMac));
  expect(multiTab).toContain(
    normalizeShortcutForConflict("Mod+Shift+T", isMac),
  );
  expect(multiTab).toContain(normalizeShortcutForConflict("Ctrl+Tab", isMac));

  const singleTab = getAllConfiguredShortcuts(
    appShortcuts,
    "Mod+W",
    "Esc",
    "openSearch",
    isMac,
    true,
  );
  // 单标签下新建标签/关标签与标签切换热键均不生效，不应占用。
  // 后退/前进仍用于文件浏览历史，继续占用。
  expect(singleTab).toContain(normalizeShortcutForConflict("Mod+[", isMac));
  expect(singleTab).toContain(normalizeShortcutForConflict("Mod+]", isMac));
  expect(singleTab).not.toContain(normalizeShortcutForConflict("Mod+T", isMac));
  expect(singleTab).not.toContain(normalizeShortcutForConflict("Mod+W", isMac));
  // 1~3 切侧栏视图，单标签下仍然生效。
  expect(singleTab).toContain(normalizeShortcutForConflict("Mod+1", isMac));
  expect(singleTab).not.toContain(normalizeShortcutForConflict("Mod+4", isMac));
  expect(singleTab).not.toContain(
    normalizeShortcutForConflict("Mod+Shift+T", isMac),
  );
  expect(singleTab).not.toContain(
    normalizeShortcutForConflict("Ctrl+Tab", isMac),
  );
  // 仍生效的固定与可配置项继续占用。
  expect(singleTab).toContain(normalizeShortcutForConflict("Mod+N", isMac));
  expect(singleTab).toContain(normalizeShortcutForConflict("Mod+F", isMac));
  expect(singleTab).toContain(normalizeShortcutForConflict("Esc", isMac));
  expect(singleTab).toContain(
    normalizeShortcutForConflict(DEFAULT_APP_SHORTCUTS.toggleTheme, isMac),
  );
});

test("fixed shortcuts adapt to the current operating system", () => {
  expect(getFixedAppShortcuts("mac").openSettings).toBe("Mod+,");
  expect(getFixedAppShortcuts("windows").openSettings).toBe("Mod+,");
  expect(getFixedAppShortcuts("linux").openSettings).toBe("Mod+,");
  expect(getFixedAppShortcuts("mac").reopenTab).toBe("Mod+Shift+T");
  expect(DEFAULT_APP_SHORTCUTS).not.toHaveProperty("newNote");
  expect(DEFAULT_APP_SHORTCUTS).not.toHaveProperty("saveNote");
  expect(DEFAULT_APP_SHORTCUTS).not.toHaveProperty("reopenTab");
  expect(DEFAULT_APP_SHORTCUTS.openSearch).toBe("Mod+K");
  expect(DEFAULT_APP_SHORTCUTS.splitRight).toBe("Mod+D");
  expect(DEFAULT_APP_SHORTCUTS.splitDown).toBe("Mod+Shift+D");
  expect(DEFAULT_APP_SHORTCUTS.splitFocusLeft).toBe("Mod+Alt+ArrowLeft");
  expect(DEFAULT_APP_SHORTCUTS.splitFocusPrevious).toBe("Mod+Alt+[");
  expect(DEFAULT_APP_SHORTCUTS.splitFocusNext).toBe("Mod+Alt+]");
  expect(DEFAULT_APP_SHORTCUTS.splitZoom).toBe("Mod+Shift+Enter");
  expect(DEFAULT_APP_SHORTCUTS.closeSplitPane).toBe("");
});

test("new users start without a close-tab shortcut", () => {
  expect(DEFAULT_CLOSE_TAB_SHORTCUT).toBe("");
});

test("split shortcut defaults do not collide with close-tab or fixed keys", () => {
  const isMac = true;
  const configured = getAllConfiguredShortcuts(
    DEFAULT_APP_SHORTCUTS,
    DEFAULT_CLOSE_TAB_SHORTCUT,
    "Esc",
    "unused",
    isMac,
    false,
  );
  expect(configured).toContain(normalizeShortcutForConflict("Mod+D", isMac));
  expect(configured).toContain(
    normalizeShortcutForConflict("Mod+Shift+D", isMac),
  );
  expect(configured).toContain(
    normalizeShortcutForConflict("Mod+Alt+ArrowLeft", isMac),
  );
  expect(configured).toContain(
    normalizeShortcutForConflict("Mod+Alt+[", isMac),
  );
  expect(configured).toContain(
    normalizeShortcutForConflict("Mod+Alt+]", isMac),
  );
  expect(configured).toContain(
    normalizeShortcutForConflict("Mod+Shift+Enter", isMac),
  );
  expect(configured).not.toContain(normalizeShortcutForConflict("Mod+W", isMac));
  expect(DEFAULT_APP_SHORTCUTS.closeSplitPane).toBe("");
  expect(DEFAULT_APP_SHORTCUTS.closeSplitPane).not.toBe(
    DEFAULT_CLOSE_TAB_SHORTCUT || "Mod+W",
  );
});

test("desktop global hotkeys join the conflict list and respect excludeId", () => {
  const isMac = true;
  const desktopHotkeys = {
    wakeHotkey: "CmdOrCtrl+Alt+N",
    quicknoteHotkey: "Alt+N",
    searchHotkey: "CmdOrCtrl+Shift+K",
  };
  const configured = getAllConfiguredShortcuts(
    {},
    "",
    "",
    "unused",
    isMac,
    false,
    desktopHotkeys,
  );
  expect(configured).toContain(
    normalizeShortcutForConflict("CmdOrCtrl+Alt+N", isMac),
  );
  expect(configured).toContain(
    normalizeShortcutForConflict("Alt+N", isMac),
  );
  expect(configured).toContain(
    normalizeShortcutForConflict("CmdOrCtrl+Shift+K", isMac),
  );

  const excludingWake = getAllConfiguredShortcuts(
    {},
    "",
    "",
    "wake-hotkey",
    isMac,
    false,
    desktopHotkeys,
  );
  expect(excludingWake).not.toContain(
    normalizeShortcutForConflict("CmdOrCtrl+Alt+N", isMac),
  );
  expect(excludingWake).toContain(
    normalizeShortcutForConflict("Alt+N", isMac),
  );
  expect(excludingWake).toContain(
    normalizeShortcutForConflict("CmdOrCtrl+Shift+K", isMac),
  );
});

test("in-app search and desktop search hotkey conflict on the same chord", () => {
  const isMac = true;
  const desktopHotkeys = {
    wakeHotkey: "CmdOrCtrl+Alt+N",
    quicknoteHotkey: "Alt+N",
    searchHotkey: "CmdOrCtrl+K",
  };
  const editingDesktopSearch = getAllConfiguredShortcuts(
    { openSearch: "Mod+K" },
    "",
    "",
    "search-hotkey",
    isMac,
    false,
    desktopHotkeys,
  );
  expect(editingDesktopSearch).toContain(
    normalizeShortcutForConflict("Mod+K", isMac),
  );

  const editingAppSearch = getAllConfiguredShortcuts(
    { openSearch: "Mod+K" },
    "",
    "",
    "openSearch",
    isMac,
    false,
    desktopHotkeys,
  );
  expect(editingAppSearch).toContain(
    normalizeShortcutForConflict("CmdOrCtrl+K", isMac),
  );
});
