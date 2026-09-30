import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { usePages } from "@/stores/usePages";
import {
  isDiskContentMatchingSnapshot,
  wasRecentlySelfWritten,
  updateSnapshotAfterWrite,
  updateSnapshotStat,
  isStatMatchingSnapshot,
  deleteLocalMdSnapshot,
  type LocalMdFileStat,
} from "@/lib/local-md-snapshot";
import { wasRecentlySelfMoved } from "@/stores/pages/actions/localFolder/move";
import { useSettings } from "@/stores/useSettings";
import { shouldIgnoreLocalRelativePath } from "@/lib/local-folder-scanner";
import {
  confirmRecoveredLocalSave,
  discardPendingLocalSave,
} from "@/stores/pages/folderSync";
import { wasRecentlyInteracting } from "@/lib/editor-interaction-signal";

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

async function readDiskContent(filePath: string): Promise<string | null> {
  const fs = window.gooseFs;
  if (!fs) return null;
  try {
    if (fs.readFileStatAsync) {
      const r = await fs.readFileStatAsync(filePath);
      return r.ok ? (r.content ?? "") : null;
    }
    if (fs.readFileStat) {
      const r = fs.readFileStat(filePath);
      return r.ok ? (r.content ?? "") : null;
    }
    if (fs.readFileAsync) return (await fs.readFileAsync(filePath)) ?? null;
    if (fs.readFile) return fs.readFile(filePath) ?? null;
  } catch {
    // 读失败按「无从判断」处理，调用方跳过本次检查
  }
  return null;
}

async function statDisk(filePath: string): Promise<LocalMdFileStat | null> {
  const fs = window.gooseFs;
  if (!fs?.statAsync) return null;
  try {
    return (await fs.statAsync(filePath)) ?? null;
  } catch {
    return null;
  }
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

/** 冲突 toast 两个按钮的标准行为（watch change / pre-save / 新鲜度检查共用）。 */
function conflictHandlers(filePath: string, pageId: string) {
  return {
    // 保留我的编辑：以磁盘当前内容为已知基线（内存编辑仍 dirty），再 force
    // 落盘覆盖。禁止把快照写成 ""——空快照会让之后任何磁盘内容都判成外部修改。
    // 读盘失败则 deleteLocalMdSnapshot：无快照时 isLocalMdUnchanged 为 false
    //（不会跳过写盘），isDiskContentMatchingSnapshot 为 true（不误报冲突）。
    onKeepMine: () => {
      void (async () => {
        try {
          const diskContent = await readDiskContent(filePath);
          if (diskContent !== null) {
            updateSnapshotAfterWrite(filePath, diskContent);
            try {
              const stat = await statDisk(filePath);
              if (stat) updateSnapshotStat(filePath, stat);
            } catch {
              // 指纹失败不影响强制落盘
            }
          } else {
            deleteLocalMdSnapshot(filePath);
          }
        } catch {
          deleteLocalMdSnapshot(filePath);
        }
        const pg = usePages.getState().pages[pageId];
        if (!pg) return;
        void usePages
          .getState()
          .saveLocalPageContent(pageId, pg.content as any, { force: true })
          .then((saved) => {
            if (saved) confirmRecoveredLocalSave(pageId);
          })
          .catch((error) => {
            console.error("[local-folder] conflict force-save failed", error);
          });
      })();
    },
    // 加载磁盘版本：丢弃本地编辑，重读磁盘
    onLoadDisk: () => {
      discardPendingLocalSave(pageId);
      usePages.setState((s) => ({
        dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [pageId]: false },
      }));
      void usePages.getState().reloadLocalPageFromDisk(pageId);
    },
  };
}

/**
 * 主动新鲜度检查：watch 不在场期间（Electron 窗口隐藏、查看其他笔记本、插件退出）
 * 的外部修改收不到 change 事件，在切页 / 窗口恢复可见时主动读盘 diff 兜底。
 * 没变 → 无操作；变了且页面干净且无近期交互 → 静默重载；变了且 dirty / 刚聚焦编辑器 → 冲突提示。
 */
async function checkLocalPageFreshness(pageId: string): Promise<void> {
  const page = usePages.getState().pages[pageId];
  const filePath = page?.localFilePath;
  if (!filePath) return;

  const diskContent = await readDiskContent(filePath);
  if (diskContent === null) return;
  if (isDiskContentMatchingSnapshot(filePath, diskContent)) return;

  const isDirty = Boolean(usePages.getState().dirtyLocalPageIds[pageId]);
  if (isDirty || wasRecentlyInteracting(2000)) {
    const { onKeepMine, onLoadDisk } = conflictHandlers(filePath, pageId);
    showConflictToast(filePath, pageId, onKeepMine, onLoadDisk);
    return;
  }
  void usePages.getState().reloadLocalPageFromDisk(pageId);
}

