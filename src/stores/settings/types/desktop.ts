import { FIXED_CLOSE_SHORTCUT } from "@/lib/fixed-app-shortcuts";

export type DesktopHotkeyStatusState =
  | "idle"
  | "active"
  | "occupied"
  | "invalid"
  | "disabled"
  | "error";

export interface DesktopHotkeyStatus {
  state: DesktopHotkeyStatusState;
  message?: string;
  rawError?: string;
}

export interface DesktopSettings {
  wakeHotkey: string;
  wakeHotkeyEnabled: boolean;
  searchHotkey: string;
  searchHotkeyEnabled: boolean;
  /** 速记小窗唤出/隐藏（仅 Electron 桌面端展示与注册）。 */
  quicknoteHotkey: string;
  quicknoteHotkeyEnabled: boolean;
  wakeHotkeyStatus: DesktopHotkeyStatus;
  searchHotkeyStatus: DesktopHotkeyStatus;
  quicknoteHotkeyStatus: DesktopHotkeyStatus;
}

export interface PrivacySettings {
  autoOpenLastNote: boolean;
  autoCloseInactiveTabs: boolean;
  autoCloseInactiveTabsHours: number;
}

export const DEFAULT_WAKE_HOTKEY = "CmdOrCtrl+Alt+N";

export const DEFAULT_SEARCH_HOTKEY = "CmdOrCtrl+Shift+K";

export const DEFAULT_QUICKNOTE_HOTKEY = "Alt+N";

export const LEGACY_DEFAULT_QUICKNOTE_HOTKEY = "CmdOrCtrl+Alt+Q";

export const DEFAULT_CLOSE_TAB_SHORTCUT = FIXED_CLOSE_SHORTCUT;

export const DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT = FIXED_CLOSE_SHORTCUT;

export const ELECTRON_WINDOW_HEIGHT_MIN = 600;

export const ELECTRON_WINDOW_HEIGHT_MAX = 1200;

export const ELECTRON_WINDOW_HEIGHT_DEFAULT = 800;

export const AUTO_CLOSE_INACTIVE_TABS_HOURS_MIN = 1;

export const AUTO_CLOSE_INACTIVE_TABS_HOURS_MAX = 720;

export const AUTO_CLOSE_INACTIVE_TABS_HOURS_DEFAULT = 24;

export const DEFAULT_HOTKEY_STATUS: DesktopHotkeyStatus = {
  state: "idle",
};

export function normalizeDesktopHotkeyStatus(
  status: Partial<DesktopHotkeyStatus> | undefined,
): DesktopHotkeyStatus {
  const state = status?.state;
  if (
    state !== "idle" &&
    state !== "active" &&
    state !== "occupied" &&
    state !== "invalid" &&
    state !== "disabled" &&
    state !== "error"
  ) {
    return DEFAULT_HOTKEY_STATUS;
  }

  return {
    state,
    message: status?.message,
    rawError: status?.rawError,
  };
}

/** 水合合并：持久化里缺省的 desktop 字段（含后加的 quicknote 三字段）回退默认值。 */
export function mergeDesktopSettings(
  stored: Partial<DesktopSettings> | undefined,
): DesktopSettings {
  return {
    wakeHotkey: stored?.wakeHotkey ?? DEFAULT_WAKE_HOTKEY,
    wakeHotkeyEnabled: stored?.wakeHotkeyEnabled ?? true,
    searchHotkey: stored?.searchHotkey ?? DEFAULT_SEARCH_HOTKEY,
    searchHotkeyEnabled: stored?.searchHotkeyEnabled ?? true,
    quicknoteHotkey: stored?.quicknoteHotkey ?? DEFAULT_QUICKNOTE_HOTKEY,
    quicknoteHotkeyEnabled: stored?.quicknoteHotkeyEnabled ?? true,
    wakeHotkeyStatus: normalizeDesktopHotkeyStatus(stored?.wakeHotkeyStatus),
    searchHotkeyStatus: normalizeDesktopHotkeyStatus(
      stored?.searchHotkeyStatus,
    ),
    quicknoteHotkeyStatus: normalizeDesktopHotkeyStatus(
      stored?.quicknoteHotkeyStatus,
    ),
  };
}

export function normalizeAutoCloseInactiveTabsHours(hours: unknown): number {
  if (typeof hours !== "number" || !Number.isFinite(hours)) {
    return AUTO_CLOSE_INACTIVE_TABS_HOURS_DEFAULT;
  }

  return Math.min(
    AUTO_CLOSE_INACTIVE_TABS_HOURS_MAX,
    Math.max(AUTO_CLOSE_INACTIVE_TABS_HOURS_MIN, Math.round(hours)),
  );
}
