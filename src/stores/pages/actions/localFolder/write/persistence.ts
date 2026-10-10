import { updateSnapshotStat } from "@/lib/local-md-snapshot";
import type { StoreSet, StoreGet } from "../../hydrate";
import type { JSONContent } from "@/types";
import { waitForGitSyncWrites } from "@/lib/git-sync-write-barrier";
import {
  acquireLocalPageFileOperation,
  flushPendingLocalSaveByPageIdInternal,
  flushAllPendingLocalSavesInternal,
} from "../../../folderSync";
import { saveLocalPageContentUnlocked } from "./save";
import { toast } from "@/components/ui/sonner";

export async function refreshSnapshotFingerprint(
  filePath: string,
): Promise<void> {
  const fs = window.gooseFs;
  if (!fs?.statAsync) return;
  try {
    const stat = await fs.statAsync(filePath);
    if (stat) updateSnapshotStat(filePath, stat);
  } catch {
    // stat 失败时保留内容快照，下次 watch 退回读全文
  }
}

export const saveLocalPageContentAction = async (
  set: StoreSet,
  get: StoreGet,
  pageId: string,
  content: JSONContent,
  options?: { force?: boolean },
): Promise<boolean> => {
  if (typeof window === "undefined" || !window.gooseFs) return false;
  const gooseFs = window.gooseFs;
  const syncPath = get().getLocalFilePath(pageId);
  if (syncPath) await waitForGitSyncWrites(syncPath);

  // 与文件重命名共用页面级串行锁；取得锁后再读取路径。
  const releaseFileOperation = await acquireLocalPageFileOperation(pageId);
  try {
    return await saveLocalPageContentUnlocked(
      set,
      get,
      gooseFs,
      pageId,
      content,
      options,
    );
  } catch (error) {
    toast.error("笔记尚未保存到磁盘", {
      description: "文件可能处于只读或被占用状态，请检查后重试，建议先保留当前窗口。",
    });
    throw error;
  } finally {
    releaseFileOperation();
  }
};

export const flushPendingLocalSaveByPageIdAction = async (
  _set: StoreSet,
  get: StoreGet,
  pageId: string,
) => {
  // saveLocalPageContent 成功时自行清 dirty；失败（含冲突）时不能强清
  await flushPendingLocalSaveByPageIdInternal(pageId, get);
};

export const flushPendingLocalSavesAction = async (
  _set: StoreSet,
  get: StoreGet,
) => {
  await flushAllPendingLocalSavesInternal(get);
};

export const isLocalPageDirtyAction = (
  get: StoreGet,
  pageId: string,
): boolean => {
  return Boolean(get().dirtyLocalPageIds[pageId]);
};
