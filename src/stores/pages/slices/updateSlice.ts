import type { PagesState } from "../types";
import {
  normalizePageLayout,
  isLocalPageFrontmatterSettingsUpdate,
  getContentFrontmatterBody,
  mergeLocalPageSettingsIntoFrontmatter,
  applyFrontmatterBodyToContent,
} from "@/lib/local-frontmatter";
import {
  isLocalFolderPage,
  shouldPersistLocalPageMetaUpdate,
  persistPageSnapshot,
} from "../persistence";
import {
  recordRecoveryEntry,
  acknowledgeRecoveryEntry,
} from "@/lib/storage/recoveryJournal";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import { toast } from "@/components/ui/sonner";
import { useNotebooks } from "../../useNotebooks";
import { localPageHasPersistableContent } from "@/lib/unsavedLocalPage";
import { queueLocalPageSave } from "../folderSync";

export function createUpdatePageSlice(
  set: import("zustand").StoreApi<PagesState>["setState"],
  get: import("zustand").StoreApi<PagesState>["getState"],
): Pick<PagesState, "updatePage"> {
  return {
    updatePage: (id, updates, options) => {
      if ("pageLayout" in updates) {
        updates = {
          ...updates,
          pageLayout:
            updates.pageLayout === undefined
              ? undefined
              : normalizePageLayout(updates.pageLayout),
        };
      }
      const page = get().pages[id];
      const shouldPersistLocalMeta =
        isLocalFolderPage(page) && shouldPersistLocalPageMetaUpdate(updates);
      const silent = options?.silent === true;
      const isLocal = isLocalFolderPage(page);
      const isDurableContentEdit =
        Boolean(page) && "content" in updates && !silent;
      const recoveryEntry = isDurableContentEdit
        ? recordRecoveryEntry({
            source: isLocal ? "local-file" : "internal-page",
            id,
            content: updates.content ?? null,
            baseSignature: () => getContentSignature(page?.content ?? null),
            baseUpdatedAt: page?.updatedAt,
          })
        : null;
      if (isDurableContentEdit && !recoveryEntry) {
        toast.error("无法写入恢复备份", {
          id: "goose-recovery-journal-failed",
          description: "请先不要关闭窗口，并复制重要内容后重试。",
        });
      }
      const shouldMergeFrontmatterSettings =
        isLocal && !silent && isLocalPageFrontmatterSettingsUpdate(updates);
      // 仅改字体/锁定也要落盘；读失败页不写，避免覆盖坏文件
      const shouldQueueLocalSettingsSave =
        shouldMergeFrontmatterSettings && page?.localReadState !== "error";

      if (shouldMergeFrontmatterSettings && page?.localReadState === "error") {
        toast.error("页面读取失败，未更改设置");
        return;
      }
      let settingsRejected = false;
      set((state) => {
        const page = state.pages[id];
        if (!page) return state;
        const now = Date.now();

        let favoriteOrder = updates.favoriteOrder ?? page.favoriteOrder;
        if (
          updates.isFavorite === true &&
          !page.isFavorite &&
          favoriteOrder === undefined
        ) {
          const maxFavoriteOrder = Object.values(state.pages)
            .filter((p) => p.workspaceId === page.workspaceId && p.isFavorite)
            .reduce((max, p) => {
              const candidate = p.favoriteOrder ?? p.order ?? p.createdAt;
              return Math.max(max, candidate);
            }, -1);
          favoriteOrder = maxFavoriteOrder + 1;
        }

        let pinnedAt = updates.pinnedAt ?? page.pinnedAt;
        if (updates.isPinned === true) {
          pinnedAt = now;
        }
        if (updates.isPinned === false) {
          pinnedAt = undefined;
        }

        // 只有真正的内容编辑才刷新 updatedAt：必须显式传入 content 字段，
        // 且没有标记为 silent（silent 用于切页/normalize 这类被动同步）。
        const isContentEdit = "content" in updates && !silent;
        let updatedPage = {
          ...page,
          ...updates,
          ...(favoriteOrder !== undefined ? { favoriteOrder } : {}),
          pinnedAt,
          updatedAt: isContentEdit ? now : page.updatedAt,
        };

        // 本地页：字体/锁定/置顶/收藏 merge 进 frontmatter blob（解析失败保留原文，避免破坏手写 YAML）
        if (shouldMergeFrontmatterSettings) {
          // 以编辑器当前首块 YAML 为基准（用户可能在编辑器里改过 name/description），
          // 而不是用过期的 localFrontmatter 覆盖手写内容。
          const contentYamlBody = getContentFrontmatterBody(
            updatedPage.content,
          );
          const baseBlob =
            contentYamlBody !== null
              ? `---\n${contentYamlBody}\n---`
              : updatedPage.localFrontmatter;
          const mergeResult = mergeLocalPageSettingsIntoFrontmatter(baseBlob, {
            fontFamily: updatedPage.fontFamily ?? "default",
            pageLayout: updatedPage.pageLayout,
            isLocked: Boolean(updatedPage.isLocked),
            isPinned: Boolean(updatedPage.isPinned),
            isFavorite: Boolean(updatedPage.isFavorite),
          });
          if (!mergeResult.parseFailed) {
            const yamlBody = mergeResult.blob
              ? mergeResult.blob
                  .replace(/^---\r?\n/, "")
                  .replace(/\r?\n---$/, "")
              : null;
            updatedPage = {
              ...updatedPage,
              localFrontmatter: mergeResult.blob,
              // 仅用户属性同步进编辑器首块；只有收藏/置顶等 goose 键时去掉该块。
              content: applyFrontmatterBodyToContent(
                updatedPage.content,
                yamlBody,
              ),
            };
          } else {
            settingsRejected = true;
            return state;
          }
        }

        const shouldQueueContentSave =
          Boolean(updates.content) &&
          !silent &&
          useNotebooks.getState().notebooks[page.workspaceId]?.source ===
            "local-folder" &&
          page.localReadState !== "error" &&
          !(
            page.localUnsaved &&
            !localPageHasPersistableContent(updates.content)
          );

        // 内容编辑 或 仅改 frontmatter 设置：标脏并入防抖写盘队列
        if (shouldQueueContentSave || shouldQueueLocalSettingsSave) {
          // 本地文件夹与普通笔记本一致：编辑即自动保存。先标脏（短暂显示"保存中"），
          // 再入防抖队列落盘；写盘成功后由 saveLocalPageContent 清除脏标记。
          // 标题→文件名的 rename 仍由显式 Cmd/Ctrl+S（saveDirtyLocalPage）处理，
          // 避免输入标题过程中频繁重命名文件。
          // silent=true（切页/normalize 被动同步）时跳过标脏与队列，不触发写盘。
          const contentForSave = shouldQueueContentSave
            ? updates.content!
            : updatedPage.content;
          set((s) => ({
            dirtyLocalPageIds: { ...s.dirtyLocalPageIds, [id]: true },
          }));
          queueLocalPageSave(id, contentForSave, get, recoveryEntry?.revision);
        }

        return {
          pages: {
            ...state.pages,
            [id]: updatedPage,
          },
        };
      });

      if (settingsRejected) {
        toast.error("YAML 前置区格式异常，未更改设置", {
          description: "原文已保留，请先修复 YAML 后重试。",
        });
        return;
      }
      const updatedPage = get().pages[id];
      if (!updatedPage) return;

      if (isLocalFolderPage(updatedPage)) {
        if (shouldPersistLocalMeta && !updatedPage.localUnsaved) {
          persistPageSnapshot(updatedPage);
        }
        return;
      }

      const persisted = persistPageSnapshot(updatedPage);
      if (persisted && recoveryEntry) {
        acknowledgeRecoveryEntry("internal-page", id, recoveryEntry.revision);
      } else if (!persisted) {
        toast.error("内容暂未保存", {
          id: `goose-page-save-failed:${id}`,
          description: "最新内容已放入恢复备份，下次打开仍可找回。",
        });
      }
    },
  };
}
