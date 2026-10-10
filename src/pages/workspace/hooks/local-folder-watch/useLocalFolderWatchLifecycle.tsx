import { useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import { usePages } from "@/stores/usePages";
import {
  showConflictToast,
  conflictHandlers,
  checkLocalPageFreshness,
} from "./shared";
import type { useLocalFileChangeEvents } from "./useLocalFileChangeEvents";

export function useLocalFolderWatchLifecycle(
  input: ReturnType<typeof useLocalFileChangeEvents>,
) {
  const { notebook, activePageId, renameDebounceTimers, changeDebounceTimers } =
    input;

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
  return { ...input };
}
