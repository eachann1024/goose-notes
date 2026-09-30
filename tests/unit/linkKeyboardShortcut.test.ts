import { expect, test } from "playwright/test";
import {
  isLinkShortcutClaimedByApp,
  isPrimaryLinkShortcutEvent,
  shouldArmLinkOpenHint,
} from "../../src/components/editor/extensions/linkKeyboardExtension";

function shortcutEvent(overrides: Partial<KeyboardEvent> = {}) {
  return {
    key: "k",
    code: "KeyK",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    ...overrides,
  } as KeyboardEvent;
}

test("link shortcut explicitly accepts Windows Ctrl+K", () => {
  expect(
    isPrimaryLinkShortcutEvent(shortcutEvent({ ctrlKey: true }), "windows"),
  ).toBe(true);
  expect(
    isPrimaryLinkShortcutEvent(shortcutEvent({ metaKey: true }), "windows"),
  ).toBe(false);
});

test("link shortcut keeps macOS Meta+K and rejects modified variants", () => {
  expect(
    isPrimaryLinkShortcutEvent(shortcutEvent({ metaKey: true }), "mac"),
  ).toBe(true);
  expect(
    isPrimaryLinkShortcutEvent(shortcutEvent({ ctrlKey: true }), "mac"),
  ).toBe(false);
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ ctrlKey: true, shiftKey: true }),
      "windows",
    ),
  ).toBe(false);
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ ctrlKey: true, defaultPrevented: true }),
      "windows",
    ),
  ).toBe(false);
});

test("link shortcut on Linux uses Ctrl+K and leaves Super+K free", () => {
  expect(
    isPrimaryLinkShortcutEvent(shortcutEvent({ ctrlKey: true }), "linux"),
  ).toBe(true);
  expect(
    isPrimaryLinkShortcutEvent(shortcutEvent({ metaKey: true }), "linux"),
  ).toBe(false);
});

test("link shortcut uses KeyK when an old WebView reports a localized key", () => {
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ key: "л", code: "KeyK", ctrlKey: true }),
      "windows",
    ),
  ).toBe(true);
});

test("link shortcut yields when an app action already uses Mod+K", () => {
  expect(isLinkShortcutClaimedByApp(["Mod+K"], "mac")).toBe(true);
  expect(isLinkShortcutClaimedByApp(["Meta+K"], "mac")).toBe(true);
  expect(isLinkShortcutClaimedByApp(["Ctrl+K"], "linux")).toBe(true);
  expect(isLinkShortcutClaimedByApp(["Super+K"], "linux")).toBe(false);
  expect(isLinkShortcutClaimedByApp(["Mod+Shift+K"], "mac")).toBe(false);
});

test("link shortcut ignores modern and legacy IME keyboard events", () => {
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ ctrlKey: true, isComposing: true }),
      "windows",
    ),
  ).toBe(false);
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ ctrlKey: true, keyCode: 229 }),
      "windows",
    ),
  ).toBe(false);
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ ctrlKey: true, which: 229 }),
      "windows",
    ),
  ).toBe(false);
  expect(
    isPrimaryLinkShortcutEvent(
      {
        ...shortcutEvent({ ctrlKey: true }),
        nativeEvent: { isComposing: true, keyCode: 0, which: 0 },
      },
      "windows",
    ),
  ).toBe(false);
});

test("link open hint arms on Cmd or Ctrl, matching click-to-open", () => {
  expect(shouldArmLinkOpenHint({ metaKey: true, ctrlKey: false })).toBe(true);
  expect(shouldArmLinkOpenHint({ metaKey: false, ctrlKey: true })).toBe(true);
  expect(shouldArmLinkOpenHint({ metaKey: false, ctrlKey: false })).toBe(false);
});
