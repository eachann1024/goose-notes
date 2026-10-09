import { toast } from "@/components/ui/sonner";
import { showDeleteReceipt } from "@/components/ui/delete-receipt";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";

/**
 * 页面删除/恢复的唯一入口。
 * 所有调用点（侧栏右键菜单、页面菜单、快捷键、垃圾箱视图）共用这三个函数，
 * toast 统一走全局 Toaster 的 top-right 位置。
 */

/** 恢复页面并弹统一的成功 toast；reopenTab 用于撤回删除后重新打开标签页 */
export function restorePageWithToast(
  pageId: string,
  opts: { reopenTab?: boolean } = {},
) {
  const result = usePages.getState().restorePage(pageId);
  if (!result.ok) return;

  if (opts.reopenTab) {
    closeNotebookAiIfFullscreen();
    const tabsStore = useTabs.getState();
    const existingTab = tabsStore.openTabs.find((tab) => tab.pageId === pageId);
    if (existingTab) {
      tabsStore.setActiveTab(existingTab.id);
    } else if (tabsStore.activeTabId) {
      tabsStore.openInCurrentTab(pageId);
    } else {
      tabsStore.openTab(pageId);
    }
  }

  const parentPath =
    result.parentTitles && result.parentTitles.length > 0
      ? result.parentTitles.join(" / ")
      : "顶层";
  const restoredChildrenCount = Math.max((result.restoredCount || 1) - 1, 0);
  const restoredChildrenText =
    restoredChildrenCount > 0 ? `，并恢复 ${restoredChildrenCount} 个子项` : "";

  toast.success(
    `已恢复${result.itemLabel || "页面"}「${result.pageTitle || "无标题"}」`,
    {
      description: `位置：${result.notebookName || "未命名笔记本"} / ${parentPath}${restoredChildrenText}`,
    },
  );
}

const permanentDeleteInFlight = new Set<string>();

/** 永久删除（垃圾箱条目/本地文件）：先给出可读确认，再统一反馈执行结果。 */
export function permanentlyDeletePageWithCleanup(pageId: string) {
  const page = usePages.getState().pages[pageId];
  if (!page || permanentDeleteInFlight.has(pageId)) return;
  const title = getPageTitle(page) || "无标题";
  const toastId = `permanent-delete:${pageId}`;

  toast.warning(`永久删除「${title}」？`, {
    id: toastId,
    duration: 8000,
    description: page.isFolder
      ? "该页面及其子页面会被永久删除，此操作无法撤回。"
      : "此操作无法撤回。",
    action: {
      label: "确认永久删除",
      onClick: (event) => {
        event.preventDefault();
        if (permanentDeleteInFlight.has(pageId)) return;
        permanentDeleteInFlight.add(pageId);
        toast.loading(`正在永久删除「${title}」…`, { id: toastId });
        void usePages
          .getState()
          .permanentlyDeletePage(pageId)
          .then(() => {
            if (usePages.getState().getPage(pageId)) {
              throw new Error("页面仍然存在");
            }
            useTabs.getState().removeDeletedPage(pageId);
            toast.success(`已永久删除「${title}」`, { id: toastId });
          })
          .catch((error) => {
            console.error("[page-delete] permanently delete failed", error);
            toast.error(`无法永久删除「${title}」`, {
              id: toastId,
              description: "请稍后重试。",
            });
          })
          .finally(() => {
            permanentDeleteInFlight.delete(pageId);
          });
      },
    },
  });
}

/** 删除页面：本地文件夹直接移入系统回收站（不弹确认），应用内页面进垃圾箱并支持撤回 */
export async function deletePageWithUndo(pageId: string) {
  const page = usePages.getState().pages[pageId];
  if (!page) return;
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  const isLocalFolder = notebook?.source === "local-folder";
  const pageTitle = getPageTitle(page) || "无标题";

  let deleted = false;
  let localTrashToken: string | undefined;
  try {
    deleted = await usePages.getState().deletePage(pageId, {
      onLocalTrash: (token) => { localTrashToken = token; },
    });
  } catch (error) {
    console.error("[page-delete] delete failed", error);
  }
  if (!deleted) {
    showDeleteReceipt([{ title: pageTitle, deleted: false }], isLocalFolder);
    return;
  }

  useTabs.getState().removeDeletedPage(pageId);

  showDeleteReceipt(
    [{ title: pageTitle, deleted: true }],
    isLocalFolder,
    isLocalFolder
      ? localTrashToken
        ? async () => {
            await undoLocalTrash(localTrashToken!, page.workspaceId);
            if (!page.isFolder && usePages.getState().getPage(pageId)) {
              closeNotebookAiIfFullscreen();
              useTabs.getState().openTab(pageId);
            }
            toast.success(`已恢复「${pageTitle}」`, {
              description: "系统回收站仍保留原文件副本。",
            });
          }
        : undefined
      : () => restorePageWithToast(pageId, { reopenTab: true }),
  );
}

/** Restore only the exact item backed up for this deletion; never guess by filename. */
export async function undoLocalTrash(token: string, notebookId: string) {
  if (!(await window.gooseFs?.undoTrash?.(token))) throw new Error("无法从回收站恢复文件");
  const notebook = useNotebooks.getState().notebooks[notebookId];
  if (notebook?.localPath) {
    try {
      await usePages.getState().loadLocalFolderPages(notebookId, notebook.localPath);
    } catch (error) {
      console.warn("[page-delete] restored file but could not refresh sidebar", error);
      toast.warning("文件已恢复，侧栏暂未刷新");
    }
  }
}
