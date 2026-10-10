import type { StoreSet, StoreGet } from "../../hydrate";
import {
  listRecoveryEntries,
  acknowledgeRecoveryEntry,
  canApplyRecoveryEntry,
} from "@/lib/storage/recoveryJournal";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import { restorePendingLocalSave } from "../../../folderSync";
import { toast } from "@/components/ui/sonner";

export function recoverScannedLocalPages(
  set: StoreSet,
  get: StoreGet,
  notebookId: string,
) {
  let recoveredCount = 0;
  let conflictCount = 0;
  for (const entry of listRecoveryEntries("local-file")) {
    const current = get().pages[entry.id];
    if (!current || current.workspaceId !== notebookId || current.isFolder)
      continue;
    const currentSignature = getContentSignature(current.content);
    if (currentSignature === getContentSignature(entry.content)) {
      acknowledgeRecoveryEntry("local-file", entry.id, entry.revision);
      continue;
    }
    if (
      !canApplyRecoveryEntry(
        entry,
        current.content,
        undefined,
        currentSignature,
      )
    ) {
      conflictCount += 1;
      continue;
    }
    if (entry.content) {
      restorePendingLocalSave(entry.id, entry.content, entry.revision);
      set((state) => ({
        pages: {
          ...state.pages,
          [entry.id]: { ...state.pages[entry.id], content: entry.content! },
        },
        dirtyLocalPageIds: {
          ...state.dirtyLocalPageIds,
          [entry.id]: true,
        },
      }));
      recoveredCount += 1;
    }
  }
  if (recoveredCount > 0) {
    toast.warning(`已找回 ${recoveredCount} 篇未写盘的本地笔记`, {
      id: `goose-recovered-local-pages:${notebookId}`,
      description: "内容已恢复至编辑器，请确认内容后按快捷键保存。",
    });
  }
  if (conflictCount > 0) {
    toast.warning("检测到外部文件冲突", {
      id: `goose-local-recovery-conflicts:${notebookId}`,
      description: "恢复稿已独立保留，未直接覆盖磁盘上的较新版本。",
    });
  }
}
