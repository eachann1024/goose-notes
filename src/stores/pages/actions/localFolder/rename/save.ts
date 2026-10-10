import type { StoreSet, StoreGet } from "../../hydrate";
import { cloneLocalPageContent } from "../../pageCreate";
import { confirmRecoveredLocalSave } from "../../../folderSync";

export const saveDirtyLocalPageAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
): Promise<boolean> => {
  const page = get().pages[pageId];
  if (!page) return false;
  if (page.localReadState === "error") return false;

  // 先让编辑器把最新内容刷进 store。
  window.dispatchEvent(
    new CustomEvent("goose-note:flush-editor", {
      detail: { immediate: true, pageId },
    }),
  );

  const effectivePageId = pageId;

  const latest = get().pages[effectivePageId];
  if (!latest) return false;

  const ok = await get().saveLocalPageContent(
    effectivePageId,
    cloneLocalPageContent(latest.content),
  );
  if (ok) {
    confirmRecoveredLocalSave(effectivePageId);
    set((s) => ({
      dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [effectivePageId]: false },
    }));
  }
  return ok;
};
