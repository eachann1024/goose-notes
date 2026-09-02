import { expect, test } from "playwright/test";
import {
  formatDualShortcut,
  formatDualShortcutGroup,
  onboardingPageContent,
  onboardingChildPageContent,
  onboardingSecondChildContent,
  onboardingThirdChildContent,
} from "../../src/lib/onboardingContent";

test("formatDualShortcut outputs Win default + Mac in parentheses", () => {
  expect(formatDualShortcut("Mod+N")).toBe("Ctrl+N（⌘N）");
  expect(formatDualShortcut("Mod+K")).toBe("Ctrl+K（⌘K）");
  expect(formatDualShortcut("Mod+F")).toBe("Ctrl+F（⌘F）");
  expect(formatDualShortcut("Mod+Z")).toBe("Ctrl+Z（⌘Z）");
  expect(formatDualShortcut("Mod+S")).toBe("Ctrl+S（⌘S）");
  expect(formatDualShortcut("Esc")).toBe("Esc（⎋）");
});

test("formatDualShortcutGroup formats shortcut sequences cleanly", () => {
  expect(formatDualShortcutGroup("Mod+Plus", "Mod+-", "Mod+0")).toBe(
    "Ctrl++ / Ctrl+- / Ctrl+0（⌘+ / ⌘- / ⌘0）",
  );
  expect(formatDualShortcutGroup("Mod+G", "Mod+Shift+G")).toBe(
    "Ctrl+G / Ctrl+Shift+G（⌘G / ⌘⇧G）",
  );
  expect(formatDualShortcutGroup("Enter", "Shift+Enter")).toBe(
    "Enter / Shift+Enter（↵ / ⇧↵）",
  );
});

test("onboarding built-in pages structure includes html and image guide", () => {
  expect(onboardingPageContent.length).toBeGreaterThan(5);
  expect(onboardingChildPageContent.length).toBeGreaterThan(3);
  expect(onboardingSecondChildContent.length).toBeGreaterThan(3);
  expect(onboardingThirdChildContent.length).toBeGreaterThan(5);

  const mainPageText = JSON.stringify(onboardingPageContent);
  expect(mainPageText).toContain("Ctrl+N（⌘N）");
  expect(mainPageText).toContain("Ctrl+K（⌘K）");
  expect(mainPageText).toContain("生产 HTML 与图片指南");

  const thirdPageText = JSON.stringify(onboardingThirdChildContent);
  expect(thirdPageText).toContain("生产 HTML 与图片指南");
  expect(thirdPageText).toContain("生成精美图片卡片");
  expect(thirdPageText).toContain("生产与导出独立 HTML 网页");
  expect(thirdPageText).toContain("AI 生产交互式 HTML 小组件");
});
