import { expect, test } from "playwright/test";
import {
  getModifierOnlyShortcut,
  getShortcutFromMouseEvent,
  matchMouseShortcut,
  matchModifierOnlyShortcutKey,
  matchModifierOnlyShortcutKeyDown,
  matchShortcut,
  shortcutHasModifier,
} from "../../src/lib/shortcut-match";

function keyboardEvent(init: {
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
  } as KeyboardEvent;
}

test("close-tab shortcut matching covers mac option-composed keys and win/linux alt keys", () => {
  expect(
    matchShortcut(
      keyboardEvent({ key: "∑", code: "KeyW", altKey: true }),
      "Alt+W",
    ),
  ).toBe(true);

  expect(
    matchShortcut(
      keyboardEvent({ key: "w", code: "KeyW", altKey: true }),
      "Alt+W",
    ),
  ).toBe(true);
});

test("configured ctrl close-tab shortcut matches Chromium keyboard events", () => {
  expect(
    matchShortcut(
      keyboardEvent({ key: "w", code: "KeyW", ctrlKey: true }),
      "Ctrl+W",
    ),
  ).toBe(true);
});

test("shortcutHasModifier distinguishes modified shortcuts from text keys", () => {
  expect(shortcutHasModifier("Ctrl+W")).toBe(true);
  expect(shortcutHasModifier("Alt+W")).toBe(true);
  expect(shortcutHasModifier("W")).toBe(false);
});

test("modifier-only shortcuts wait for the dedicated keyup dispatcher", () => {
  expect(
    matchShortcut(
      keyboardEvent({ key: "Meta", code: "MetaLeft", metaKey: true }),
      "Meta",
    ),
  ).toBe(false);
  expect(
    matchShortcut(
      keyboardEvent({ key: "Control", code: "ControlLeft", ctrlKey: true }),
      "Ctrl",
    ),
  ).toBe(false);
});

test("modifier-only shortcuts match an exact modifier press and release", () => {
  const ctrlDown = keyboardEvent({
    key: "Control",
    code: "ControlLeft",
    ctrlKey: true,
  });
  const ctrlWithShift = keyboardEvent({
    key: "Control",
    code: "ControlLeft",
    ctrlKey: true,
    shiftKey: true,
  });

  expect(getModifierOnlyShortcut("Control")).toBe("ctrl");
  expect(getModifierOnlyShortcut("Ctrl+W")).toBe("");
  expect(matchModifierOnlyShortcutKeyDown(ctrlDown, "Ctrl")).toBe(true);
  expect(matchModifierOnlyShortcutKeyDown(ctrlWithShift, "Ctrl")).toBe(false);
  expect(matchModifierOnlyShortcutKey({ key: "Control" }, "Ctrl")).toBe(true);
  expect(matchModifierOnlyShortcutKey({ key: "Shift" }, "Ctrl")).toBe(false);
});

test("recorded plus shortcuts can be matched", () => {
  expect(
    matchShortcut(
      keyboardEvent({ key: "+", code: "Equal", shiftKey: true }),
      "Shift+Plus",
    ),
  ).toBe(true);
});

test("navigation bracket shortcuts use physical codes on localized layouts", () => {
  // 该用例验证 Win/Linux 物理键位（Mod=Ctrl）。共享 worker 里其他测试文件
  // 可能泄漏 linkedom window，让 getPlatformKind 读到 Node 的 MacIntel
  // 平台而误判成 mac（Mod=Meta）。此处临时固定为 Linux 再断言。
  const realPlatform = navigator.platform;
  Object.defineProperty(navigator, "platform", {
    configurable: true,
    value: "Linux x86_64",
  });
  try {
    expect(
      matchShortcut(
        keyboardEvent({ key: "å", code: "BracketLeft", ctrlKey: true }),
        "Mod+[",
      ),
    ).toBe(true);
    expect(
      matchShortcut(
        keyboardEvent({ key: "¨", code: "BracketRight", ctrlKey: true }),
        "Mod+]",
      ),
    ).toBe(true);
  } finally {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: realPlatform,
    });
  }
});

test("Mod+, 打开设置：mac meta 通过，中文逗号/Comma 归一后也通过", () => {
  const g = globalThis as typeof globalThis & { window?: unknown };
  const hadWindow = typeof g.window !== "undefined";
  if (!hadWindow) {
    Object.defineProperty(g, "window", {
      configurable: true,
      value: globalThis,
    });
  }
  const realPlatform = navigator.platform;
  Object.defineProperty(navigator, "platform", {
    configurable: true,
    value: "MacIntel",
  });
  const normalizeOpenSettingsKey = (event: {
    key: string;
    code?: string;
  }) => (event.key === "，" || event.code === "Comma" ? "," : event.key);
  try {
    expect(
      matchShortcut(
        keyboardEvent({ key: ",", code: "Comma", metaKey: true }),
        "Mod+,",
      ),
    ).toBe(true);

    const chineseComma = keyboardEvent({
      key: "，",
      code: "Comma",
      metaKey: true,
    });
    expect(
      matchShortcut(
        {
          ...chineseComma,
          key: normalizeOpenSettingsKey(chineseComma),
        },
        "Mod+,",
      ),
    ).toBe(true);

    const codeOnly = keyboardEvent({
      key: "Unidentified",
      code: "Comma",
      metaKey: true,
    });
    expect(
      matchShortcut(
        {
          ...codeOnly,
          key: normalizeOpenSettingsKey(codeOnly),
        },
        "Mod+,",
      ),
    ).toBe(true);

    expect(
      matchShortcut(keyboardEvent({ key: ",", code: "Comma" }), "Mod+,"),
    ).toBe(false);
  } finally {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: realPlatform,
    });
    if (!hadWindow) {
      delete g.window;
    }
  }
});

test("mouse side buttons use stable shortcut names", () => {
  expect(getShortcutFromMouseEvent({ button: 3 })).toBe("MouseBack");
  expect(getShortcutFromMouseEvent({ button: 4 })).toBe("MouseForward");
  expect(getShortcutFromMouseEvent({ button: 1 })).toBe("");
  expect(matchMouseShortcut({ button: 3 }, "mouseback")).toBe(true);
  expect(matchMouseShortcut({ button: 4 }, "MouseForward")).toBe(true);
});
