import { useSettings, EDITOR_FONT_SIZE_DEFAULT } from "@/stores/useSettings";
import { useSidebarView } from "@/stores/useSidebarView";
import { closeAllOverlays } from "@/lib/closeAllOverlays";
import { matchShortcut } from "@/lib/shortcut-match";
import { isPlatformPrimaryModifierEvent } from "@/lib/shortcut-platform";
import { isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import type { HotkeyEntry } from "./types";
import type { AppHotkeyActions } from "./actions";

export function createEditorHotkeys(actions: AppHotkeyActions): HotkeyEntry[] {
  const {
    appShortcutsRef,
    fixedShortcuts,
    isZoomInKey,
    isZoomOutKey,
    isZoomResetKey,
    hasPrimaryModifier,
    matchesConfiguredShortcut,
  } = actions;
  return [
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
        if (isWorkspaceSettingsOpen())
          window.dispatchEvent(
            new CustomEvent("goose-note:toggle-settings-sidebar"),
          );
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
  ];
}
