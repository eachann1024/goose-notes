import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsAbout } from "./settings/SettingsAbout";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsShortcuts } from "./settings/SettingsShortcuts";
import { SettingsLocalFolder } from "./SettingsLocalFolder";
import {
  LOCAL_FOLDER_EDITOR_CANDIDATES,
  LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  LOCAL_FOLDER_TERMINAL_CANDIDATES,
} from "@/lib/local-folder-open-apps";
import { shell } from "@/lib/electron-platform/shell";
import { SettingsDataPanel } from "./settings/SettingsDataPanel";
import { SettingsAI } from "./SettingsAI";
import { SettingsScaffold } from "./settings/SettingsScaffold";
import type { SettingsTab, SettingsTabConfig } from "./settings/types";
import { useShallow } from "zustand/react/shallow";
import {
  useNotebooks,
  DEFAULT_NOTEBOOK,
  sortNotebooksByOrder,
} from "@/stores/useNotebooks";
import { clearLocalPageMetadataCache, usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { useTabs } from "@/stores/useTabs";
import { useNotebookAiChats } from "@/stores/useNotebookAiChats";
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
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import {
  clearPersistedInternalPages,
  clearPersistedPages,
} from "@/lib/storage/pageRepository";
import { clearLegacyStorage } from "@/lib/storage/migrateLegacyStorage";
import { historyRepository } from "@/lib/history/repository";
import { clearAllLocalMdSnapshots } from "@/lib/local-md-snapshot";
import { removeLocalPageIdMap } from "@/lib/local-page-idmap";
import { removeLocalFolderOrders } from "@/stores/localFolderOrder";
import { usePersistentDismissState } from "@/hooks/usePersistentDismissState";
import { HostAdapter } from "@/lib/host/adapter";
import type { ExportOptions } from "@/lib/export";
import { localStorageAdapter as dataStorage } from "@/lib/storage";
import * as LucideIcons from "lucide-react";
import { ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SETTINGS_TABS: SettingsTabConfig[] = [
  { id: "appearance", label: "外观主题", icon: LucideIcons.Laptop },
  { id: "general", label: "通用设置", icon: LucideIcons.Settings },
  { id: "shortcuts", label: "快捷键", icon: LucideIcons.Keyboard },
  { id: "local-folder", label: "本地文件夹", icon: LucideIcons.FolderOpen },
  { id: "ai", label: "AI 助手", icon: LucideIcons.Sparkles },
  { id: "data", label: "数据管理", icon: LucideIcons.Database },
  { id: "about", label: "关于与许可", icon: LucideIcons.Info },
];

// 设置侧栏鹅应用：图标使用各应用随包提供的 logo.png
const GOOSE_APPS = [
  {
    id: "goose-quicknote",
    name: "鹅的小窗",
    icon: "./apps/goose-quicknote.png",
    storeQuery: "鹅的小窗",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E5%B0%8F%E7%AA%97/",
  },
  {
    id: "goose-marks",
    name: "鹅的书签",
    icon: "./apps/goose-marks.png",
    storeQuery: "鹅的书签",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E4%B9%A6%E7%AD%BE/",
  },
  {
    id: "goose-monitor",
    name: "鹅的监控",
    icon: "./apps/goose-monitor.png",
    storeQuery: "鹅的监控",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E7%9B%91%E6%8E%A7/",
  },
  {
    id: "goose-2fa",
    name: "鹅的二次验证",
    icon: "./apps/goose-2fa.png",
    storeQuery: "鹅的二次验证（2FA）",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E4%BA%8C%E6%AC%A1%E9%AA%8C%E8%AF%81%EF%BC%882FA%EF%BC%89/",
  },
];

const FEEDBACK_URL = "https://wj.qq.com/s2/25958121/2d2e/";
const SETTINGS_APPS_BANNER_ID = "settings:recommended-apps-banner";

// Electron 桌面端（仅本地模式）：无 Electron 生态，隐藏鹅的全家桶入口。
const isElectronHost = __HOST_TARGET__ === "electron";

const recordPreOverwriteHistory = async (id: string | undefined) => {
  if (!id) return;
  const existingPage = usePages.getState().pages[id];
  if (existingPage && existingPage.content) {
    const oldContent = existingPage.content;
    const oldWorkspaceId = existingPage.workspaceId;
    try {
      const { recordHistorySnapshot } = await import("@/lib/history/snapshot");
      await recordHistorySnapshot({
        pageId: id,
        workspaceId: oldWorkspaceId,
        content: oldContent,
        trigger: "manual",
        isMilestone: true,
        label: "备份覆盖前本地版本",
      });
    } catch (err) {
      console.error("[history] Failed to save pre-overwrite history", err);
    }
  }
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  useEffect(() => {
    document.body.toggleAttribute("data-goose-settings-open", open);

    return () => {
      document.body.removeAttribute("data-goose-settings-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const prewarmLocalFolderOpenApps = () => {
      if (cancelled) return;
      void Promise.all([
        shell.listAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES),
      ]);
    };

    const schedule =
      typeof window !== "undefined" &&
      typeof window.requestIdleCallback === "function"
        ? () => {
            idleId = window.requestIdleCallback(() => {
              prewarmLocalFolderOpenApps();
            });
          }
        : () => {
            timeoutId = setTimeout(prewarmLocalFolderOpenApps, 0);
          };

    schedule();

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [open]);

  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    codeStyle,
    setCodeStyle,
    searchProviders,
    toggleSearchProvider,
    reorderSearchProviders,
    addCustomSearchProvider,
    updateCustomSearchProvider,
    removeCustomSearchProvider,
    ai,
    setAIEnabled,
    setAIReadGlobalPrompt,
    setAIReadLocalSkills,
    setAISelectedModelId,
    saveAICustomConfig,
    privacy,
    setAutoOpenLastNote,
    singleTabMode,
    showRecentInSearch,
    setShowRecentInSearch,
    closeTabShortcut,
    setCloseTabShortcut,
    searchPanelCloseShortcut,
    setSearchPanelCloseShortcut,
    appShortcuts,
    setAppShortcut,
    resetAppShortcuts,
    customFonts,
    setCustomLabel,
    setCustomFont,
    uiFontSize,
    setUIFontSize,
    sidebarFontSize,
    increaseSidebarFontSize,
    decreaseSidebarFontSize,
    editorFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    randomIconOnCreate,
    setRandomIconOnCreate,

    customActions,
    addCustomAction,
    updateCustomAction,
    removeCustomAction,
    notebookDropdownHoverExpand,
    setNotebookDropdownHoverExpand,
    localFolderFileManager,
    setLocalFolderFileManager,
    localFolderExternalEditor,
    setLocalFolderExternalEditor,
    localFolderTerminal,
    setLocalFolderTerminal,
    localFolderHiddenFolders,
    setLocalFolderHiddenFolders,
  } = useSettings(
    useShallow((s) => ({
      theme: s.theme,
      setTheme: s.setTheme,
      accentColor: s.accentColor,
      setAccentColor: s.setAccentColor,
      codeStyle: s.codeStyle,
      setCodeStyle: s.setCodeStyle,
      searchProviders: s.searchProviders,
      toggleSearchProvider: s.toggleSearchProvider,
      reorderSearchProviders: s.reorderSearchProviders,
      addCustomSearchProvider: s.addCustomSearchProvider,
      updateCustomSearchProvider: s.updateCustomSearchProvider,
      removeCustomSearchProvider: s.removeCustomSearchProvider,
      ai: s.ai,
      setAIEnabled: s.setAIEnabled,
      setAIReadGlobalPrompt: s.setAIReadGlobalPrompt,
      setAIReadLocalSkills: s.setAIReadLocalSkills,
      setAISelectedModelId: s.setAISelectedModelId,
      saveAICustomConfig: s.saveAICustomConfig,
      privacy: s.privacy,
      setAutoOpenLastNote: s.setAutoOpenLastNote,
      singleTabMode: s.singleTabMode,
      showRecentInSearch: s.showRecentInSearch,
      setShowRecentInSearch: s.setShowRecentInSearch,
      closeTabShortcut: s.closeTabShortcut,
      setCloseTabShortcut: s.setCloseTabShortcut,
      searchPanelCloseShortcut: s.searchPanelCloseShortcut,
      setSearchPanelCloseShortcut: s.setSearchPanelCloseShortcut,
      appShortcuts: s.appShortcuts,
      setAppShortcut: s.setAppShortcut,
      resetAppShortcuts: s.resetAppShortcuts,
      customFonts: s.customFonts,
      setCustomLabel: s.setCustomLabel,
      setCustomFont: s.setCustomFont,
      uiFontSize: s.uiFontSize,
      setUIFontSize: s.setUIFontSize,
      sidebarFontSize: s.sidebarFontSize,
      increaseSidebarFontSize: s.increaseSidebarFontSize,
      decreaseSidebarFontSize: s.decreaseSidebarFontSize,
      editorFontSize: s.editorFontSize,
      increaseEditorFontSize: s.increaseEditorFontSize,
      decreaseEditorFontSize: s.decreaseEditorFontSize,
      randomIconOnCreate: s.randomIconOnCreate,
      setRandomIconOnCreate: s.setRandomIconOnCreate,

      customActions: s.customActions,
      addCustomAction: s.addCustomAction,
      updateCustomAction: s.updateCustomAction,
      removeCustomAction: s.removeCustomAction,
      notebookDropdownHoverExpand: s.notebookDropdownHoverExpand,
      setNotebookDropdownHoverExpand: s.setNotebookDropdownHoverExpand,
      localFolderFileManager: s.localFolderFileManager,
      setLocalFolderFileManager: s.setLocalFolderFileManager,
      localFolderExternalEditor: s.localFolderExternalEditor,
      setLocalFolderExternalEditor: s.setLocalFolderExternalEditor,
      localFolderTerminal: s.localFolderTerminal,
      setLocalFolderTerminal: s.setLocalFolderTerminal,
      localFolderHiddenFolders: s.localFolderHiddenFolders,
      setLocalFolderHiddenFolders: s.setLocalFolderHiddenFolders,
    })),
  );
  const { notebooks } = useNotebooks(
    useShallow((s) => ({ notebooks: s.notebooks })),
  );
  const { pages } = usePages(useShallow((s) => ({ pages: s.pages })));
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: SettingsTab }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };

    window.addEventListener("goose-note:settings-tab-change", handleTabChange);
    return () => {
      window.removeEventListener(
        "goose-note:settings-tab-change",
        handleTabChange,
      );
    };
  }, []);

  // 数据管理状态
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportOptions["format"]>("md");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const {
    visible: appsBannerVisible,
    dismiss: dismissAppsBanner,
    reset: resetAppsBanner,
  } = usePersistentDismissState(SETTINGS_APPS_BANNER_ID);

  const notebookList = sortNotebooksByOrder(notebooks).filter(
    (n) => n.source !== "local-folder",
  );
  const { createNotebook } = useNotebooks(
    useShallow((s) => ({ createNotebook: s.createNotebook })),
  );
  const resetPhrase = "我已知晓风险";
  const canReset = resetInput.trim() === resetPhrase;

  const toggleNotebook = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === notebookList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notebookList.map((n) => n.id));
    }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) return;
    setExporting(true);
    try {
      const { exportNotebooks } = await import("@/lib/export");
      await exportNotebooks(
        {
          format,
          notebookIds: selectedIds,
        },
        notebooks,
        Object.values(pages),
      );
      toast.success("导出成功");
    } catch (err) {
      console.error("Export failed", err);
      toast.error("导出失败", {
        description: err instanceof Error ? err.message : "请稍后重试。",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,.mdzip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        let firstWorkspaceId: string | null = null;
        let firstPageId: string | null = null;
        let notebookCount = 0;
        let pageCount = 0;

        const { importNotebooksFromZip } = await import("@/lib/export");
        await importNotebooksFromZip(
          file,
          (name, icon, id) => {
            notebookCount++;
            const newId = createNotebook(name, icon || "BookOpen", true, id);
            if (!firstWorkspaceId) firstWorkspaceId = newId;
            return newId;
          },
          async (data, workspaceId, parentId, id) => {
            pageCount++;
            await recordPreOverwriteHistory(id);
            const pageId = usePages.getState().createPageRecord({
              ...data,
              id,
              workspaceId,
              parentId,
            });
            if (!firstPageId) firstPageId = pageId;
            return pageId;
          },
        );

        const { setActiveNotebook } = useNotebooks.getState();
        const { setActivePage } = usePages.getState();

        if (firstWorkspaceId) setActiveNotebook(firstWorkspaceId);
        if (firstPageId) {
          closeNotebookAiIfFullscreen();
          setActivePage(firstPageId);
        }

        toast.success("导入成功", {
          description: `已恢复 ${notebookCount} 个记事本，共 ${pageCount} 个页面`,
        });
      } catch (err) {
        console.error("Import failed", err);
        toast.error("导入失败", {
          description: "请确保文件是有效的导出 ZIP 包",
        });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  useEffect(() => {
    if (!resetDialogOpen) {
      setResetInput("");
    }
  }, [resetDialogOpen]);

  const clearCurrentContent = async (options?: {
    preserveLocalFolders?: boolean;
    preserveWorkspaceState?: boolean;
  }) => {
    const preserveLocalFolders = options?.preserveLocalFolders ?? false;
    const preserveWorkspaceState = options?.preserveWorkspaceState ?? false;
    const currentNotebooks = useNotebooks.getState().notebooks;
    const localNotebooks = preserveLocalFolders
      ? Object.fromEntries(
          Object.entries(currentNotebooks).filter(
            ([, notebook]) => notebook.source === "local-folder",
          ),
        )
      : {};
    const localNotebookIds = new Set(Object.keys(localNotebooks));
    const allLocalNotebookIds = Object.values(currentNotebooks)
      .filter((notebook) => notebook.source === "local-folder")
      .map((notebook) => notebook.id);
    const localPages = preserveLocalFolders
      ? Object.fromEntries(
          Object.entries(usePages.getState().pages).filter(([, page]) =>
            localNotebookIds.has(page.workspaceId),
          ),
        )
      : {};

    // 本地文件夹内容属于用户磁盘数据，先落盘但绝不删除磁盘文件或 .goose/history。
    await usePages.getState().flushPendingLocalSaves();
    dataStorage.removeItem("goose-note-notebooks");
    historyRepository.clearAll();
    if (preserveLocalFolders) {
      clearPersistedInternalPages();
    } else {
      clearPersistedPages();
      allLocalNotebookIds.forEach(removeLocalPageIdMap);
      allLocalNotebookIds.forEach(removeLocalFolderOrders);
      clearAllLocalMdSnapshots();
    }
    clearLegacyStorage();
    clearLocalPageMetadataCache();
    if (!preserveWorkspaceState) {
      useNotebookAiChats.getState().clearAllChats();
      useTabs.getState().clearAllTabs();
      window.localStorage.removeItem("goose-note-ai-panel-open");
    }
    useNotebooks.setState({
      notebooks: localNotebooks,
      activeNotebookId: null,
      lastActivePageByNotebook: {},
      localFolderLoadStates: {},
    });
    usePages.setState({
      pages: localPages,
      activePageId: null,
      pendingNavigatePageId: null,
      expandPageId: null,
      searchHighlightQuery: null,
      searchHighlightPageId: null,
      searchHighlightNonce: 0,
      handledSearchHighlightNonce: 0,
      hydrated: true,
      lastSavedAt: null,
      onboardingCompleted: false,
      dirtyLocalPageIds: {},
    });
  };

  const createDefaultNotebook = () => {
    const now = Date.now();
    const localNotebooks = Object.fromEntries(
      Object.entries(useNotebooks.getState().notebooks).filter(
        ([, notebook]) => notebook.source === "local-folder",
      ),
    );
    // Electron 仅本地文件夹模式：重置后不种回内置本，保持空态
    if (isElectronHost) {
      useNotebooks.setState({
        notebooks: localNotebooks,
        activeNotebookId: Object.keys(localNotebooks)[0] ?? null,
        lastActivePageByNotebook: {},
        localFolderLoadStates: {},
      });
      return;
    }
    useNotebooks.setState({
      notebooks: {
        ...localNotebooks,
        [DEFAULT_NOTEBOOK]: {
          id: DEFAULT_NOTEBOOK,
          name: "Note",
          icon: "BookOpen",
          createdAt: now,
          updatedAt: now,
        },
      },
      activeNotebookId: DEFAULT_NOTEBOOK,
      lastActivePageByNotebook: {},
      localFolderLoadStates: {},
    });
  };

  const importBackupIntoEmptyState = async (blob: Blob) => {
    let firstWorkspaceId: string | null = null;
    let firstPageId: string | null = null;
    const { importNotebooksFromZip } = await import("@/lib/export");
    await importNotebooksFromZip(
      blob,
      (name, icon, id) => {
        const newId = createNotebook(name, icon || "BookOpen", true, id);
        if (!firstWorkspaceId) firstWorkspaceId = newId;
        return newId;
      },
      (data, workspaceId, parentId, id) => {
        const pageId = usePages.getState().createPageRecord({
          ...data,
          id,
          workspaceId,
          parentId,
        });
        if (!firstPageId && workspaceId === firstWorkspaceId)
          firstPageId = pageId;
        return pageId;
      },
    );
    if (!firstWorkspaceId) {
      throw new Error("备份中没有可恢复的记事本");
    }
    useNotebooks.setState({ activeNotebookId: firstWorkspaceId });
    closeNotebookAiIfFullscreen();
    usePages.setState({ activePageId: firstPageId });
  };

  const createRollbackBackup = async (): Promise<Blob | null> => {
    const notebookState = useNotebooks.getState().notebooks;
    const notebookIds = Object.values(notebookState)
      .filter((notebook) => notebook.source !== "local-folder")
      .map((notebook) => notebook.id);
    if (notebookIds.length === 0) return null;
    const { generateExportZip } = await import("@/lib/export");
    return generateExportZip(
      { format: "md", notebookIds },
      notebookState,
      Object.values(usePages.getState().pages),
    );
  };

  const restoreBackupWithRollback = async (zipBlob: Blob) => {
    const { inspectNotebookImportZip } = await import("@/lib/export");
    await inspectNotebookImportZip(zipBlob);
    const rollbackBlob = await createRollbackBackup();

    await clearCurrentContent({
      preserveLocalFolders: true,
      preserveWorkspaceState: true,
    });
    try {
      await importBackupIntoEmptyState(zipBlob);
      useTabs.getState().reconcileTabs();
    } catch (error) {
      console.error("[restore] 导入失败，开始回滚", error);
      try {
        await clearCurrentContent({
          preserveLocalFolders: true,
          preserveWorkspaceState: true,
        });
        if (rollbackBlob) {
          await importBackupIntoEmptyState(rollbackBlob);
        } else {
          createDefaultNotebook();
        }
        useTabs.getState().reconcileTabs();
      } catch (rollbackError) {
        console.error("[restore] 回滚失败", rollbackError);
        throw new Error("恢复失败，且自动回滚未完成，请从本地导出备份恢复", {
          cause: rollbackError,
        });
      }
      throw new Error("恢复失败，已自动恢复覆盖前的数据", { cause: error });
    }
    toast.success("恢复并同步成功");
  };

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
    useSettings.getState().setCodeStyle("default");
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

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={onOpenChange}
        layout="fullscreen"
        hideClose
        contentClassName="!gap-0 bg-[hsl(var(--goose-shell-bg))]"
        bodyClassName="h-full min-h-0 overflow-hidden"
      >
        <SettingsScaffold
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => onOpenChange(false)}
          tabs={SETTINGS_TABS}
          feedbackBanner={null}
          appsBanner={
            appsBannerVisible && !isElectronHost ? (
              <div className="relative rounded-[10px] bg-[hsl(var(--goose-selected-bg)/0.62)] p-3">
                <button
                  type="button"
                  onClick={handleCloseAppsBanner}
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] hover:bg-[var(--goose-interactive-hover)]"
                  aria-label="关闭鹅的全家桶"
                >
                  <LucideIcons.X className="h-3 w-3" />
                </button>
                <p className="mb-2 pr-4 text-xs font-medium text-muted-foreground">
                  鹅的全家桶
                </p>
                <div className="space-y-1">
                  {GOOSE_APPS.map((app) => (
                    <Button
                      key={app.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenApp(app)}
                      className="h-auto w-full justify-start gap-2 rounded-[10px] px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                    >
                      <img
                        src={app.icon}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded-[4px] object-cover"
                      />
                      <span className="flex-1 truncate">{app.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  ))}
                </div>
              </div>
            ) : null
          }
        >
          {activeTab === "general" && (
            <div className="settings-groups">
              <SettingsGeneral
                searchProviders={searchProviders}
                toggleSearchProvider={toggleSearchProvider}
                reorderSearchProviders={reorderSearchProviders}
                addCustomSearchProvider={addCustomSearchProvider}
                updateCustomSearchProvider={updateCustomSearchProvider}
                removeCustomSearchProvider={removeCustomSearchProvider}
                autoOpenLastNote={privacy.autoOpenLastNote}
                setAutoOpenLastNote={setAutoOpenLastNote}
                showRecentInSearch={showRecentInSearch}
                setShowRecentInSearch={setShowRecentInSearch}
                notebookDropdownHoverExpand={notebookDropdownHoverExpand}
                setNotebookDropdownHoverExpand={setNotebookDropdownHoverExpand}
                customActions={customActions}
                addCustomAction={addCustomAction}
                updateCustomAction={updateCustomAction}
                removeCustomAction={removeCustomAction}
              />
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="settings-groups">
              <SettingsShortcuts
                closeTabShortcut={closeTabShortcut}
                setCloseTabShortcut={setCloseTabShortcut}
                searchPanelCloseShortcut={searchPanelCloseShortcut}
                setSearchPanelCloseShortcut={setSearchPanelCloseShortcut}
                appShortcuts={appShortcuts}
                setAppShortcut={setAppShortcut}
                resetAppShortcuts={resetAppShortcuts}
                singleTabMode={effectiveSingleTabMode(singleTabMode)}
              />
            </div>
          )}

          {activeTab === "local-folder" && (
            <div className="settings-groups">
              <SettingsLocalFolder
                localFolderFileManager={localFolderFileManager}
                setLocalFolderFileManager={setLocalFolderFileManager}
                localFolderExternalEditor={localFolderExternalEditor}
                setLocalFolderExternalEditor={setLocalFolderExternalEditor}
                localFolderTerminal={localFolderTerminal}
                setLocalFolderTerminal={setLocalFolderTerminal}
                localFolderHiddenFolders={localFolderHiddenFolders}
                setLocalFolderHiddenFolders={setLocalFolderHiddenFolders}
              />
            </div>
          )}

          {activeTab === "appearance" && (
            <SettingsAppearance
              theme={theme}
              setTheme={setTheme}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              codeStyle={codeStyle}
              setCodeStyle={setCodeStyle}
              customFonts={customFonts}
              setCustomLabel={setCustomLabel}
              setCustomFont={setCustomFont}
              uiFontSize={uiFontSize}
              setUIFontSize={setUIFontSize}
              sidebarFontSize={sidebarFontSize}
              increaseSidebarFontSize={increaseSidebarFontSize}
              decreaseSidebarFontSize={decreaseSidebarFontSize}
              editorFontSize={editorFontSize}
              increaseEditorFontSize={increaseEditorFontSize}
              decreaseEditorFontSize={decreaseEditorFontSize}
              randomIconOnCreate={randomIconOnCreate}
              setRandomIconOnCreate={setRandomIconOnCreate}
            />
          )}

          {activeTab === "ai" && (
            <div className="settings-groups">
              <SettingsAI
                ai={ai}
                enabled={ai.enabled}
                setEnabled={setAIEnabled}
                setReadGlobalPrompt={setAIReadGlobalPrompt}
                setReadLocalSkills={setAIReadLocalSkills}
                selectedModelId={ai.selectedModelId}
                setSelectedModelId={setAISelectedModelId}
                saveCustomConfig={saveAICustomConfig}
              />
            </div>
          )}

          {activeTab === "about" && (
            <div className="settings-groups">
              <SettingsAbout />
            </div>
          )}

          {activeTab === "data" && (
            <div className="settings-groups">
              <SettingsDataPanel
                importing={importing}
                onImport={handleImport}
                selectedIds={selectedIds}
                notebookList={notebookList}
                onToggleNotebook={toggleNotebook}
                onSelectAll={selectAll}
                format={format}
                onFormatChange={setFormat}
                exporting={exporting}
                onExport={handleExport}
                onOpenResetDialog={() => setResetDialogOpen(true)}
                onRestartGuide={() => {
                  onOpenChange(false);
                  useSettings.setState({ setupGuideOpen: true });
                }}
                onResetAndImport={handleReset}
              />
            </div>
          )}
        </SettingsScaffold>
      </DialogShell>

      <DialogShell
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        layout="fullscreen"
        contentClassName="bg-[hsl(var(--goose-shell-bg))]"
        bodyClassName="relative h-full overflow-y-auto p-6 animate-in fade-in duration-200"
      >
        <div className="relative mx-auto w-full max-w-md py-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-[14px] mb-4 bg-[var(--goose-color-danger-subtle-bg)]">
              <LucideIcons.AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              确认重置所有数据？
            </h1>
            <p className="text-muted-foreground">
              这将永久删除内部记事本、页面、历史、AI
              会话、标签和应用设置；不会删除本地文件夹中的磁盘文件
            </p>
          </div>

          <div className="bg-[var(--goose-color-danger-subtle-bg)] backdrop-blur-[1px] rounded-[14px] p-6 shadow-[0_12px_26px_rgba(15,23,42,0.1)] space-y-4">
            <div className="space-y-3">
              <div className="text-sm font-medium text-destructive select-none">
                请输入以下短语以确认重置：
                <span className="ml-1 select-text font-bold text-foreground">
                  {resetPhrase}
                </span>
              </div>
              <Input
                id="reset-all"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder={resetPhrase}
                className="h-12 text-base"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canReset && !resetting) {
                    void handleManualReset();
                  }
                }}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setResetDialogOpen(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={() => void handleManualReset()}
                disabled={!canReset || resetting}
                className="flex-1"
              >
                {resetting ? "正在重置…" : "确认重置"}
              </Button>
            </div>
          </div>
        </div>
      </DialogShell>
    </>
  );
}
