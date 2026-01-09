import { toast } from "sonner";
import { usePages } from "@/stores/usePages";
import { getPageTitle } from "@/lib/page-title";

export function useDeletePageWithUndo() {
  const { deletePage, restorePage, setActivePage, pages } = usePages();

  const deletePageWithUndo = (pageId: string) => {
    const page = pages[pageId];
    if (!page) return;

    const pageTitle = getPageTitle(page) || "无标题";

    deletePage(pageId);

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
