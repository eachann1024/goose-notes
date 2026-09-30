import { normalizePageLayout } from "@/lib/local-frontmatter";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { localStorageAdapter } from "@/lib/storage";
import { applyAccentColor, syncAccentColorCssVars } from "@/lib/accentColor";
import { normalizeCardThemeId } from "@/lib/imageExport/themes";
import { normalizeLocalFontName } from "@/lib/fontLoader";

import type {
  Theme,
  AISettings,
  DesktopSettings,
} from "./types";
import {
  normalizeAccentColor,
  resolveCodeTheme,
  normalizeUIFontSize,
  normalizeEditorFontSize,
  normalizeEditorLineHeight,
  normalizeSidebarFontSize,
  normalizeAutoCloseInactiveTabsHours,
  normalizeAISettings,
  mergeDesktopSettings,
  mergeSearchProvidersWithDefaults,
  normalizeCustomActions,
} from "./types";

import { createAISlice, type AISlice } from "./slices/aiSlice";
import {
  createAppearanceSlice,
  type AppearanceSlice,
} from "./slices/appearanceSlice";
import {
  createShortcutsSlice,
  type ShortcutsSlice,
  normalizeFixedShortcutSettings,
} from "./slices/shortcutsSlice";
import {
  createSearchProvidersSlice,
  type SearchProvidersSlice,
} from "./slices/searchProvidersSlice";
import {
  createLocalFolderSlice,
  type LocalFolderSlice,
} from "./slices/localFolderSlice";
import {
  createWebdavSlice,
  DEFAULT_WEBDAV_REMOTE_DIR,
  type WebdavSlice,
} from "./slices/webdavSlice";
import { normalizeWatermarkConfig } from "@/lib/imageExport";
import { migrateSettingsPersistedState } from "./migrations";

export type SettingsState = AISlice &
  AppearanceSlice &
  ShortcutsSlice &
  SearchProvidersSlice &
  LocalFolderSlice &
  WebdavSlice & {
    _hasHydrated: boolean;
    defaultPageLayout: import("@/types").PageLayout;
    contentsWidth: number;
    setupGuideSeen: boolean;
    setupGuideOpen: boolean;
  };

// 应用主题到 DOM
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  void applyNativeWindowTheme(theme, isDark);

  // Re-apply code style when theme changes (because light/dark mode changed)
  const state = useSettings.getState();
  if (state) {
    applyCodeTheme();
    // 明暗切换后重刷 accent 运行时 token（含行内代码色）。
    // apply 可重复调用；sync 则按当前 data-goose-accent 重写，两者等价于兜底。
    applyAccentColor(state.accentColor);
    syncAccentColorCssVars();
  }
}

async function applyNativeWindowTheme(theme: Theme, isDark: boolean) {
  void theme;
  void isDark;
}

