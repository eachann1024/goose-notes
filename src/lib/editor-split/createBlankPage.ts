import { toast } from "@/components/ui/sonner";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";

/**
 * 分屏前创建同本空白页。
 * 内置笔记本走 createPage；本地文件夹优先 unsaved local page，
 * uTools 本地文件夹没有 unsaved 通道时回退 createLocalPage。
 */
export async function createSplitBlankPage(): Promise<string | null> {
  const notebooks = useNotebooks.getState();
  const workspaceId = notebooks.activeNotebookId;
  if (!workspaceId) {
    toast.error("无法创建分屏页面", {
      description: "当前没有打开的笔记本",
    });
    return null;
  }

  const notebook = notebooks.notebooks[workspaceId];
  const pages = usePages.getState();

  if (notebook?.source === "local-folder") {
    const unsavedId = pages.createUnsavedLocalPage(workspaceId);
    if (unsavedId) return unsavedId;
    const localId = await pages.createLocalPage(undefined, workspaceId);
    if (localId) return localId;
    toast.error("无法创建分屏页面");
    return null;
  }

  const pageId = pages.createPage(undefined, workspaceId);
  if (pageId) return pageId;
  toast.error("无法创建分屏页面");
  return null;
}
