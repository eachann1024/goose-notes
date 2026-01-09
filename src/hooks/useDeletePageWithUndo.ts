import { toast } from "sonner";
import { usePages } from "@/stores/usePages";
import { getPageTitle } from "@/lib/page-title";
import { useNotebooks } from "@/stores/useNotebooks";

export function useDeletePageWithUndo() {
  const { deletePage, restorePage, setActivePage, pages } = usePages();

  const deletePageWithUndo = (pageId: string) => {
    const page = pages[pageId];
    if (!page) return;
    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    const isLocalFolder = notebook?.source === "local-folder";

    const pageTitle = getPageTitle(page) || "无标题";

    const deleted = deletePage(pageId);

    if (!deleted) return;

    if (isLocalFolder) {
      toast(`已删除「${pageTitle}」`, {
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
          restorePage(pageId);
          setActivePage(pageId);
        },
      },
    });
  };

  return { deletePageWithUndo };
}
