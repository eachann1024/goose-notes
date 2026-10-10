import { useEffect } from "react";
import {
  useQuickNote,
  clampQuickNoteZoom,
  QUICKNOTE_ZOOM_STEP,
} from "@/stores/useQuickNote";
import {
  getQuickNoteSlotShortcut,
  getQuickNoteWorkspaceAction,
  shouldQuickNoteEditableTargetOwnShortcut,
} from "../quickNoteShortcuts";
import { showDesktopMainWindow } from "@/lib/electron/windowToggle";
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import { isImeKeyboardEvent } from "@/hooks/useImeInput";
import { useSettings } from "@/stores/settings";
import type { useQuickNoteSaveActions } from "./useQuickNoteSaveActions";

export function useQuickNoteShortcuts(
  input: ReturnType<typeof useQuickNoteSaveActions>,
) {
  const {
    setEditorZoom,
    handleUndo,
    handleRedo,
    handleSwitchSlot,
    persistPlacementThenClose,
  } = input;

  // 强制置顶（无失焦自动隐藏）：小窗常驻最前层，置顶由主窗 preload 在创建时设定，
  // 失焦不再触发隐藏——点窗外不会收起，只能 Esc / 关闭按钮收起。

  // 键盘：Esc 收起；macOS Cmd / Windows Alt+1~5 切换便签；Cmd/Ctrl+Z 超长期撤销；
  // Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y 重做；Cmd/Ctrl +/- 缩放编辑界面（0 复位）。
  useEffect(() => {
    const onShortcutKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isImeKeyboardEvent(e)) return;
      if (e.key === "Escape") return;
      if (
        shouldQuickNoteEditableTargetOwnShortcut(e.target as HTMLElement | null)
      ) {
        return;
      }

      const shortcutSlot = getQuickNoteSlotShortcut(e);
      if (shortcutSlot !== null) {
        e.preventDefault();
        e.stopPropagation();
        handleSwitchSlot(shortcutSlot, "shortcut");
        return;
      }

      const appShortcuts = useSettings.getState().appShortcuts;
      const workspaceAction = getQuickNoteWorkspaceAction(e, {
        openSearch: appShortcuts.openSearch,
        openSettings: getFixedAppShortcuts().openSettings,
        toggleAIPanel: appShortcuts.toggleAIPanel,
        newNote: getFixedAppShortcuts().newNote,
      });
      if (workspaceAction) {
        e.preventDefault();
        e.stopPropagation();
        void showDesktopMainWindow(workspaceAction);
        return;
      }

      // 仅在按下 Cmd（macOS）/ Ctrl 时处理缩放与撤销。
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // 超长期撤销/重做：未被浮层消费时拦截默认行为，走持久化栈。
      if (key === "z") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (key === "y" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
        return;
      }

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setEditorZoom(
          clampQuickNoteZoom(
            useQuickNote.getState().editorZoom + QUICKNOTE_ZOOM_STEP,
          ),
        );
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setEditorZoom(
          clampQuickNoteZoom(
            useQuickNote.getState().editorZoom - QUICKNOTE_ZOOM_STEP,
          ),
        );
      } else if (e.key === "0") {
        e.preventDefault();
        setEditorZoom(1);
      }
    };
    const onEscapeKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isImeKeyboardEvent(e)) {
        return;
      }
      e.preventDefault();
      persistPlacementThenClose();
    };

    // 槽位和撤销快捷键需先于编辑器默认行为处理；Escape 使用冒泡阶段，
    // 让 Radix/编辑器浮层先关闭自身，未消费时才收起整窗。
    window.addEventListener("keydown", onShortcutKeyDown, true);
    window.addEventListener("keydown", onEscapeKeyDown);
    return () => {
      window.removeEventListener("keydown", onShortcutKeyDown, true);
      window.removeEventListener("keydown", onEscapeKeyDown);
    };
  }, [
    handleSwitchSlot,
    handleUndo,
    handleRedo,
    persistPlacementThenClose,
    setEditorZoom,
  ]);
  return { ...input };
}
