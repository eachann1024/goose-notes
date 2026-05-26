import { useNotebooks } from "../../../useNotebooks";
import type { StoreSet, StoreGet } from "../hydrate";
import { flushEditorContent } from "../flushEditor";

export const setActivePageAction = async (
  set: StoreSet,
  get: StoreGet,
  id: string | null,
): Promise<void> => {
  const previousActivePageId = get().activePageId;
  flushEditorContent(true);
  if (previousActivePageId) {
    await get().flushPendingLocalSaveByPageId(previousActivePageId);
  }

  if (!id) {
    set({ activePageId: null });
    return;
  }

  // 本地文件夹的内容由 scanner 一次性加载，并保留内存中的任何脏改动；
  // 切换标签页时直接用 store 里的 page.content，不再重读原文件。
  // 重读会绕过 frontmatter/raw-guard 流水线，并覆盖用户未保存的编辑。
  set({ activePageId: id });

  const notebookId = useNotebooks.getState().activeNotebookId;
  if (notebookId) {
    useNotebooks.getState().setLastActivePage(notebookId, id);
  }
};
