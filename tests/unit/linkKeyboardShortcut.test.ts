import { expect, test } from "playwright/test";
import { isPrimaryLinkShortcutEvent } from "../../src/components/editor/extensions/linkKeyboardExtension";

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
  expect(isPrimaryLinkShortcutEvent(shortcutEvent({ ctrlKey: true }))).toBe(
    true,
  );
});

test("link shortcut keeps macOS Meta+K and rejects modified variants", () => {
  expect(isPrimaryLinkShortcutEvent(shortcutEvent({ metaKey: true }))).toBe(
    true,
  );
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ ctrlKey: true, shiftKey: true }),
    ),
  ).toBe(false);
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ ctrlKey: true, defaultPrevented: true }),
    ),
  ).toBe(false);
});

test("link shortcut uses KeyK when an old WebView reports a localized key", () => {
  expect(
    isPrimaryLinkShortcutEvent(
      shortcutEvent({ key: "л", code: "KeyK", ctrlKey: true }),
    ),
  ).toBe(true);
});