// 应用代码主题到 DOM
function applyCodeTheme() {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  root.setAttribute("data-code-theme", resolveCodeTheme(isDark));
}

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
      version: 10,
      merge: (persisted, current) => ({
        ...current,
        ...normalizeFixedShortcutSettings((persisted ?? {}) as Partial<SettingsState>),
      }) as SettingsState,
      migrate: (persistedState, version) =>
        migrateSettingsPersistedState(persistedState, version),
      storage: createJSONStorage(() => localStorageAdapter),
      skipHydration: true,
      partialize: ({ setupGuideOpen: _open, ...state }) => state,
      onRehydrateStorage: () => (state) => {
        if (state) {
          useSettings.setState({
            defaultPageLayout: normalizePageLayout(state.defaultPageLayout),
            contentsWidth: Number.isFinite(state.contentsWidth) ? Math.min(360, Math.max(128, state.contentsWidth)) : 180,
            setupGuideSeen: state.setupGuideSeen === true,
            setupGuideOpen: false,
          });
        }
        const theme = state?.theme || "system";
        const accentColor = normalizeAccentColor(state?.accentColor);
        applyTheme(theme);
        applyAccentColor(accentColor);
        applyCodeTheme();
        if (state && state.accentColor !== accentColor) {
          useSettings.setState({ accentColor });
        }
        const imageExportThemeId = normalizeCardThemeId(
          state?.imageExportThemeId,
        );
        if (state && state.imageExportThemeId !== imageExportThemeId) {
          useSettings.setState({ imageExportThemeId });
        }
        if (state && typeof state.defaultCodeBlockWrap !== "boolean") {
          useSettings.setState({ defaultCodeBlockWrap: false });
        }
        if (state && typeof state.randomIconOnCreate !== "boolean") {
          useSettings.setState({ randomIconOnCreate: false });
        }
        if (state && state.singleTabMode !== true) {
          useSettings.setState({ singleTabMode: true });
        }

        const normalizedUIFontSize = normalizeUIFontSize(
          state?.uiFontSize as string | undefined,
        );
        if (state && state.uiFontSize !== normalizedUIFontSize) {
          useSettings.setState({ uiFontSize: normalizedUIFontSize });
        }
        const normalizedEditorFontSize = normalizeEditorFontSize(
          state?.editorFontSize,
        );
        if (state && state.editorFontSize !== normalizedEditorFontSize) {
          useSettings.setState({ editorFontSize: normalizedEditorFontSize });
        }
        const editorLineHeight = normalizeEditorLineHeight(state?.editorLineHeight);
        if (state && state.editorLineHeight !== editorLineHeight) {
          useSettings.setState({ editorLineHeight });
        }
        const normalizedSidebarFontSize = normalizeSidebarFontSize(
          state?.sidebarFontSize,
        );
        if (state && state.sidebarFontSize !== normalizedSidebarFontSize) {
          useSettings.setState({ sidebarFontSize: normalizedSidebarFontSize });
        }
        for (const key of ["uiFontFamily", "sidebarFontFamily"] as const) {
          const font = normalizeLocalFontName(state?.[key]);
          if (state && state[key] !== font) useSettings.setState({ [key]: font });
        }

        const normalizedAI = normalizeAISettings(
          state?.ai as Partial<AISettings> | undefined,
        );
        if (
          JSON.stringify(state?.ai ?? null) !== JSON.stringify(normalizedAI)
        ) {
          useSettings.setState({ ai: normalizedAI });
        }

        if (state) {
          if (typeof state.webdavUrl !== "string") {
            useSettings.setState({ webdavUrl: "https://example.com/dav/" });
          }
          if (typeof state.webdavUsername !== "string") {
            useSettings.setState({ webdavUsername: "" });
          }
          if (typeof state.webdavPassword !== "string") {
            useSettings.setState({ webdavPassword: "" });
          }
          if (typeof state.webdavRemoteDir !== "string") {
            useSettings.setState({ webdavRemoteDir: DEFAULT_WEBDAV_REMOTE_DIR });
          }
          const retention = state.webdavRetentionDays;
          if (
            typeof retention !== "number" ||
            !Number.isFinite(retention) ||
            retention <= 0
          ) {
            useSettings.setState({ webdavRetentionDays: 365 });
          }
          if (typeof state.webdavAutoBackupEnabled !== "boolean") {
            useSettings.setState({ webdavAutoBackupEnabled: true });
          }
          if (typeof state.showRecentInSearch !== "boolean") {
            useSettings.setState({ showRecentInSearch: true });
          }
          const normalizedPrivacy = {
            autoOpenLastNote:
              typeof state.privacy?.autoOpenLastNote === "boolean"
                ? state.privacy.autoOpenLastNote
                : true,
            autoCloseInactiveTabs:
              typeof state.privacy?.autoCloseInactiveTabs === "boolean"
                ? state.privacy.autoCloseInactiveTabs
                : false,
            autoCloseInactiveTabsHours: normalizeAutoCloseInactiveTabsHours(
              state.privacy?.autoCloseInactiveTabsHours,
            ),
          };
          if (
            JSON.stringify(state.privacy ?? null) !==
            JSON.stringify(normalizedPrivacy)
          ) {
            useSettings.setState({ privacy: normalizedPrivacy });
          }

          const mergedProviders = mergeSearchProvidersWithDefaults(
            state.searchProviders,
          );
          if (
            JSON.stringify(state.searchProviders) !==
            JSON.stringify(mergedProviders)
          ) {
            useSettings.setState({ searchProviders: mergedProviders });
          }

          const normalizedCustomActions = normalizeCustomActions(
            state.customActions,
          );
          if (
            JSON.stringify(state.customActions ?? []) !==
            JSON.stringify(normalizedCustomActions)
          ) {
            useSettings.setState({ customActions: normalizedCustomActions });
          }

          const storedDesktop = state.desktop as
            | Partial<DesktopSettings>
            | undefined;
          const mergedDesktop: DesktopSettings =
            mergeDesktopSettings(storedDesktop);
          if (JSON.stringify(state.desktop) !== JSON.stringify(mergedDesktop)) {
            useSettings.setState({ desktop: mergedDesktop });
          }

          const mergedWatermark = normalizeWatermarkConfig(
            state.imageExportWatermark,
          );
          if (
            JSON.stringify(state.imageExportWatermark) !==
            JSON.stringify(mergedWatermark)
          ) {
            useSettings.setState({ imageExportWatermark: mergedWatermark });
          }
        }

        if (state) {
          const normalizedLocalFolderFileManager =
            typeof state.localFolderFileManager === "string"
              ? state.localFolderFileManager.trim()
              : "";
          const normalizedLocalFolderExternalEditor =
            typeof state.localFolderExternalEditor === "string"
              ? state.localFolderExternalEditor.trim()
              : "";
          const normalizedLocalFolderTerminal =
            typeof state.localFolderTerminal === "string"
              ? state.localFolderTerminal.trim()
              : "";
          const normalizedLocalFolderHiddenFolders = Array.isArray(
            state.localFolderHiddenFolders,
          )
            ? state.localFolderHiddenFolders.filter(
                (item: unknown): item is string =>
                  typeof item === "string" && item.length > 0,
              )
            : ["assets"];
          if (
            state.localFolderFileManager !== normalizedLocalFolderFileManager ||
            state.localFolderExternalEditor !==
              normalizedLocalFolderExternalEditor ||
            state.localFolderTerminal !== normalizedLocalFolderTerminal ||
            state.localFolderHiddenFolders !==
              normalizedLocalFolderHiddenFolders
          ) {
            useSettings.setState({
              localFolderFileManager: normalizedLocalFolderFileManager,
              localFolderExternalEditor: normalizedLocalFolderExternalEditor,
              localFolderTerminal: normalizedLocalFolderTerminal,
              localFolderHiddenFolders: normalizedLocalFolderHiddenFolders,
            });
          }
        }
        // 标记 hydration 完成
        useSettings.setState({ _hasHydrated: true });
      },
    },
  ),
);

// 监听系统主题变化
if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemThemeChange = () => {
    const { theme } = useSettings.getState();
    if (theme === "system") {
      applyTheme("system");
    }
    applyCodeTheme();
  };
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleSystemThemeChange);
  } else {
    mediaQuery.addListener(handleSystemThemeChange);
  }

  // 立即初始化主题（确保在 DOM 加载后立即应用）
  const initThemes = () => {
    const state = useSettings.getState();
    applyTheme(state.theme);
    applyAccentColor(state.accentColor);
    applyCodeTheme();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemes);
  } else {
    initThemes();
  }
}

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
