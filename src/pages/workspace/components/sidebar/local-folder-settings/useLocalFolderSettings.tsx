import { useEffect, useMemo, useRef, useState } from "react";
import {
  LOCAL_FOLDER_EDITOR_CANDIDATES,
  LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  LOCAL_FOLDER_TERMINAL_CANDIDATES,
  type LocalFolderOpenAppCandidate,
} from "@/lib/local-folder-open-apps";
import {
  getCachedAvailableOpenApps,
  shell,
} from "@/lib/electron-platform/shell";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { toast } from "@/components/ui/sonner";
import {
  type SettingsLocalFolderProps,
  getSystemDefaultLabels,
} from "./shared";

export function useLocalFolderSettings({
  visible = true,
  localFolderFileManager,
  setLocalFolderFileManager,
  localFolderExternalEditor,
  setLocalFolderExternalEditor,
  localFolderTerminal,
  setLocalFolderTerminal,
  localFolderHiddenFolders,
  setLocalFolderHiddenFolders,
}: SettingsLocalFolderProps) {
  const [fileManagerOptions, setFileManagerOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(
    () =>
      getCachedAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES) ?? [],
  );

  const [editorOptions, setEditorOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => getCachedAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES) ?? []);

  const [terminalOptions, setTerminalOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => getCachedAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES) ?? []);

  const systemDefaultLabels = useMemo(() => getSystemDefaultLabels(), []);

  const hiddenFoldersRefreshNonceRef = useRef(0);

  const openAssetMaintenance = async () => {
    try {
      if (!window.gooseDesktop?.assetMaintenance)
        throw new Error("仅桌面应用支持资源清理");
      await window.gooseDesktop.assetMaintenance.open();
    } catch (error) {
      toast.error("无法打开资源清理窗口", { description: String(error) });
    }
  };

  const handleHiddenFoldersChange = (folders: string[]) => {
    setLocalFolderHiddenFolders(folders);
    const refreshNonce = ++hiddenFoldersRefreshNonceRef.current;

    void (async () => {
      try {
        // 重扫会替换 workspace 页面集合；先把编辑器最新内容推进保存队列并等待本地写盘，
        // 避免用户刚编辑完就修改隐藏目录时丢失未落盘内容。
        window.dispatchEvent(
          new CustomEvent("goose-note:flush-editor", {
            detail: { immediate: true },
          }),
        );
        await usePages.getState().flushPendingLocalSaves();
        if (refreshNonce !== hiddenFoldersRefreshNonceRef.current) return;

        const pagesState = usePages.getState();
        const notebookState = useNotebooks.getState();
        const loadedWorkspaceIds = new Set(
          Object.values(pagesState.pages).map((page) => page.workspaceId),
        );
        Object.entries(notebookState.localFolderLoadStates).forEach(
          ([notebookId, state]) => {
            if (state.status === "ready") loadedWorkspaceIds.add(notebookId);
          },
        );
        if (notebookState.activeNotebookId) {
          loadedWorkspaceIds.add(notebookState.activeNotebookId);
        }

        let skippedDirtyNotebook = false;
        for (const notebookId of loadedWorkspaceIds) {
          const notebook = notebookState.notebooks[notebookId];
          if (notebook?.source !== "local-folder" || !notebook.localPath)
            continue;

          const currentPages = usePages.getState();
          const hasDirtyPage = Object.entries(
            currentPages.dirtyLocalPageIds,
          ).some(
            ([pageId, dirty]) =>
              dirty && currentPages.pages[pageId]?.workspaceId === notebookId,
          );
          if (hasDirtyPage) {
            skippedDirtyNotebook = true;
            continue;
          }

          await currentPages.loadLocalFolderPages(
            notebook.id,
            notebook.localPath,
          );
        }

        if (skippedDirtyNotebook) {
          toast.warning("部分本地文件夹仍有未保存内容，已暂缓刷新隐藏目录");
        }
      } catch (error) {
        console.error("[settings] 刷新本地文件夹隐藏目录失败", error);
        toast.error("刷新隐藏目录失败", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  };

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const applyAvailableApps = (
      fileManagers: LocalFolderOpenAppCandidate[],
      editors: LocalFolderOpenAppCandidate[],
      terminals: LocalFolderOpenAppCandidate[],
    ) => {
      setFileManagerOptions(fileManagers);
      setEditorOptions(editors);
      setTerminalOptions(terminals);
    };

    const cachedFileManagers = getCachedAvailableOpenApps(
      LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
    );
    const cachedEditors = getCachedAvailableOpenApps(
      LOCAL_FOLDER_EDITOR_CANDIDATES,
    );
    const cachedTerminals = getCachedAvailableOpenApps(
      LOCAL_FOLDER_TERMINAL_CANDIDATES,
    );

    if (cachedFileManagers && cachedEditors && cachedTerminals) {
      applyAvailableApps(cachedFileManagers, cachedEditors, cachedTerminals);
      return () => {
        cancelled = true;
      };
    }

    const loadAvailableApps = async () => {
      const [fileManagers, editors, terminals] = await Promise.all([
        shell.listAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES),
      ]);

      if (cancelled) return;
      applyAvailableApps(fileManagers, editors, terminals);
    };

    void loadAvailableApps();

    return () => {
      cancelled = true;
    };
  }, [visible]);
  return {
    visible,
    localFolderFileManager,
    setLocalFolderFileManager,
    localFolderExternalEditor,
    setLocalFolderExternalEditor,
    localFolderTerminal,
    setLocalFolderTerminal,
    localFolderHiddenFolders,
    setLocalFolderHiddenFolders,
    fileManagerOptions,
    setFileManagerOptions,
    editorOptions,
    setEditorOptions,
    terminalOptions,
    setTerminalOptions,
    systemDefaultLabels,
    hiddenFoldersRefreshNonceRef,
    openAssetMaintenance,
    handleHiddenFoldersChange,
  };
}
