import { useEffect } from "react";
import { sortNotebooksByOrder, useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { fs } from "@/lib/electron-platform/fs";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { restoreLastNoteIfNeeded, clearWorkspaceStartupSelection } from "@/lib/workspaceStartup";

export function usePluginEvents() {
  useEffect(() => {
    const api = getGooseDesktop();
    if (!api?.onOpenMarkdownFiles) return;

    const openFiles = (files: string[]) => {
      if (!Array.isArray(files) || files.length === 0) return;
      void import("@/lib/openAssociatedMarkdown").then(({ openAssociatedMarkdownFiles }) => {
        void openAssociatedMarkdownFiles(files);
      });
    };

    const unsubscribe = api.onOpenMarkdownFiles(openFiles);

    void (async () => {
      if (!api.takePendingOpenMarkdownFiles) return;
      try {
        const pending = await api.takePendingOpenMarkdownFiles();
        openFiles(pending);
      } catch (error) {
        console.error("[open-md] takePending 失败", error);
      }
    })();

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!fs.isAvailable()) return;
    const notebooksStore = useNotebooks.getState();
    const pagesStore = usePages.getState();
    const notebooks = sortNotebooksByOrder(notebooksStore.notebooks);
    void (async () => {
      for (const notebook of notebooks.filter((item) => item.source === "local-folder")) {
        const exists = Boolean(notebook.localPath) && await fs.existsAsync(notebook.localPath!);
        if (exists) {
          if (notebook.localPathMissing) notebooksStore.updateNotebook(notebook.id, { localPathMissing: false });
          await pagesStore.loadLocalFolderPages(notebook.id, notebook.localPath!);
        } else {
          if (!notebook.localPathMissing) notebooksStore.updateNotebook(notebook.id, { localPathMissing: true });
          pagesStore.removePagesByWorkspaceId(notebook.id);
        }
      }
      useTabs.getState().closeExpiredTabs();
    })();
  }, []);

  return { restoreLastNoteIfNeeded, clearActivePageForBlankEntry: clearWorkspaceStartupSelection };
}
