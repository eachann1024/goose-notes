import { useSettings } from "@/stores/useSettings";
import {
  QUICKNOTE_DEFAULT_HEIGHT,
  QUICKNOTE_DEFAULT_WIDTH,
  createEmptyQuickNoteDrafts,
  useQuickNote,
} from "@/stores/useQuickNote";
import { createEmptySlotStacks } from "@/lib/quicknote/undoHistory";
import { useSidebarView } from "@/stores/useSidebarView";
import { AI_INITIAL_STATE } from "@/stores/settings/slices/aiSlice";
import { APPEARANCE_INITIAL_STATE } from "@/stores/settings/slices/appearanceSlice";
import { LOCAL_FOLDER_INITIAL_STATE } from "@/stores/settings/slices/localFolderSlice";
import { SEARCH_PROVIDERS_INITIAL_STATE } from "@/stores/settings/slices/searchProvidersSlice";
import { SHORTCUTS_INITIAL_STATE } from "@/stores/settings/slices/shortcutsSlice";
import { WEBDAV_INITIAL_STATE } from "@/stores/settings/slices/webdavSlice";
import { HostAdapter } from "@/lib/host/adapter";
import { toast } from "@/components/ui/sonner";
import { GOOSE_APPS } from "./shared";
import type { useSettingsBackupRestore } from "./useSettingsBackupRestore";

export function useSettingsResetActions(
  input: ReturnType<typeof useSettingsBackupRestore>,
) {
  const {
    onOpenChange,
    setTheme,
    accentColor,
    setAccentColor,
    setResetDialogOpen,
    resetting,
    setResetting,
    dismissAppsBanner,
    resetAppsBanner,
    canReset,
    clearCurrentContent,
    createDefaultNotebook,
    restoreBackupWithRollback,
  } = input;

  const resetSettingsToDefaults = async () => {
    await useSettings.persist.clearStorage();
    useSettings.setState({
      ...structuredClone(AI_INITIAL_STATE),
      ...structuredClone(APPEARANCE_INITIAL_STATE),
      ...structuredClone(LOCAL_FOLDER_INITIAL_STATE),
      ...structuredClone(SEARCH_PROVIDERS_INITIAL_STATE),
      ...structuredClone(SHORTCUTS_INITIAL_STATE),
      ...structuredClone(WEBDAV_INITIAL_STATE),
      _hasHydrated: true,
    });
    useSettings.getState().setTheme("system");
    useSettings.getState().setAccentColor(APPEARANCE_INITIAL_STATE.accentColor);
    resetAppsBanner();
  };

  const resetAuxiliaryAppState = () => {
    useQuickNote.persist.clearStorage();
    useQuickNote.setState({
      activeSlot: 1,
      drafts: createEmptyQuickNoteDrafts(),
      undoStacks: createEmptySlotStacks(),
      redoStacks: createEmptySlotStacks(),
      pinned: true,
      editorZoom: 1,
      windowWidth: QUICKNOTE_DEFAULT_WIDTH,
      windowHeight: QUICKNOTE_DEFAULT_HEIGHT,
      windowX: undefined,
      windowY: undefined,
    });

    useSidebarView.persist.clearStorage();
    useSidebarView.setState({
      expandedByNotebook: {},
      focusedByNotebook: {},
      selectedByNotebook: {},
      favoritesCollapsed: false,
      sidebarCollapsed: false,
    });

    [
      "goose-recent-excludes",
      "goose-note-ai-panel-open",
      "goose-note-ai-panel-width",
      "sidebar-width",
      "settings-sidebar-width",
    ].forEach((key) => window.localStorage.removeItem(key));
  };

  const handleReset = async (zipBlob?: Blob) => {
    if (zipBlob) {
      await restoreBackupWithRollback(zipBlob);
      return;
    }
    if (!canReset) return;
    await clearCurrentContent();
    createDefaultNotebook();
    await resetSettingsToDefaults();
    resetAuxiliaryAppState();
    setResetDialogOpen(false);
    onOpenChange(false);
    toast.success("重置成功");
  };

  const handleManualReset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await handleReset();
    } catch (error) {
      console.error("Reset failed", error);
      toast.error("重置失败", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setResetting(false);
    }
  };

  const handleCloseAppsBanner = () => {
    dismissAppsBanner();
  };

  const handleOpenApp = (app: (typeof GOOSE_APPS)[number]) => {
    HostAdapter.openUrl(app.url, false);
  };
  return {
    ...input,
    resetSettingsToDefaults,
    resetAuxiliaryAppState,
    handleReset,
    handleManualReset,
    handleCloseAppsBanner,
    handleOpenApp,
  };
}
