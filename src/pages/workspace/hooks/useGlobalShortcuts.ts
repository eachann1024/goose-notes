import { useEffect, useCallback } from "react";
import { useTabs } from "@/stores/useTabs";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { matchShortcut } from "@/lib/shortcut-match";

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

  // Cycle tabs: Ctrl+Tab / Ctrl+Shift+Tab
  useEffect(() => {
    const handleCycleTab = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== "Tab") return;
      if (openTabs.length < 2) return;

      event.preventDefault();
      const currentIndex = openTabs.findIndex((tab) => tab.id === activeTabId);
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + openTabs.length) % openTabs.length;
      setActiveTab(openTabs[nextIndex].id);
    };

    document.addEventListener("keydown", handleCycleTab, true);
    return () => {
      document.removeEventListener("keydown", handleCycleTab, true);
    };
  }, [openTabs, activeTabId, setActiveTab]);

  // Reopen last closed tab: Mod+Shift+T
  useEffect(() => {
    const handleReopenTab = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!matchShortcut(event, "Mod+Shift+T")) return;

      event.preventDefault();
      useTabs.getState().reopenLastClosedTab();
    };

    document.addEventListener("keydown", handleReopenTab);
    return () => {
      document.removeEventListener("keydown", handleReopenTab);
    };
  }, []);

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
