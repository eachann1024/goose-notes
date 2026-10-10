import { useSettings } from "@/stores/useSettings";
import { useTabs } from "@/stores/useTabs";
import { matchShortcut } from "@/lib/shortcut-match";
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
import type { HotkeyEntry } from "./types";
import type { AppHotkeyActions } from "./actions";

export function createWorkspaceHotkeys(
  actions: AppHotkeyActions,
): HotkeyEntry[] {
  const {
    appShortcutsRef,
    fixedShortcuts,
    matchesConfiguredShortcut,
    createNewNoteFromHotkey,
  } = actions;
  return [
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
  ];
}
