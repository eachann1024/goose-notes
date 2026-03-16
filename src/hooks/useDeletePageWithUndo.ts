import { toast } from "sonner";
import { usePages } from "@/stores/usePages";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";

export function useDeletePageWithUndo() {
  const { deletePage, restorePage, pages } = usePages();

  const deletePageWithUndo = async (pageId: string) => {
    const page = pages[pageId];
    if (!page) return;
    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    const isLocalFolder = notebook?.source === "local-folder";

    const pageTitle = getPageTitle(page) || "无标题";

    const deleted = await deletePage(pageId);

    if (!deleted) return;

    useTabs
      .getState()
      .removeDeletedPage(pageId);

    if (isLocalFolder) {
      toast(`已删除「${pageTitle}」，已移入系统回收站`, {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    toast(`已删除「${pageTitle}」`, {
      duration: 5000,
      position: "bottom-right",
      action: {
        label: "撤回",
        onClick: () => {
          const result = restorePage(pageId);
          if (!result.ok) return;

          const tabsStore = useTabs.getState();
          const existingTab = tabsStore.openTabs.find((tab) => tab.pageId === pageId);
          if (existingTab) {
            tabsStore.setActiveTab(existingTab.id);
          } else if (tabsStore.activeTabId) {
            tabsStore.openInCurrentTab(pageId);
          } else {
            tabsStore.openTab(pageId);
          }

          const parentPath =
            result.parentTitles && result.parentTitles.length > 0
              ? result.parentTitles.join(" / ")
              : "顶层";
          const restoredChildrenCount = Math.max((result.restoredCount || 1) - 1, 0);
          const restoredChildrenText =
            restoredChildrenCount > 0
              ? `，并恢复 ${restoredChildrenCount} 个子项`
              : "";

          toast.success(
            `已恢复${result.itemLabel || "页面"}「${result.pageTitle || "无标题"}」`,
            {
              description: `位置：${result.notebookName || "未命名记事本"} / ${parentPath}${restoredChildrenText}`,
            },
          );
        },
      },
    });
  };

  return { deletePageWithUndo };
}