export function useLocalFolderWatch({
  notebook,
  activePageId,
  page,
}: UseLocalFolderWatchOptions) {
  // 增量 rename/delete 事件去抖：同一目录连发事件合并，300ms 内只触发一次
  const renameDebounceTimers = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  // change 事件 200ms trailing 去抖，避免同一文件连发读盘
  const changeDebounceTimers = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  // 监听文件变更事件
  useEffect(() => {
    const processChangeEvent = async (filePath: string) => {
      if (!notebook) return;
      const pages = usePages.getState().pages;
      const target = Object.values(pages).find(
        (p) =>
          p.workspaceId === notebook.id &&
          !p.isFolder &&
          (p.localFilePath === filePath ||
            p.localFilePath?.replace(/\\/g, "/") ===
              filePath.replace(/\\/g, "/")),
      );
      if (!target) return;

      const selfWrite = wasRecentlySelfWritten(filePath);
      let statMatch = false;
      const dirty = Boolean(usePages.getState().dirtyLocalPageIds[target.id]);

      const debugWatch = (contentMatch?: boolean) => {
        if (import.meta.env.DEV) {
          console.debug("[local-folder-watch]", {
            path: filePath,
            eventType: "change",
            selfWrite,
            statMatch,
            contentMatch,
            dirty,
          });
        }
      };

      // 自写回声：时间窗内直接忽略（主判据仍是内容/指纹 diff）。
      if (selfWrite) {
        debugWatch();
        return;
      }

      let diskStat: LocalMdFileStat | null;
      try {
        diskStat = await statDisk(filePath);
      } catch {
        diskStat = null;
      }
      if (diskStat && isStatMatchingSnapshot(filePath, diskStat)) {
        statMatch = true;
        debugWatch();
        return;
      }

      const diskContent = await readDiskContent(filePath);
      if (diskContent === null) {
        debugWatch();
        return;
      }
      const contentMatch = isDiskContentMatchingSnapshot(filePath, diskContent);
      if (contentMatch) {
        if (diskStat) {
          updateSnapshotStat(filePath, diskStat);
        } else {
          try {
            const lateStat = await statDisk(filePath);
            if (lateStat) updateSnapshotStat(filePath, lateStat);
          } catch {
            // 指纹刷新失败不影响「内容未变」结论
          }
        }
        debugWatch(contentMatch);
        return;
      }

      debugWatch(contentMatch);
      const isDirty = Boolean(usePages.getState().dirtyLocalPageIds[target.id]);
      if (isDirty || wasRecentlyInteracting(2000)) {
        const { onKeepMine, onLoadDisk } = conflictHandlers(
          filePath,
          target.id,
        );
        showConflictToast(filePath, target.id, onKeepMine, onLoadDisk);
        return;
      }

      void usePages.getState().reloadLocalPageFromDisk(target.id);
    };

    const handleFileChange = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { eventType, filename, dirPath } = customEvent.detail;
      if (
        notebook?.source !== "local-folder" ||
        notebook.localPath !== dirPath
      ) {
        return;
      }

      // 与全量扫描共用忽略规则：dot / 内置忽略目录 / 用户隐藏目录都不进入增量链路。
      if (
        typeof filename === "string" &&
        shouldIgnoreLocalRelativePath(
          filename,
          useSettings.getState().localFolderHiddenFolders,
        )
      ) {
        return;
      }

      const gooseFs = window.gooseFs;
      if (!gooseFs) return;
      const filePath = `${dirPath}/${filename}`;

      // ── change 事件：单文件 reload ────────────────────────────────────────
      if (eventType === "change") {
        const existing = changeDebounceTimers.current.get(filePath);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          changeDebounceTimers.current.delete(filePath);
          void processChangeEvent(filePath);
        }, 200);
        changeDebounceTimers.current.set(filePath, timer);
        return;
      }

      // ── rename/delete 事件：增量处理，300ms 去抖合并连发 ─────────────────
      if (eventType === "rename") {
        const debounceKey = filePath;
        const existing = renameDebounceTimers.current.get(debounceKey);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
          renameDebounceTimers.current.delete(debounceKey);

          // macOS 的 fs.watch 可能把普通 writeFile 报成 rename。应用自身保存产生的
          // 这类回声不能按“文件重新出现”处理，否则 addSingleLocalPage 会替换当前页，
          // 让编辑器选区和滚动视角一起回到文首。
          if (
            wasRecentlySelfMoved(filePath) ||
            wasRecentlySelfWritten(filePath)
          ) {
            return;
          }

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
                  .loadLocalFolderPages(notebook.id, notebook.localPath)
                  .catch((error) => {
                    console.error("[local-folder] rescan failed", error);
                  });
              }
            }
          } else {
            // 文件出现（新建 / rename 到此名）
            const isMdFile = /\.(md|markdown)$/i.test(filePath);
            if (isMdFile && notebook.id && notebook.localPath) {
              // 延迟到达的自写 rename 事件可能已经超过时间窗。若该路径本来就在
              // store 中，且磁盘内容仍与写后快照一致，则它只是保存回声，不应重载。
              const existingPage = Object.values(
                usePages.getState().pages,
              ).find(
                (candidate) =>
                  candidate.workspaceId === notebook.id &&
                  !candidate.isFolder &&
                  candidate.localFilePath?.replace(/\\/g, "/") ===
                    filePath.replace(/\\/g, "/"),
              );
              if (existingPage) {
                const diskContent = await readDiskContent(filePath);
                if (
                  diskContent !== null &&
                  isDiskContentMatchingSnapshot(filePath, diskContent)
                ) {
                  return;
                }
              }
              void usePages
                .getState()
                .addSingleLocalPage(notebook.id, notebook.localPath, filePath);
            } else if (!isMdFile) {
              // 非 md 文件（可能是目录）：全量重扫兜底
              if (notebook.id && notebook.localPath) {
                void usePages
                  .getState()
                  .loadLocalFolderPages(notebook.id, notebook.localPath)
                  .catch((error) => {
                    console.error("[local-folder] rescan failed", error);
                  });
              }
            }
          }
        }, 300);

        renameDebounceTimers.current.set(debounceKey, timer);
      }
    };

    window.addEventListener("goose-note:file-changed", handleFileChange);
    const changeTimers = changeDebounceTimers.current;
    return () => {
      window.removeEventListener("goose-note:file-changed", handleFileChange);
      changeTimers.forEach((timer) => clearTimeout(timer));
      changeTimers.clear();
    };
  }, [notebook, activePageId, page]);

  // ── 监听写盘前冲突（pre-save conflict）─────────────────────────────────────
  useEffect(() => {
    const handlePreSaveConflict = (event: Event) => {
      const { pageId, filePath } = (event as CustomEvent).detail as {
        pageId: string;
        filePath: string;
      };

      const { onKeepMine, onLoadDisk } = conflictHandlers(filePath, pageId);
      showConflictToast(filePath, pageId, onKeepMine, onLoadDisk);
    };

    window.addEventListener(
      "goose-note:local-file-conflict",
      handlePreSaveConflict,
    );
    return () => {
      window.removeEventListener(
        "goose-note:local-file-conflict",
        handlePreSaveConflict,
      );
    };
  }, []);

  // ── 监听本地路径重复：状态异常时拒绝写盘，避免两个页面覆盖同一磁盘文件 ───────
  useEffect(() => {
    const handleDuplicateLocalFile = (event: Event) => {
      const { filePath } = (event as CustomEvent).detail as {
        pageId: string;
        duplicatePageId: string;
        filePath: string;
      };
      const fileName = filePath.replace(/^.*[\\/]/, "");
      toast.error(`「${fileName}」保存失败`, {
        description:
          "检测到另一个页面已指向同一个本地文件，请重新加载本地文件夹后再试。",
      });
    };

    window.addEventListener(
      "goose-note:local-file-duplicate",
      handleDuplicateLocalFile,
    );
    return () => {
      window.removeEventListener(
        "goose-note:local-file-duplicate",
        handleDuplicateLocalFile,
      );
    };
  }, []);

  // ── 主动新鲜度检查：切页 / 切笔记本时 ──────────────────────────────────────
  // watch 只覆盖「当前笔记本目录 + 窗口存活」期间的外部修改；切页时主动 diff
  // 一次磁盘，把 watch 不在场期间的外部改动无感同步进来。
  useEffect(() => {
    if (notebook?.source !== "local-folder" || !activePageId) return;
    void checkLocalPageFreshness(activePageId);
  }, [activePageId, notebook?.id, notebook?.source]);

  // ── 主动新鲜度检查：Electron 窗口重新可见 / 聚焦时 ───────────────────────────
  useEffect(() => {
    if (notebook?.source !== "local-folder") return;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      const pid = usePages.getState().activePageId;
      if (pid) void checkLocalPageFreshness(pid);
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [notebook?.id, notebook?.source]);

  // ── 启动/停止目录 watcher ─────────────────────────────────────────────────
  useEffect(() => {
    const gfs = window.gooseFs;
    const renameTimers = renameDebounceTimers.current;
    const changeTimers = changeDebounceTimers.current;
    if (notebook?.source === "local-folder" && notebook.localPath && gfs) {
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
      renameTimers.forEach((timer) => clearTimeout(timer));
      renameTimers.clear();
      changeTimers.forEach((timer) => clearTimeout(timer));
      changeTimers.clear();

      if (notebook?.localPath && window.gooseFs) {
        try {
          window.gooseFs.unwatch(notebook.localPath!);
        } catch {
          // ignore
        }
      }
    };
  }, [notebook?.id]);
}
