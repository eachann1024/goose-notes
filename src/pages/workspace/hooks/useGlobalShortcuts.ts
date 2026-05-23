import { useEffect, useCallback } from "react";
import { useTabs } from "@/stores/useTabs";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { isMacPlatform } from "@/lib/utils";

// ── shortcut helpers ──────────────────────────────────────────────────────────

function normalizeShortcutToken(raw: string) {
  const token = raw.trim().toLowerCase();
  if (!token) return "";
  if (
    token === "mod" ||
    token === "cmdorctrl" ||
    token === "cmdorcontrol" ||
    token === "commandorcontrol"
  ) {
    return isMacPlatform() ? "meta" : "ctrl";
  }
  if (token === "control" || token === "ctrl") return "ctrl";
  if (token === "meta" || token === "command" || token === "cmd") return "meta";
  if (token === "alt" || token === "option") return "alt";
  if (token === "shift") return "shift";
  if (token === "escape" || token === "esc") return "escape";
  if (token.length === 1) return token;
  return token;
}

function isModifierToken(token: string) {
  return token === "ctrl" || token === "meta" || token === "alt" || token === "shift";
}

function matchShortcut(event: KeyboardEvent, shortcut: string) {
  const trimmed = shortcut.trim();
  if (!trimmed) return false;

  const parts = trimmed
    .split("+")
    .map(normalizeShortcutToken)
    .filter(Boolean);
  if (parts.length === 0) return false;

  const expectedModifiers = {
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("meta"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  };

  if (
    event.ctrlKey !== expectedModifiers.ctrl ||
    event.metaKey !== expectedModifiers.meta ||
    event.altKey !== expectedModifiers.alt ||
    event.shiftKey !== expectedModifiers.shift
  ) {
    return false;
  }

  const keyToken = parts.find((part) => !isModifierToken(part));
  const eventKey = normalizeShortcutToken(event.key);

  if (!keyToken) {
    return isModifierToken(eventKey) && expectedModifiers[eventKey as keyof typeof expectedModifiers];
  }

  return !isModifierToken(eventKey) && eventKey === keyToken;
}

// ── hook ─────────────────────────────────────────────────────────────────────

export function useGlobalShortcuts() {
  const { openTabs, activeTabId, closeTab, setActiveTab } = useTabs();
  const { setActivePage } = usePages();
  const { closeTabShortcut } = useSettings();

  const closeCurrentTab = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId);
      return;
    }
    setActivePage(null);
  }, [activeTabId, closeTab, setActivePage]);

  // Close tab shortcut
  useEffect(() => {
    const handleCloseTabShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!matchShortcut(event, closeTabShortcut)) return;

      const target = event.target as HTMLElement | null;
      const isInInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isInInput) return;

      event.preventDefault();
      closeCurrentTab();
    };

    document.addEventListener("keydown", handleCloseTabShortcut);
    return () => {
      document.removeEventListener("keydown", handleCloseTabShortcut);
    };
  }, [closeCurrentTab, closeTabShortcut]);

  // Switch tab by number (Alt+1~9, Alt+0)
  useEffect(() => {
    const handleSwitchTabByNumber = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const code = event.code;
      let targetIndex = -1;
      if (code === "Digit0") {
        targetIndex = 9;
      } else if (/^Digit[1-9]$/.test(code)) {
        targetIndex = Number(code.slice(-1)) - 1;
      } else {
        return;
      }

      const targetTab = openTabs[targetIndex];
      if (!targetTab) return;

      event.preventDefault();
      setActiveTab(targetTab.id);
    };

    document.addEventListener("keydown", handleSwitchTabByNumber);
    return () => {
      document.removeEventListener("keydown", handleSwitchTabByNumber);
    };
  }, [openTabs, setActiveTab]);

  // Mouse side buttons (back/forward)
  useEffect(() => {
    let lastHandledButton = -1;
    let lastHandledAt = 0;

    const handleMouseSideButton = (event: MouseEvent) => {
      const isBack = event.button === 3;
      const isForward = event.button === 4;
      if (!isBack && !isForward) return;

      const now = Date.now();
      if (event.button === lastHandledButton && now - lastHandledAt < 120) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      lastHandledButton = event.button;
      lastHandledAt = now;
      event.preventDefault();
      event.stopPropagation();

      if (isBack) {
        useTabs.getState().goBackTabHistory();
        return;
      }

      useTabs.getState().goForwardTabHistory();
    };

    window.addEventListener("mousedown", handleMouseSideButton, true);
    window.addEventListener("mouseup", handleMouseSideButton, true);
    window.addEventListener("auxclick", handleMouseSideButton, true);
    return () => {
      window.removeEventListener("mousedown", handleMouseSideButton, true);
      window.removeEventListener("mouseup", handleMouseSideButton, true);
      window.removeEventListener("auxclick", handleMouseSideButton, true);
    };
  }, []);
}
