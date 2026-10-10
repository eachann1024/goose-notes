import type { StoreSet, StoreGet } from "../hydrate";
import { ensureLocalFolderOrdersLoaded } from "@/stores/localFolderOrder";
import { useSettings } from "@/stores/useSettings";
import {
  localFolderLoadTasks,
  latestLocalFolderLoadRequest,
} from "./load/tasks";
import { loadLocalFolderPagesOnce } from "./load/scan";

let localFolderLoadRequestSequence = 0;

export const loadLocalFolderPagesAction = (
  set: StoreSet,
  get: StoreGet,
  notebookId: string,
  basePath: string,
  options?: { showWelcome?: boolean },
): Promise<void> => {
  if (typeof window === "undefined" || !window.gooseFs) {
    return Promise.resolve();
  }

  // 手动排序只存在内存 store 里，进该本地文件夹时读进来，树才能直接按手动顺序渲染
  ensureLocalFolderOrdersLoaded(notebookId);

  const hiddenFolders = [...useSettings.getState().localFolderHiddenFolders];
  const fingerprint = JSON.stringify({
    basePath,
    hiddenFolders,
    showWelcome: Boolean(options?.showWelcome),
  });
  const existing = localFolderLoadTasks.get(notebookId);
  if (existing?.fingerprint === fingerprint) return existing.promise;

  const requestId = ++localFolderLoadRequestSequence;
  latestLocalFolderLoadRequest.set(notebookId, requestId);
  const promise = loadLocalFolderPagesOnce(
    set,
    get,
    notebookId,
    basePath,
    options,
    hiddenFolders,
    requestId,
  ).finally(() => {
    const current = localFolderLoadTasks.get(notebookId);
    if (current?.requestId === requestId) {
      localFolderLoadTasks.delete(notebookId);
    }
  });

  localFolderLoadTasks.set(notebookId, {
    fingerprint,
    requestId,
    promise,
  });
  return promise;
};

export { reloadLocalPageFromDiskAction } from "./load/reload";
export {
  removeSingleLocalPageAction,
  addSingleLocalPageAction,
} from "./load/changes";
