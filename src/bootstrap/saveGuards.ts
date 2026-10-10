import { toast } from "@/components/ui/sonner";
import { describeDiskWriteError } from "@/lib/diskWriteError";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";

let flushInFlight: Promise<void> | null = null;

const flushAllPendingWrites = async () => {
  window.dispatchEvent(
    new CustomEvent("goose-note:flush-editor", {
      detail: { immediate: true },
    }),
  );
  await usePages.getState().flushPendingLocalSaves();
};

const runFlushOnce = () => {
  if (flushInFlight) return flushInFlight;
  flushInFlight = flushAllPendingWrites().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
};

const reportFlushFailure = (error: unknown) => {
  console.error("[save-guard] pending writes flush failed", error);
  toast.error("笔记未能保存到磁盘", {
    id: "goose-pending-writes-failed",
    description: describeDiskWriteError(error),
    action: {
      label: "重试",
      onClick: () => retryPendingWrites(),
    },
  });
};

const retryPendingWrites = () => {
  // 所有入口都复用 runFlushOnce：连续点击或生命周期事件只共享一个在途任务。
  void runFlushOnce()
    .then(() => {
      toast.dismiss("goose-pending-writes-failed");
    })
    .catch(reportFlushFailure);
};

const flushFromLifecycle = () => {
  void runFlushOnce().catch(reportFlushFailure);
};
export const setupSaveGuards = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const hostWindow = window as Window & {
    __gooseNoteSaveGuardInstalled?: boolean;
  };
  if (hostWindow.__gooseNoteSaveGuardInstalled) return;
  hostWindow.__gooseNoteSaveGuardInstalled = true;

  const handleManualSave = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.isComposing || event.keyCode === 229) return;
    if (!event.metaKey && !event.ctrlKey) return;
    if (event.altKey || event.shiftKey || event.repeat) return;
    if (event.key.toLowerCase() !== "s") return;

    const target = document.activeElement;
    const isEditableInput =
      target instanceof HTMLElement &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isEditableInput) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // 本地文件夹来源：显式调 saveDirtyLocalPage 写盘；其它来源沿用自动保存 flush。
    const pagesState = usePages.getState();
    const activePageId = pagesState.activePageId;
    const activePage = activePageId ? pagesState.pages[activePageId] : null;
    const isLocalFile =
      Boolean(activePage?.localFilePath) &&
      useNotebooks.getState().notebooks[activePage?.workspaceId ?? ""]
        ?.source === "local-folder";

    if (isLocalFile && activePageId) {
      if (activePage?.localReadState === "error") {
        toast.error("此文件无法解析，已禁用保存", { duration: 1800 });
        return;
      }
      // 内容已自动保存；显式保存会再确保落盘并应用「标题→文件名」重命名。
      void pagesState
        .saveDirtyLocalPage(activePageId)
        .then((ok) => {
          if (!ok) {
            reportFlushFailure(
              new Error(`manual save failed: ${activePageId}`),
            );
          }
        })
        .catch(reportFlushFailure);
      return;
    }

    void runFlushOnce().catch(reportFlushFailure);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flushFromLifecycle();
    }
  };

  const handleWindowBlur = () => {
    flushFromLifecycle();
  };

  const handlePageHide = () => {
    flushFromLifecycle();
  };

  const handleBeforeUnload = () => {
    flushFromLifecycle();
  };

  const handlePluginOut = () => {
    flushFromLifecycle();
  };

  document.addEventListener("keydown", handleManualSave, { capture: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("goose-note:plugin-out", handlePluginOut);
};
