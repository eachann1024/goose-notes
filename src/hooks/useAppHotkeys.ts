import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSettings, EDITOR_FONT_SIZE_DEFAULT } from "@/stores/useSettings";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { useSidebarView } from "@/stores/useSidebarView";
import { closeAllOverlays } from "@/lib/closeAllOverlays";
import { matchShortcut } from "@/lib/shortcut-match";

type HotkeyEntry = {
  id: string;
  match: (event: KeyboardEvent) => boolean;
  when?: (event: KeyboardEvent) => boolean;
  handler: (event: KeyboardEvent) => void;
};

export function useAppHotkeys() {
  // Subscribe to closeTabShortcut so the ref stays in sync, but the keydown
  // listener itself is registered only once (deps=[]).
  const { closeTabShortcut } = useSettings();
  const { openTabs, activeTabId } = useTabs();

  // Dynamic values consumed inside the single keydown listener must be read
  // through refs, otherwise the once-registered listener would capture stale
  // values (breaks tab switching / close after the list changes).
  const closeTabShortcutRef = useRef(closeTabShortcut);
  const openTabsRef = useRef(openTabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    closeTabShortcutRef.current = closeTabShortcut;
  }, [closeTabShortcut]);
  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    const isEditableInput = () => {
      const target = document.activeElement;
      return (
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      );
    };
    const isRichTextEditing = () => {
      const target = document.activeElement;
      return (
        target instanceof HTMLElement &&
        (target.isContentEditable || !!target.closest(".bn-editor"))
      );
    };

    // ----- font zoom: keep event.code fallback (small keypad / non-US layouts) -----
    const isZoomInKey = (event: KeyboardEvent) =>
      event.key === "+" ||
      event.key === "=" ||
      event.code === "Equal" ||
      event.code === "NumpadAdd";
    const isZoomOutKey = (event: KeyboardEvent) =>
      event.key === "-" ||
      event.code === "Minus" ||
      event.code === "NumpadSubtract";
    const isZoomResetKey = (event: KeyboardEvent) =>
      event.key === "0" ||
      event.code === "Digit0" ||
      event.code === "Numpad0";

    // ----- shared modifier gate for meta/ctrl-based shortcuts -----
    const hasPrimaryModifier = (event: KeyboardEvent) =>
      (event.metaKey || event.ctrlKey) && !event.altKey && !event.repeat;

    const entries: HotkeyEntry[] = [
      // F3 → editor find navigation
      {
        id: "find-nav-f3",
        match: (event) => event.key === "F3",
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("goose-note:editor-find-nav", {
              detail: { direction: event.shiftKey ? -1 : 1 },
            }),
          );
        },
      },
      // cmd+, settings — keep custom matcher (Chinese comma '，' + event.code 'Comma')
      {
        id: "open-settings",
        match: (event) =>
          hasPrimaryModifier(event) &&
          (event.key === "," ||
            event.key === "，" ||
            event.code === "Comma") &&
          !event.shiftKey,
        handler: (event) => {
          event.preventDefault();
          closeAllOverlays();
          window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
        },
      },
      // cmd+shift+k search
      {
        id: "open-search",
        match: (event) => matchShortcut(event, "Mod+Shift+K"),
        when: () => !isEditableInput() && !isRichTextEditing(),
        handler: (event) => {
          event.preventDefault();
          closeAllOverlays();
          window.dispatchEvent(new CustomEvent("goose-note:open-search"));
        },
      },
      // Mod+J 开关 AI 面板 —— 对齐 Notion（mac ⌘J / win ctrl J），跨平台用 Mod 自动转
      // 是否真正切换由 WorkspaceLayout 侧监听判断（需 ai.enabled），这里只负责派发
      {
        id: "toggle-ai-panel",
        match: (event) => matchShortcut(event, "Mod+J"),
        handler: (event) => {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("goose-note:toggle-ai-panel"));
        },
      },
      // Alt+B 折叠/展开侧栏 —— 避开编辑器内 Mod+B 加粗，聚焦编辑器时也可触发
      {
        id: "toggle-sidebar",
        match: (event) =>
          event.altKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.repeat &&
          event.code === "KeyB",
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          useSidebarView.getState().toggleSidebarCollapsed();
        },
      },
      // cmd+f editor find open
      {
        id: "editor-find-open",
        match: (event) => matchShortcut(event, "Mod+F"),
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("goose-note:editor-find-open"));
        },
      },
      // cmd+g forward / cmd+shift+g backward — direction driven by shiftKey,
      // so we cannot use matchShortcut('Mod+G') (it would reject cmd+shift+g).
      {
        id: "editor-find-nav-g",
        match: (event) =>
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          event.key.toLowerCase() === "g",
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("goose-note:editor-find-nav", {
              detail: { direction: event.shiftKey ? -1 : 1 },
            }),
          );
        },
      },
      // font zoom in (cmd +/=) — custom matcher keeps event.code fallback
      {
        id: "zoom-in",
        match: (event) => hasPrimaryModifier(event) && isZoomInKey(event),
        handler: (event) => {
          event.preventDefault();
          useSettings.getState().increaseEditorFontSize();
        },
      },
      // font zoom out (cmd -)
      {
        id: "zoom-out",
        match: (event) => hasPrimaryModifier(event) && isZoomOutKey(event),
        handler: (event) => {
          event.preventDefault();
          useSettings.getState().decreaseEditorFontSize();
        },
      },
      // font zoom reset (cmd 0)
      {
        id: "zoom-reset",
        match: (event) => hasPrimaryModifier(event) && isZoomResetKey(event),
        handler: (event) => {
          event.preventDefault();
          useSettings.getState().setEditorFontSize(EDITOR_FONT_SIZE_DEFAULT);
        },
      },
      // cmd+s save (matchShortcut 'Mod+S' == key 's' && !shift && only meta/ctrl)
      {
        id: "save",
        match: (event) => matchShortcut(event, "Mod+S"),
        when: () => !isEditableInput(),
        handler: (event) => {
          event.preventDefault();
          void (async () => {
            window.dispatchEvent(
              new CustomEvent("goose-note:flush-editor", {
                detail: { immediate: true },
              }),
            );
            await usePages.getState().flushPendingLocalSaves();
            toast("内容已保存", { duration: 1500 });
          })();
        },
      },
      // cmd+n new note
      {
        id: "new-note",
        match: (event) => matchShortcut(event, "Mod+N"),
        when: () => !isEditableInput(),
        handler: (event) => {
          event.preventDefault();
          const { createPage } = usePages.getState();
          const { activeNotebookId } = useNotebooks.getState();
          if (activeNotebookId) {
            const newPageId = createPage(undefined, activeNotebookId);
            useTabs.getState().openTab(newPageId);
            toast("已创建新笔记", { duration: 1500 });
          }
        },
      },
      // unified close (user-configurable shortcut, read from ref)
      // Layered: toast → dialog → tab. Fires even inside inputs unless in shortcut recorder.
      {
        id: "unified-close",
        match: (event) =>
          !event.defaultPrevented &&
          matchShortcut(event, closeTabShortcutRef.current),
        when: (event) => {
          const target = event.target as HTMLElement | null;
          // Never intercept when inside the shortcut recorder input itself
          if (target?.closest?.('[data-shortcut-recorder]')) return false;
          // Check if any closeable layer exists — if so, fire even from an input
          const hasToast = !!document.querySelector('[data-sonner-toast]:not([data-removed="true"])');
          const hasDialog = !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
          if (hasToast || hasDialog) return true;
          // Otherwise use original input guard
          const isInInput =
            !!target &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable);
          return !isInInput;
        },
        handler: (event) => {
          event.preventDefault();
          // a. dismiss toasts first
          const toastEl = document.querySelector('[data-sonner-toast]:not([data-removed="true"])');
          if (toastEl) {
            toast.dismiss();
            return;
          }
          // b. close topmost dialog via Escape
          const dialogEl = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
          if (dialogEl) {
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
            );
            return;
          }
          // c. close tab
          const activeId = activeTabIdRef.current;
          if (activeId) {
            useTabs.getState().closeTab(activeId);
            return;
          }
          void usePages.getState().setActivePage(null);
        },
      },
      // Alt+1~9 / Alt+0 switch tab by index — based on event.code (special entry)
      {
        id: "switch-tab-by-number",
        match: (event) => {
          if (event.defaultPrevented) return false;
          if (
            !event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
          ) {
            return false;
          }
          return event.code === "Digit0" || /^Digit[1-9]$/.test(event.code);
        },
        handler: (event) => {
          const code = event.code;
          const targetIndex = code === "Digit0" ? 9 : Number(code.slice(-1)) - 1;
          const targetTab = openTabsRef.current[targetIndex];
          if (!targetTab) return;
          event.preventDefault();
          useTabs.getState().setActiveTab(targetTab.id);
        },
      },
      // Ctrl+Tab / Ctrl+Shift+Tab cycle tabs
      {
        id: "cycle-tab",
        match: (event) =>
          event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          event.key === "Tab",
        handler: (event) => {
          const tabs = openTabsRef.current;
          if (tabs.length < 2) return;
          event.preventDefault();
          const currentIndex = tabs.findIndex(
            (tab) => tab.id === activeTabIdRef.current,
          );
          const direction = event.shiftKey ? -1 : 1;
          const nextIndex =
            (currentIndex + direction + tabs.length) % tabs.length;
          useTabs.getState().setActiveTab(tabs[nextIndex].id);
        },
      },
      // Mod+Shift+T reopen last closed tab
      {
        id: "reopen-tab",
        match: (event) =>
          !event.defaultPrevented && matchShortcut(event, "Mod+Shift+T"),
        handler: (event) => {
          event.preventDefault();
          useTabs.getState().reopenLastClosedTab();
        },
      },
    ];

    const dispatcher = (event: KeyboardEvent) => {
      for (const entry of entries) {
        if (!entry.match(event)) continue;
        if (entry.when && !entry.when(event)) continue;
        entry.handler(event);
        return;
      }
    };

    document.addEventListener("keydown", dispatcher, true);
    return () => {
      document.removeEventListener("keydown", dispatcher, true);
    };
  }, []);

  // Mouse side buttons (back/forward) — non-keyboard, kept as a separate
  // once-registered effect (uses store getState, no dynamic deps).
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
