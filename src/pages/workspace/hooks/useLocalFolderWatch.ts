import { useEffect, useRef } from "react";
import { toast } from "sonner";
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

/**
 * 同一文件冲突 toast 去重：记录当前正在显示的冲突 toast id（key = filePath）。
 * toast 关闭后自动清除，确保同文件不叠弹。
 */
const activeConflictToasts = new Map<string, string | number>();

function showConflictToast(
  filePath: string,
  pageId: string,
  onKeepMine: () => void,
  onLoadDisk: () => void,
) {
  // 去重：同文件已有 toast 则不重复弹
  if (activeConflictToasts.has(filePath)) return;

  const fileName = filePath.replace(/^.*[\\/]/, "");
  const toastId = toast.warning(`「${fileName}」已被外部修改`, {
    description: "选择如何处理冲突",
    duration: Infinity,
    action: {
      label: "保留我的编辑",
      onClick: (_e) => {
        activeConflictToasts.delete(filePath);
        onKeepMine();
      },
    },
    cancel: {
      label: "加载磁盘版本",
      onClick: (_e) => {
        activeConflictToasts.delete(filePath);
        onLoadDisk();
      },
    },
    onDismiss: () => {
      activeConflictToasts.delete(filePath);
    },
    onAutoClose: () => {
      activeConflictToasts.delete(filePath);
    },
  });

  activeConflictToasts.set(filePath, toastId);
}

export function useLocalFolderWatch({
  notebook,
  activePageId,
  page,
}: UseLocalFolderWatchOptions) {
  // 增量 rename/delete 事件去抖：同一目录连发事件合并，300ms 内只触发一次
  const renameDebounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 监听文件变更事件
  useEffect(() => {
    const handleFileChange = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { eventType, filename, dirPath } = customEvent.detail;
      if (
        notebook?.source !== "local-folder" ||
        notebook.localPath !== dirPath
      ) {
        return;
      }

      const gooseFs = (window as any).gooseFs as GooseFs | undefined;
      if (!gooseFs) return;
      const filePath = `${dirPath}/${filename}`;

      // ── change 事件：单文件 reload ────────────────────────────────────────
      if (eventType === "change") {
        const pages = usePages.getState().pages;
        const target = Object.values(pages).find(
          (p) =>
            p.workspaceId === notebook.id &&
            !p.isFolder &&
            (p.localFilePath === filePath ||
              p.localFilePath?.replace(/\\/g, "/") === filePath.replace(/\\/g, "/")),
        );
        if (!target) return;

        const isDirty = usePages.getState().dirtyLocalPageIds[target.id];
        if (isDirty) {
          // 脏页：不 reload，弹冲突 toast（原来是静默跳过）
          const pageId = target.id;
          showConflictToast(
            filePath,
            pageId,
            // 保留我的编辑：强制写盘（清 dirty + 触发保存）
            () => {
              void usePages.getState().saveDirtyLocalPage(pageId);
            },
            // 加载磁盘版本：丢弃编辑，reload
            () => {
              // 先清 dirty 标记，再 reload
              usePages.setState((s) => ({
                dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
              }));
              void usePages.getState().reloadLocalPageFromDisk(pageId);
            },
          );
          return;
        }

        void usePages.getState().reloadLocalPageFromDisk(target.id);
        return;
      }

      // ── rename/delete 事件：增量处理，300ms 去抖合并连发 ─────────────────
      if (eventType === "rename") {
        const debounceKey = filePath;
        const existing = renameDebounceTimers.current.get(debounceKey);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
          renameDebounceTimers.current.delete(debounceKey);

          const exists = gooseFs.existsAsync
            ? await gooseFs.existsAsync(filePath)
            : gooseFs.exists(filePath);

          if (!exists) {
            // 文件/目录消失 → 单页移除（md 文件）或全量重扫（目录变化兜底）
            const isMdFile = /\.(md|markdown)$/i.test(filePath);
            if (isMdFile) {
              // 单文件 md 消失：增量移除
              usePages.getState().removeSingleLocalPage(filePath);
            } else {
              // 目录变化或非 md 文件：全量重扫兜底
              if (notebook.id && notebook.localPath) {
                void usePages
                  .getState()
                  .loadLocalFolderPages(notebook.id, notebook.localPath);
              }
            }
          } else {
            // 文件出现（新建 / rename 到此名）
            const isMdFile = /\.(md|markdown)$/i.test(filePath);
            if (isMdFile && notebook.id && notebook.localPath) {
              void usePages
                .getState()
                .addSingleLocalPage(notebook.id, notebook.localPath, filePath);
            } else if (!isMdFile) {
              // 非 md 文件（可能是目录）：全量重扫兜底
              if (notebook.id && notebook.localPath) {
                void usePages
                  .getState()
                  .loadLocalFolderPages(notebook.id, notebook.localPath);
              }
            }
          }
        }, 300);

        renameDebounceTimers.current.set(debounceKey, timer);
      }
    };

    window.addEventListener("goose-note:file-changed", handleFileChange);
    return () => {
      window.removeEventListener("goose-note:file-changed", handleFileChange);
    };
  }, [notebook, activePageId, page]);

  // ── 监听写盘前冲突（pre-save conflict）─────────────────────────────────────
  useEffect(() => {
    const handlePreSaveConflict = (event: Event) => {
      const { pageId, filePath } = (event as CustomEvent).detail as {
        pageId: string;
        filePath: string;
      };

      showConflictToast(
        filePath,
        pageId,
        // 保留我的编辑：强制写盘（忽略磁盘差异，直接写入并更新快照）
        () => {
          void (async () => {
            const { updateSnapshotAfterWrite } = await import("@/lib/local-md-snapshot");
            const pages = usePages.getState().pages;
            const pg = pages[pageId];
            if (!pg) return;
            // 重置快照为当前磁盘内容（读磁盘），再触发保存——这样 isLocalMdUnchanged 不会拦截
            // 实际上更简单：直接清 snapshot 以让写盘放行，保存完再更新
            updateSnapshotAfterWrite(filePath, ""); // 清空快照使 isLocalMdUnchanged 返回 false
            void usePages.getState().saveDirtyLocalPage(pageId);
          })();
        },
        // 加载磁盘版本：丢弃编辑，reload
        () => {
          usePages.setState((s) => ({
            dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
          }));
          void usePages.getState().reloadLocalPageFromDisk(pageId);
        },
      );
    };

    window.addEventListener("goose-note:local-file-conflict", handlePreSaveConflict);
    return () => {
      window.removeEventListener("goose-note:local-file-conflict", handlePreSaveConflict);
    };
  }, []);

  // ── 启动/停止目录 watcher ─────────────────────────────────────────────────
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
      // 清理去抖计时器
      renameDebounceTimers.current.forEach((timer) => clearTimeout(timer));
      renameDebounceTimers.current.clear();

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
