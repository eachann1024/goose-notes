import { useEffect, useRef } from "react";
import { isSetupGuideVisible } from "@/lib/setupGuide";
import { toast } from "@/components/ui/sonner";
import { useSettings, EDITOR_FONT_SIZE_DEFAULT } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { createDesktopWindow } from "@/lib/electron/windowContext";
import { getGooseDesktop, isElectronRuntime } from "@/lib/electron/runtime";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { useSidebarView } from "@/stores/useSidebarView";
import { closeAllOverlays } from "@/lib/closeAllOverlays";
import {
  getModifierOnlyShortcut,
  matchMouseShortcut,
  matchModifierOnlyShortcutKey,
  matchModifierOnlyShortcutKeyDown,
  matchShortcut,
  shortcutHasModifier,
} from "@/lib/shortcut-match";
import { FIXED_SPLIT_SHORTCUTS, getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import { registerEscapeClose, OPEN_ESCAPE_LAYER_SELECTOR, OPEN_TOAST_SELECTOR } from "@/lib/escape-close";
import { normalizeAppShortcuts } from "@/stores/settings/slices/shortcutsSlice";
import { isPlatformPrimaryModifierEvent } from "@/lib/shortcut-platform";
import {
  closeNotebookAiIfFullscreen,
  closeNotebookAiPanel,
} from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { useLocalFolderTargetPicker } from "@/stores/useLocalFolderTargetPicker";
import {
  LOCAL_FOLDER_FILE_SHORTCUTS,
  copyLocalFolderPagePath,
  hasCurrentLocalFolderPage,
  openLocalFolderPageInExternalApp,
  openLocalFolderPageInTerminal,
  resolveCurrentLocalFolderPage,
  revealLocalFolderPageInFileManager,
} from "@/lib/local-folder-file-actions";
import {
  isImeKeyboardEvent,
  shouldSkipAppHotkeyEvent,
} from "@/hooks/useImeInput";
import {
  closePaneOrTab,
  focusNeighbor,
  focusNextSplitPane,
  focusPreviousSplitPane,
  splitDown,
  splitRight,
  toggleZoom,
} from "@/lib/editor-split/commands";
import { activateWorkspace, isHotkeyAllowedInSettings, isWorkspaceNavigationHotkey, isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import { findLoneVisibleWorkspaceTab } from "@/pages/workspace/components/page/visibleTabs";

type HotkeyEntry = {
  id: string;
  shortcutId?: string;
  match: (event: KeyboardEvent) => boolean;
  when?: (event: KeyboardEvent) => boolean;
  handler: (event: KeyboardEvent) => void;
  allowRepeat?: boolean;
};

export function useAppHotkeys() {
  const { appShortcuts } = useSettings();
  const { openTabs, activeTabId } = useTabs();

  // Dynamic values consumed inside the single keydown listener must be read
  // through refs, otherwise the once-registered listener would capture stale
  // values (breaks tab switching / close after the list changes).
  const appShortcutsRef = useRef(normalizeAppShortcuts(appShortcuts));
  const openTabsRef = useRef(openTabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    appShortcutsRef.current = normalizeAppShortcuts(appShortcuts);
  }, [appShortcuts]);
  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    const fixedShortcuts = getFixedAppShortcuts();
    const isEditableEventTarget = (event: KeyboardEvent) => {
      const target =
        event.target instanceof HTMLElement
          ? event.target
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      return (
        !!target &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable ||
          !!target.closest(".bn-editor"))
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
      event.key === "0" || event.code === "Digit0" || event.code === "Numpad0";

    // ----- shared modifier gate for meta/ctrl-based shortcuts -----
    const hasPrimaryModifier = (event: KeyboardEvent) =>
      isPlatformPrimaryModifierEvent(event) &&
      !event.altKey &&
      !event.repeat;

    const matchesConfiguredShortcut = (
      event: KeyboardEvent,
      shortcut: string,
    ) =>
      matchShortcut(
        event.key === " "
          ? ({
              key: "Space",
              code: event.code,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              altKey: event.altKey,
              shiftKey: event.shiftKey,
            } as KeyboardEvent)
          : event,
        shortcut,
      ) &&
      (!isEditableEventTarget(event) || shortcutHasModifier(shortcut));

    const runUnifiedClose = (fromEscape = false) => {
      if (document.activeElement?.closest("[data-shortcut-recorder]")) return;
      if (isSetupGuideVisible(useSettings.getState())) {
        void getGooseDesktop()?.closeWindow?.();
        return;
      }
      const toastEl = document.querySelector(OPEN_TOAST_SELECTOR);
      if (toastEl) {
        toast.dismiss();
        return;
      }
      const dialogEl = Array.from(document.querySelectorAll(OPEN_ESCAPE_LAYER_SELECTOR)).at(-1);
      if (dialogEl) {
        if (fromEscape) return;
        // HeroUI listens on the dialog subtree, not document.
        const target = dialogEl.contains(document.activeElement) ? document.activeElement! : dialogEl;
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
        return;
      }
      if (isWorkspaceSettingsOpen()) {
        window.dispatchEvent(new CustomEvent("goose-note:close-settings"));
        return;
      }
      // AI 侧栏或独立全屏面板已打开：Cmd+W 只收起面板，不关 Tab / 分屏格 / 窗口，也不 stop 会话。
      if (closeNotebookAiPanel()) return;
      // 已分屏时先关当前格；最后一格才走原来的关 Tab。
      if (closePaneOrTab() === "closed-pane") return;
      if (!isElectronRuntime() && effectiveSingleTabMode()) return;
      const activeId = activeTabIdRef.current;
      const loneVisibleTab = findLoneVisibleWorkspaceTab(
        openTabsRef.current,
        (pageId) => usePages.getState().getPage(pageId),
        useNotebooks.getState().activeNotebookId,
      );
      if (isElectronRuntime() && loneVisibleTab?.id === activeId) {
        void getGooseDesktop()?.closeWindow?.();
        return;
      }
      if (activeId) {
        useTabs.getState().closeTab(activeId);
        return;
      }
      void usePages.getState().setActivePage(null);
    };

    const createNewNoteFromHotkey = () => {
      if (isSetupGuideVisible(useSettings.getState())) return;
      activateWorkspace();
      closeNotebookAiIfFullscreen();
      void (async () => {
        const pagesStore = usePages.getState();
        const notebooksStore = useNotebooks.getState();
        const { activeNotebookId, notebooks } = notebooksStore;
        if (!activeNotebookId) return;

        const notebook = notebooks[activeNotebookId];
        const newPageId =
          notebook?.source === "local-folder"
            ? await pagesStore.createLocalPage(undefined, activeNotebookId)
            : pagesStore.createPage(undefined, activeNotebookId);
        if (!newPageId) return;
        useTabs.getState().openTab(newPageId);
        toast.success(
          notebook?.source === "local-folder"
            ? "已创建新文件"
            : "已创建新笔记",
          { duration: 1500 },
        );
      })();
    };

    const entries: HotkeyEntry[] = [
      // F3 → editor find navigation
      {
        id: "find-nav-f3",
        allowRepeat: true,
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
      // 设置快捷键固定：全平台 Mod+,（mac ⌘, / win·linux Ctrl+,）。中文逗号与 Comma 归一后再匹配。
      {
        id: "open-settings",
        match: (event) => {
          if (event.repeat) return false;
          const key =
            event.key === "，" || event.code === "Comma" ? "," : event.key;
          return matchShortcut(
            {
              key,
              code: event.code,
              ctrlKey: event.ctrlKey,
              metaKey: event.metaKey,
              altKey: event.altKey,
              shiftKey: event.shiftKey,
            } as KeyboardEvent,
            fixedShortcuts.openSettings,
          );
        },
        handler: (event) => {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
        },
      },
      // Mod+K search
      {
        id: "open-search",
        shortcutId: "openSearch",
        match: (event) => {
          const s = appShortcutsRef.current.openSearch;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          closeAllOverlays();
          if (useSidebarView.getState().sidebarCollapsed) {
            useSidebarView.getState().setSidebarCollapsed(false);
          }
          window.dispatchEvent(new CustomEvent("goose-note:open-search"));
        },
      },
      // Mod+J 开关 AI 面板 —— 对齐 Notion（mac ⌘J / win ctrl J），跨平台用 Mod 自动转
      // 是否真正切换由 WorkspaceLayout 侧监听判断（需 ai.enabled），这里只负责派发
      {
        id: "toggle-ai-panel",
        shortcutId: "toggleAIPanel",
        match: (event) => {
          const s = appShortcutsRef.current.toggleAIPanel;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("goose-note:toggle-ai-panel"));
        },
      },
      // toggle sidebar — configurable, default Alt+B; allow triggering even from editor
      {
        id: "toggle-sidebar",
        shortcutId: "toggleSidebar",
        match: (event) => {
          const s = appShortcutsRef.current.toggleSidebar;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isWorkspaceSettingsOpen()) window.dispatchEvent(new CustomEvent("goose-note:toggle-settings-sidebar"));
          else useSidebarView.getState().toggleSidebarCollapsed();
        },
      },
      // 页内查找固定为 Chrome/系统通用的 Mod+F。
      {
        id: "editor-find-open",
        match: (event) =>
          matchesConfiguredShortcut(event, fixedShortcuts.editorFindOpen),
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent("goose-note:editor-find-open"));
        },
      },
      // 页内替换：macOS 不用 Mod+H（会隐藏应用），与 VS Code 一样走 Mod+Alt+F。
      {
        id: "editor-find-replace-open",
        match: (event) => matchShortcut(event, "Mod+Alt+F"),
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.dispatchEvent(
            new CustomEvent("goose-note:editor-find-open", {
              detail: { replace: true },
            }),
          );
        },
      },
      // cmd+g forward / cmd+shift+g backward — direction driven by shiftKey,
      // so we cannot use matchShortcut('Mod+G') (it would reject cmd+shift+g).
      {
        id: "editor-find-nav-g",
        allowRepeat: true,
        match: (event) =>
          isPlatformPrimaryModifierEvent(event) &&
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
      // 新建笔记固定为 Mod+N，不跟随同步配置变化。
      {
        id: "new-note",
        match: (event) =>
          matchesConfiguredShortcut(event, fixedShortcuts.newNote),
        handler: (event) => {
          event.preventDefault();
          createNewNoteFromHotkey();
        },
      },
      {
        id: "move-local-folder-item",
        match: (event) =>
          matchShortcut(event, LOCAL_FOLDER_FILE_SHORTCUTS.moveItem),
        when: hasCurrentLocalFolderPage,
        handler: (event) => {
          event.preventDefault();
          const page = resolveCurrentLocalFolderPage();
          if (!page) return;
          useLocalFolderTargetPicker
            .getState()
            .openMovePicker(page.workspaceId, page.id);
        },
      },
      {
        id: "open-local-file-external-app",
        match: (event) =>
          matchShortcut(event, LOCAL_FOLDER_FILE_SHORTCUTS.openInExternalApp),
        when: hasCurrentLocalFolderPage,
        handler: (event) => {
          event.preventDefault();
          const page = resolveCurrentLocalFolderPage();
          if (page) void openLocalFolderPageInExternalApp(page);
        },
      },
      {
        id: "reveal-local-file-in-file-manager",
        match: (event) =>
          matchShortcut(event, LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager),
        when: hasCurrentLocalFolderPage,
        handler: (event) => {
          event.preventDefault();
          const page = resolveCurrentLocalFolderPage();
          if (page) void revealLocalFolderPageInFileManager(page);
        },
      },
      {
        id: "open-local-file-in-terminal",
        match: (event) =>
          matchShortcut(event, LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal),
        when: hasCurrentLocalFolderPage,
        handler: (event) => {
          event.preventDefault();
          const page = resolveCurrentLocalFolderPage();
          if (page) void openLocalFolderPageInTerminal(page);
        },
      },
      {
        id: "copy-local-file-path",
        match: (event) =>
          matchShortcut(event, LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath),
        when: hasCurrentLocalFolderPage,
        handler: (event) => {
          event.preventDefault();
          const page = resolveCurrentLocalFolderPage();
          if (page) void copyLocalFolderPagePath(page);
        },
      },
      // toggle theme (Mod+Shift+L)
      {
        id: "toggle-theme",
        shortcutId: "toggleTheme",
        match: (event) => {
          const s = appShortcutsRef.current.toggleTheme;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          useSettings.getState().toggleDarkMode();
        },
      },
      // nav-back / nav-forward (Mod+[ / Mod+])
      {
        id: "nav-back",
        shortcutId: "navBack",
        match: (event) => {
          const s = appShortcutsRef.current.navBack;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        when: () => {
          const hasOpenModal = () =>
            !!document.querySelector(
              '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
            );
          return !hasOpenModal();
        },
        handler: (event) => {
          event.preventDefault();
          useTabs.getState().goBackTabHistory();
        },
      },
      {
        id: "nav-forward",
        shortcutId: "navForward",
        match: (event) => {
          const s = appShortcutsRef.current.navForward;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        when: () => {
          const hasOpenModal = () =>
            !!document.querySelector(
              '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
            );
          return !hasOpenModal();
        },
        handler: (event) => {
          event.preventDefault();
          useTabs.getState().goForwardTabHistory();
        },
      },
      // 分屏：capture 阶段拦截，编辑器内 Mod+D 仍分屏而不是浏览器收藏。
      {
        id: "split-right",
        shortcutId: "splitRight",
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitRight;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          void splitRight();
        },
      },
      {
        id: "split-down",
        shortcutId: "splitDown",
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitDown;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          void splitDown();
        },
      },
      {
        id: "split-focus-left",
        shortcutId: "splitFocusLeft",
        allowRepeat: true,
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitFocusLeft;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          focusNeighbor("left");
        },
      },
      {
        id: "split-focus-right",
        shortcutId: "splitFocusRight",
        allowRepeat: true,
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitFocusRight;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          focusNeighbor("right");
        },
      },
      {
        id: "split-focus-up",
        shortcutId: "splitFocusUp",
        allowRepeat: true,
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitFocusUp;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          focusNeighbor("up");
        },
      },
      {
        id: "split-focus-down",
        shortcutId: "splitFocusDown",
        allowRepeat: true,
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitFocusDown;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          focusNeighbor("down");
        },
      },
      {
        id: "split-focus-previous",
        shortcutId: "splitFocusPrevious",
        allowRepeat: true,
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitFocusPrevious;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          focusPreviousSplitPane();
        },
      },
      {
        id: "split-focus-next",
        shortcutId: "splitFocusNext",
        allowRepeat: true,
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitFocusNext;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          focusNextSplitPane();
        },
      },
      {
        id: "split-zoom",
        shortcutId: "splitZoom",
        match: (event) => {
          const s = FIXED_SPLIT_SHORTCUTS.splitZoom;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleZoom();
        },
      },
      // new-tab (Mod+T)
      {
        id: "new-tab",
        shortcutId: "newTab",
        match: (event) => {
          const s = appShortcutsRef.current.newTab;
          return !!s && matchesConfiguredShortcut(event, s);
        },
        when: () => {
          if (effectiveSingleTabMode()) return false;
          const hasOpenModal = () =>
            !!document.querySelector(
              '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
            );
          return !hasOpenModal();
        },
        handler: (event) => {
          event.preventDefault();
          useTabs.getState().openNewTab();
        },
      },
      // Cmd+Shift+N：新桌面窗口（主进程 API 用可选链兜底）
      {
        id: "new-window",
        match: (event) =>
          !event.defaultPrevented &&
          matchesConfiguredShortcut(event, "Mod+Shift+N"),
        when: (event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.("[data-shortcut-recorder]")) return false;
          return true;
        },
        handler: (event) => {
          event.preventDefault();
          void createDesktopWindow({ mode: "blank" });
        },
      },
      // Escape is routed after local handlers; desktop Mod+W retains ordered close.
      {
        id: "unified-close",
        match: (event) => !event.defaultPrevented && isElectronRuntime() && matchShortcut(event, "Mod+W"),
        handler: (event) => {
          event.preventDefault();
          event.stopPropagation();
          runUnifiedClose();
        },
      },
      // Cmd/Ctrl+1~3 切左上角侧栏视图：本地、大纲、搜索。不绑定 Cmd+0（字体缩放重置）。
      {
        id: "switch-sidebar-view-by-number",
        match: (event) => {
          if (event.defaultPrevented) return false;
          if (
            !isPlatformPrimaryModifierEvent(event) ||
            event.altKey ||
            event.shiftKey
          ) {
            return false;
          }
          return /^Digit[1-3]$/.test(event.code);
        },
        handler: (event) => {
          event.preventDefault();
          if (useSidebarView.getState().sidebarCollapsed) {
            useSidebarView.getState().setSidebarCollapsed(false);
          }
          const digit = Number(event.code.slice(-1));
          window.dispatchEvent(
            new CustomEvent("goose-note:switch-sidebar-view", {
              detail: { view: digit === 1 ? "pages" : digit === 2 ? "outline" : "search" },
            }),
          );
        },
      },
      // Cmd/Ctrl+4~8 跳到对应序号标签，Cmd/Ctrl+9 跳到最后一个。1~3 已用于侧栏视图。
      {
        id: "switch-tab-by-number",
        match: (event) => {
          if (effectiveSingleTabMode()) return false;
          if (event.defaultPrevented) return false;
          if (
            !isPlatformPrimaryModifierEvent(event) ||
            event.altKey ||
            event.shiftKey
          ) {
            return false;
          }
          return /^Digit[4-9]$/.test(event.code);
        },
        handler: (event) => {
          const digit = Number(event.code.slice(-1));
          const tabs = openTabsRef.current;
          const targetTab =
            digit === 9 ? tabs[tabs.length - 1] : tabs[digit - 4];
          if (!targetTab) return;
          event.preventDefault();
          useTabs.getState().setActiveTab(targetTab.id);
        },
      },
      // Ctrl+Tab / Ctrl+Shift+Tab cycle tabs
      {
        id: "cycle-tab",
        match: (event) =>
          !effectiveSingleTabMode() &&
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
      // 与 Chrome 一致，固定使用 Mod+Shift+T，并按关闭顺序逐个恢复。
      {
        id: "reopen-tab",
        match: (event) =>
          !effectiveSingleTabMode() &&
          !event.defaultPrevented &&
          matchesConfiguredShortcut(event, fixedShortcuts.reopenTab),
        handler: (event) => {
          event.preventDefault();
          useTabs.getState().reopenLastClosedTab();
        },
      },
    ];

    let pendingModifierOnlyEntry: HotkeyEntry | null = null;

    const getShortcutForEntry = (entry: HotkeyEntry) => {
      return entry.shortcutId
        ? (appShortcutsRef.current[entry.shortcutId] ?? "")
        : "";
    };

    const runEntry = (entry: HotkeyEntry, event: KeyboardEvent) => {
      if (isWorkspaceSettingsOpen() && !isHotkeyAllowedInSettings(entry.id)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (isWorkspaceNavigationHotkey(entry.id)) activateWorkspace();
      entry.handler(event);
    };

    const dispatcher = (event: KeyboardEvent) => {
      if (isSetupGuideVisible(useSettings.getState())) {
        pendingModifierOnlyEntry = null;
        return;
      }
      if (isImeKeyboardEvent(event)) {
        pendingModifierOnlyEntry = null;
        return;
      }

      // 快捷键录制输入框内的按键一律放行，否则已配置的快捷键会在
      // capture 阶段被吞掉，导致用户无法重新录制同名/相近的快捷键
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-shortcut-recorder]")) {
        pendingModifierOnlyEntry = null;
        return;
      }

      if (
        pendingModifierOnlyEntry &&
        !matchModifierOnlyShortcutKey(
          event,
          getShortcutForEntry(pendingModifierOnlyEntry),
        )
      ) {
        pendingModifierOnlyEntry = null;
      }

      for (const entry of entries) {
        if (shouldSkipAppHotkeyEvent(event, entry.allowRepeat)) continue;
        const shortcut = getShortcutForEntry(entry);
        if (
          !getModifierOnlyShortcut(shortcut) ||
          !matchModifierOnlyShortcutKeyDown(event, shortcut)
        ) {
          continue;
        }
        if (entry.when && !entry.when(event)) return;
        if (isWorkspaceSettingsOpen() && !isHotkeyAllowedInSettings(entry.id)) return;
        pendingModifierOnlyEntry = entry;
        return;
      }

      for (const entry of entries) {
        if (shouldSkipAppHotkeyEvent(event, entry.allowRepeat)) continue;
        if (!entry.match(event)) continue;
        if (entry.when && !entry.when(event)) continue;
        runEntry(entry, event);
        return;
      }
    };

    const handleModifierOnlyKeyUp = (event: KeyboardEvent) => {
      const entry = pendingModifierOnlyEntry;
      pendingModifierOnlyEntry = null;
      if (!entry || isSetupGuideVisible(useSettings.getState())) return;
      if (isImeKeyboardEvent(event)) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-shortcut-recorder]")) return;
      const shortcut = getShortcutForEntry(entry);
      if (!matchModifierOnlyShortcutKey(event, shortcut)) return;
      if (entry.when && !entry.when(event)) return;
      runEntry(entry, event);
    };

    const handleMouseSideButton = (event: MouseEvent) => {
      pendingModifierOnlyEntry = null;
      if (event.button !== 3 && event.button !== 4) return;
      if (isSetupGuideVisible(useSettings.getState())) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-shortcut-recorder]")) return;

      for (const entry of entries) {
        const shortcut = getShortcutForEntry(entry);
        if (!shortcut || !matchMouseShortcut(event, shortcut)) continue;
        const compatibleEvent = event as unknown as KeyboardEvent;
        if (entry.when && !entry.when(compatibleEvent)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        runEntry(entry, compatibleEvent);
        return;
      }

      // 未将侧键分配给其他动作时，保持浏览器式的后退 / 前进体验。
      event.preventDefault();
      event.stopPropagation();
      activateWorkspace();
      if (event.button === 3) {
        useTabs.getState().goBackTabHistory();
      } else {
        useTabs.getState().goForwardTabHistory();
      }
    };

    const suppressMouseSideButton = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const clearPendingModifierOnlyEntry = () => {
      pendingModifierOnlyEntry = null;
    };

    const unregisterEscapeClose = registerEscapeClose({
      document,
      window,
      enabled: () => !isSetupGuideVisible(useSettings.getState()),
      dismissToasts: () => toast.dismiss(),
      closeContent: () => runUnifiedClose(true),
    });
    document.addEventListener("keydown", dispatcher, true);
    document.addEventListener("keyup", handleModifierOnlyKeyUp, true);
    window.addEventListener("blur", clearPendingModifierOnlyEntry);
    window.addEventListener("mousedown", handleMouseSideButton, true);
    window.addEventListener("mouseup", suppressMouseSideButton, true);
    window.addEventListener("auxclick", suppressMouseSideButton, true);
    const handleNewNoteEvent = () => {
      createNewNoteFromHotkey();
    };
    window.addEventListener("goose-note:new-note", handleNewNoteEvent);
    const unsubscribeCloseActiveTab = getGooseDesktop()?.onCloseActiveTab?.(
      () => runUnifiedClose(),
    );
    return () => {
      unsubscribeCloseActiveTab?.();
      unregisterEscapeClose();
      document.removeEventListener("keydown", dispatcher, true);
      document.removeEventListener("keyup", handleModifierOnlyKeyUp, true);
      window.removeEventListener("blur", clearPendingModifierOnlyEntry);
      window.removeEventListener("mousedown", handleMouseSideButton, true);
      window.removeEventListener("mouseup", suppressMouseSideButton, true);
      window.removeEventListener("auxclick", suppressMouseSideButton, true);
      window.removeEventListener("goose-note:new-note", handleNewNoteEvent);
    };
  }, []);
}
