import type { SettingsState } from "./state";
import { useSettings } from "./index";
import { normalizePageLayout } from "@/lib/local-frontmatter";
import {
  normalizeAccentColor,
  normalizeUIFontSize,
  normalizeEditorFontSize,
  normalizeEditorLineHeight,
  normalizeSidebarFontSize,
  normalizeAISettings,
  normalizeAutoCloseInactiveTabsHours,
  mergeSearchProvidersWithDefaults,
  normalizeCustomActions,
  mergeDesktopSettings,
} from "./types";
import { applyTheme, applyCodeTheme } from "./theme";
import { applyAccentColor } from "@/lib/accentColor";
import { normalizeCardThemeId } from "@/lib/imageExport/themes";
import { normalizeLocalFontName } from "@/lib/fontLoader";
import type { AISettings, DesktopSettings } from "./types";
import { DEFAULT_WEBDAV_REMOTE_DIR } from "./slices/webdavSlice";
import { normalizeWatermarkConfig } from "@/lib/imageExport";

export function hydrateSettings(state?: SettingsState) {
  if (state) {
    useSettings.setState({
      defaultPageLayout: normalizePageLayout(state.defaultPageLayout),
      contentsWidth: Number.isFinite(state.contentsWidth)
        ? Math.min(360, Math.max(128, state.contentsWidth))
        : 180,
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
  const imageExportThemeId = normalizeCardThemeId(state?.imageExportThemeId);
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

  const normalizedUIFontSize = normalizeUIFontSize(state?.uiFontSize);
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
  if (JSON.stringify(state?.ai ?? null) !== JSON.stringify(normalizedAI)) {
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
      JSON.stringify(state.searchProviders) !== JSON.stringify(mergedProviders)
    ) {
      useSettings.setState({ searchProviders: mergedProviders });
    }

    const normalizedCustomActions = normalizeCustomActions(state.customActions);
    if (
      JSON.stringify(state.customActions ?? []) !==
      JSON.stringify(normalizedCustomActions)
    ) {
      useSettings.setState({ customActions: normalizedCustomActions });
    }

    const storedDesktop = state.desktop as Partial<DesktopSettings> | undefined;
    const mergedDesktop: DesktopSettings = mergeDesktopSettings(storedDesktop);
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
      state.localFolderExternalEditor !== normalizedLocalFolderExternalEditor ||
      state.localFolderTerminal !== normalizedLocalFolderTerminal ||
      state.localFolderHiddenFolders !== normalizedLocalFolderHiddenFolders
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
}
