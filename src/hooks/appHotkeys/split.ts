import { FIXED_SPLIT_SHORTCUTS } from "@/lib/fixed-app-shortcuts";
import {
  focusNeighbor,
  focusNextSplitPane,
  focusPreviousSplitPane,
  splitDown,
  splitRight,
  toggleZoom,
} from "@/lib/editor-split/commands";
import type { HotkeyEntry } from "./types";
import type { AppHotkeyActions } from "./actions";

export function createSplitHotkeys(actions: AppHotkeyActions): HotkeyEntry[] {
  const { matchesConfiguredShortcut } = actions;
  return [
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
  ];
}
