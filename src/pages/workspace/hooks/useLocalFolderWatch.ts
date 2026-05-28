import { useEffect } from "react";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";

interface GooseFs {
  existsAsync?: (path: string) => Promise<boolean>;
  exists: (path: string) => boolean;
  watch: (path: string, callback: (eventType: string, filename: string) => void) => void;
  unwatch: (path: string) => void;
}

interface Notebook {
  id: string;
  source?: string;
  localPath?: string;
}

interface Page {
  localFilePath?: string;
}

interface UseLocalFolderWatchOptions {
  notebook: Notebook | undefined;
  activePageId: string | null | undefined;
  page: Page | undefined;
}

export function useLocalFolderWatch({
  notebook,
  activePageId,
  page,
}: UseLocalFolderWatchOptions) {
  // Listen for file change events
  useEffect(() => {
    const handleFileChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { eventType, filename, dirPath } = customEvent.detail;
      if (
        notebook?.source === "local-folder" &&
        notebook.localPath === dirPath
      ) {
        const gooseFs = (window as any).gooseFs as GooseFs | undefined;
        if (!gooseFs) return;
        const filePath = `${dirPath}/${filename}`;

        if (eventType === "change") {
          // 外部进程修改了文件内容 → 重新读入对应页面（脏页会被 reload 内部跳过）。
          // 自身写入已由 preload 的 recentWrites 抑制，不会走到这里。
          const pages = usePages.getState().pages;
          const target = Object.values(pages).find(
            (p) =>
              p.workspaceId === notebook.id &&
              !p.isFolder &&
              (p.localFilePath === filePath ||
                p.localFilePath?.replace(/\\/g, "/") ===
                  filePath.replace(/\\/g, "/")),
          );
          if (target) {
            void usePages.getState().reloadLocalPageFromDisk(target.id);
          }
          return;
        }

        if (eventType === "rename") {
          void (async () => {
            const exists = gooseFs.existsAsync
              ? await gooseFs.existsAsync(filePath)
              : gooseFs.exists(filePath);

            if (!exists) {
              if (activePageId && page?.localFilePath) {
                const isCurrentFile = page.localFilePath === filePath;
                const isParentDir =
                  page.localFilePath.startsWith(
                    filePath +
                      (filePath.endsWith("/") || filePath.endsWith("\\")
                        ? ""
                        : "/"),
                  ) || page.localFilePath.startsWith(filePath + "\\");

                if (isCurrentFile || isParentDir) {
                  const currentTabId = useTabs.getState().activeTabId;
                  if (currentTabId) {
                    useTabs.getState().closeTab(currentTabId);
                  } else {
                    usePages.getState().setActivePage(null);
                  }
                }
              }
              if (notebook.id && notebook.localPath) {
                usePages
                  .getState()
                  .loadLocalFolderPages(notebook.id, notebook.localPath);
              }
            }
          })();
        }
      }
    };

    window.addEventListener("goose-note:file-changed", handleFileChange);
    return () => {
      window.removeEventListener("goose-note:file-changed", handleFileChange);
    };
  }, [notebook, activePageId, page]);

  // Start/stop local folder watcher
  useEffect(() => {
    const gfs = (window as any).gooseFs as GooseFs | undefined;
    if (
      notebook?.source === "local-folder" &&
      notebook.localPath &&
      gfs
    ) {
      // 先检查目录是否存在，避免 ENOENT
      const dirExists = gfs.exists(notebook.localPath);
      if (dirExists) {
        try {
          gfs.watch(
            notebook.localPath,
            (_eventType: string, _filename: string) => {
              // Handled via the goose-note:file-changed event above
            },
          );
        } catch {
          // 目录不存在或无权访问，忽略
        }
      }
    }

    return () => {
      if (notebook?.localPath && (window as any).gooseFs) {
        try {
          ((window as any).gooseFs as GooseFs).unwatch(notebook.localPath!);
        } catch {
          // ignore
        }
      }
    };
  }, [notebook?.id]);
}
