import { useEffect, useRef } from "react";
import { usePages } from "@/stores/usePages";
import {
  isDiskContentMatchingSnapshot,
  wasRecentlySelfWritten,
  updateSnapshotStat,
  isStatMatchingSnapshot,
  type LocalMdFileStat,
} from "@/lib/local-md-snapshot";
import { wasRecentlySelfMoved } from "@/stores/pages/actions/localFolder/move";
import { useSettings } from "@/stores/useSettings";
import { shouldIgnoreLocalRelativePath } from "@/lib/local-folder-scanner";
import { wasRecentlyInteracting } from "@/lib/editor-interaction-signal";
import {
  type UseLocalFolderWatchOptions,
  readDiskContent,
  statDisk,
  showConflictToast,
  conflictHandlers,
} from "./shared";

export function useLocalFileChangeEvents({
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
  return {
    notebook,
    activePageId,
    page,
    renameDebounceTimers,
    changeDebounceTimers,
  };
}
