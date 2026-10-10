import { applyTheme, startSettingsThemeLifecycle } from "./theme";
import { applyAccentColor } from "@/lib/accentColor";
import { create } from "zustand";
import type { SettingsState } from "./state";
import { persist, createJSONStorage } from "zustand/middleware";
import { createAISlice } from "./slices/aiSlice";
import { createAppearanceSlice } from "./slices/appearanceSlice";
import {
  createShortcutsSlice,
  normalizeFixedShortcutSettings,
} from "./slices/shortcutsSlice";
import { createSearchProvidersSlice } from "./slices/searchProvidersSlice";
import { createLocalFolderSlice } from "./slices/localFolderSlice";
import { createWebdavSlice } from "./slices/webdavSlice";
import { migrateSettingsPersistedState } from "./migrations";
import { localStorageAdapter } from "@/lib/storage";
import { hydrateSettings } from "./hydration";

const applyFns = { applyTheme, applyAccentColor };

const getApply = () => applyFns;

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...createAISlice(set as Parameters<typeof createAISlice>[0]),
      ...createAppearanceSlice(
        set as Parameters<typeof createAppearanceSlice>[0],
        getApply,
      ),
      ...createShortcutsSlice(
        set as Parameters<typeof createShortcutsSlice>[0],
      ),
      ...createSearchProvidersSlice(
        set as Parameters<typeof createSearchProvidersSlice>[0],
      ),
      ...createLocalFolderSlice(
        set as Parameters<typeof createLocalFolderSlice>[0],
      ),
      ...createWebdavSlice(set as Parameters<typeof createWebdavSlice>[0]),
      _hasHydrated: false,
      defaultPageLayout: "standard",
      contentsWidth: 180,
      setupGuideSeen: false,
      setupGuideOpen: false,
    }),
    {
      name: "goose-note-settings",
      version: 11,
      merge: (persisted, current) =>
        ({
          ...current,
          ...normalizeFixedShortcutSettings(
            (persisted ?? {}) as Partial<SettingsState>,
          ),
        }) as SettingsState,
      migrate: (persistedState, version) =>
        migrateSettingsPersistedState(persistedState, version),
      storage: createJSONStorage(() => localStorageAdapter),
      skipHydration: true,
      partialize: ({ setupGuideOpen: _open, ...state }) => state,
      onRehydrateStorage: () => hydrateSettings,
    },
  ),
);

startSettingsThemeLifecycle();

export type { SettingsState } from "./state";
// Re-export all types from types.ts for backward compatibility
export type {
  SearchProvider,
  Theme,
  AccentColor,
  AISettings,
  DesktopHotkeyStatusState,
  DesktopHotkeyStatus,
  DesktopSettings,
  PrivacySettings,
  FontConfig,
  CustomFonts,
  CustomAction,
  UIFontSize,
} from "./types";
export {
  EDITOR_FONT_SIZE_MIN,
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_DEFAULT,
  SIDEBAR_FONT_SIZE_MIN,
  SIDEBAR_FONT_SIZE_MAX,
  SIDEBAR_FONT_SIZE_DEFAULT,
  DEFAULT_WAKE_HOTKEY,
  DEFAULT_SEARCH_HOTKEY,
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_CLOSE_TAB_SHORTCUT,
  DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT,
  AUTO_CLOSE_INACTIVE_TABS_HOURS_MIN,
  AUTO_CLOSE_INACTIVE_TABS_HOURS_MAX,
  AUTO_CLOSE_INACTIVE_TABS_HOURS_DEFAULT,
  DEFAULT_SEARCH_PROVIDERS,
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
} from "./types";
export { DEFAULT_APP_SHORTCUTS } from "./slices/shortcutsSlice";
