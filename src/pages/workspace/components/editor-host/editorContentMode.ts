type HostPageIdentity =
  | {
      id?: string | null;
      localFilePath?: string | null;
      localUnsaved?: boolean | null;
    }
  | null
  | undefined;

export const QUICKNOTE_DRAFT_PAGE_ID = "__quicknote_draft__";

export function isQuickNoteEditorPage(page: HostPageIdentity): boolean {
  return page?.id === QUICKNOTE_DRAFT_PAGE_ID;
}

/** 旧宿主页面模型到通用 Editor Kit contentMode 的兼容映射。 */
export function shouldUseRawEditorContent(page: HostPageIdentity): boolean {
  return (
    Boolean(page?.localFilePath) ||
    Boolean(page?.localUnsaved) ||
    isQuickNoteEditorPage(page)
  );
}
