import { isSetupGuideVisible } from "@/lib/setupGuide";
import { toast } from "@/components/ui/sonner";
import { useSettings } from "@/stores/useSettings";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { useTabs } from "@/stores/useTabs";
import {
  getModifierOnlyShortcut,
  matchMouseShortcut,
  matchModifierOnlyShortcutKey,
  matchModifierOnlyShortcutKeyDown,
} from "@/lib/shortcut-match";
import { registerEscapeClose } from "@/lib/escape-close";
import {
  isImeKeyboardEvent,
  shouldSkipAppHotkeyEvent,
} from "@/hooks/useImeInput";
import {
  activateWorkspace,
  isHotkeyAllowedInSettings,
  isWorkspaceNavigationHotkey,
  isWorkspaceSettingsOpen,
} from "@/lib/settings-navigation";
import { createHotkeyActions } from "./actions";
import type { AppHotkeyRefs, HotkeyEntry } from "./types";
import { createEditorHotkeys } from "./editor";
import { createWorkspaceHotkeys } from "./workspace";
import { createSplitHotkeys } from "./split";
import { createTabsHotkeys } from "./tabs";

export function installAppHotkeyListeners(refs: AppHotkeyRefs): () => void {
  const { appShortcutsRef, openTabsRef, activeTabIdRef } = refs;
  const actions = createHotkeyActions(refs);
  const { runUnifiedClose, createNewNoteFromHotkey } = actions;
  const entries: HotkeyEntry[] = [
    ...createEditorHotkeys(actions),
    ...createWorkspaceHotkeys(actions),
    ...createSplitHotkeys(actions),
    ...createTabsHotkeys(actions),
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
      if (isWorkspaceSettingsOpen() && !isHotkeyAllowedInSettings(entry.id))
        return;
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

  const unsubscribeCloseActiveTab = getGooseDesktop()?.onCloseActiveTab?.(() =>
    runUnifiedClose(),
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
}
