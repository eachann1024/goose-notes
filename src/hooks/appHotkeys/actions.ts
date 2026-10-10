import { isSetupGuideVisible } from "@/lib/setupGuide";
import { toast } from "@/components/ui/sonner";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { getGooseDesktop, isElectronRuntime } from "@/lib/electron/runtime";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { matchShortcut, shortcutHasModifier } from "@/lib/shortcut-match";
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import {
  OPEN_ESCAPE_LAYER_SELECTOR,
  OPEN_TOAST_SELECTOR,
} from "@/lib/escape-close";
import { isPlatformPrimaryModifierEvent } from "@/lib/shortcut-platform";
import {
  closeNotebookAiIfFullscreen,
  closeNotebookAiPanel,
} from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { closePaneOrTab } from "@/lib/editor-split/commands";
import {
  activateWorkspace,
  isWorkspaceSettingsOpen,
} from "@/lib/settings-navigation";
import { findLoneVisibleWorkspaceTab } from "@/pages/workspace/components/page/visibleTabs";
import type { AppHotkeyRefs } from "./types";

export function createHotkeyActions(refs: AppHotkeyRefs) {
  const { appShortcutsRef, openTabsRef, activeTabIdRef } = refs;
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
    isPlatformPrimaryModifierEvent(event) && !event.altKey && !event.repeat;

  const matchesConfiguredShortcut = (event: KeyboardEvent, shortcut: string) =>
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
    const dialogEl = Array.from(
      document.querySelectorAll(OPEN_ESCAPE_LAYER_SELECTOR),
    ).at(-1);
    if (dialogEl) {
      if (fromEscape) return;
      // HeroUI listens on the dialog subtree, not document.
      const target = dialogEl.contains(document.activeElement)
        ? document.activeElement!
        : dialogEl;
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
        notebook?.source === "local-folder" ? "已创建新文件" : "已创建新笔记",
        { duration: 1500 },
      );
    })();
  };
  return {
    ...refs,
    fixedShortcuts,
    isEditableEventTarget,
    isZoomInKey,
    isZoomOutKey,
    isZoomResetKey,
    hasPrimaryModifier,
    matchesConfiguredShortcut,
    runUnifiedClose,
    createNewNoteFromHotkey,
  };
}

export type AppHotkeyActions = ReturnType<typeof createHotkeyActions>;
