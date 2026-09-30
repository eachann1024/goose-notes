import { getPlatformKind, type PlatformKind } from "@/lib/utils";
import { normalizeShortcutForConflict } from "@/lib/shortcut-platform";

export const FIXED_CLOSE_SHORTCUT = "Escape";

export const FIXED_SPLIT_SHORTCUTS = {
  splitRight: "Mod+D",
  splitDown: "Mod+Shift+D",
  splitFocusLeft: "Mod+Alt+ArrowLeft",
  splitFocusRight: "Mod+Alt+ArrowRight",
  splitFocusUp: "Mod+Alt+ArrowUp",
  splitFocusDown: "Mod+Alt+ArrowDown",
  splitFocusPrevious: "Mod+Alt+[",
  splitFocusNext: "Mod+Alt+]",
  splitZoom: "Mod+Shift+Enter",
  // 关闭分屏统一交给 Escape / 桌面 Mod+W 的分层关闭，不注册独立动作。
  closeSplitPane: "",
} as const;

/** 固定关闭和分屏的占用不能被旧配置或设置 action 覆盖。 */
export function isReservedCloseOrSplitShortcut(
  shortcut: string,
  platform: PlatformKind = getPlatformKind(),
): boolean {
  const normalized = normalizeShortcutForConflict(shortcut, platform);
  return !!normalized && [FIXED_CLOSE_SHORTCUT, "Mod+W", ...Object.values(FIXED_SPLIT_SHORTCUTS)]
    .some((value) => normalizeShortcutForConflict(value, platform) === normalized);
}

export const FIXED_APP_SHORTCUT_IDS = [
  "openSettings",
  "editorFindOpen",
  "newNote",
  "reopenTab",
] as const;

export type FixedAppShortcutId = (typeof FIXED_APP_SHORTCUT_IDS)[number];

/** 旧版本提供过配置入口，但现在不再保留的动作。 */
export const REMOVED_APP_SHORTCUT_IDS = ["saveNote"] as const;

export const NON_CUSTOMIZABLE_APP_SHORTCUT_IDS = new Set<string>([
  ...FIXED_APP_SHORTCUT_IDS,
  ...Object.keys(FIXED_SPLIT_SHORTCUTS),
  ...REMOVED_APP_SHORTCUT_IDS,
]);

export function getFixedAppShortcuts(
  _platform: PlatformKind = getPlatformKind(),
): Record<FixedAppShortcutId, string> {
  return {
    openSettings: "Mod+,",
    editorFindOpen: "Mod+F",
    newNote: "Mod+N",
    reopenTab: "Mod+Shift+T",
  };
}
