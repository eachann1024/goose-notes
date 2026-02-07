import { toast } from "sonner";
import { usePages } from "@/stores/usePages";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";
import { UToolsAdapter } from "@/lib/utools";

export function useDeletePageWithUndo() {
  const { deletePage, restorePage, setActivePage, pages } = usePages();

  const deletePageWithUndo = async (pageId: string) => {
    const page = pages[pageId];
    if (!page) return;
    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    const isLocalFolder = notebook?.source === "local-folder";

    const pageTitle = getPageTitle(page) || "无标题";

    if (isLocalFolder && UToolsAdapter.isTauri) {
      toast("Tauri 首版暂不支持本地删除，请手动在系统文件夹中处理", {
        duration: 3000,
        position: "top-right",
      });
      return;
    }

    const deleted = await deletePage(pageId);

    if (!deleted) return;

    if (isLocalFolder) {
      toast(`已删除「${pageTitle}」，已移入系统回收站`, {
        duration: 3000,
        position: "top-right",
      });
      return;
    }

    toast(`已删除「${pageTitle}」`, {
      duration: 5000,
      position: "top-right",
      action: {
        label: "撤回",
        onClick: () => {
          restorePage(pageId);
          setActivePage(pageId);
        },
      },
    });
  };

  return { deletePageWithUndo };
}
