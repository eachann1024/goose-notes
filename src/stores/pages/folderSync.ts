import type { JSONContent } from "@/types";
import type { PagesState } from "./types";
import { LOCAL_SAVE_DEBOUNCE_MS, LOCAL_SAVE_MAX_WAIT_MS } from "./types";

export const localSaveDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
export const localSaveMaxWaitTimers = new Map<string, ReturnType<typeof setTimeout>>();
export const pendingLocalSaveContents = new Map<string, JSONContent>();
export const localSaveWriteChains = new Map<string, Promise<void>>();

export const cloneJSONContent = (content: JSONContent): JSONContent => {
  try {
    return structuredClone(content) as JSONContent;
  } catch {
    return JSON.parse(JSON.stringify(content)) as JSONContent;
  }
};

export const clearLocalSaveTimers = (pageId: string) => {
  const debounceTimer = localSaveDebounceTimers.get(pageId);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    localSaveDebounceTimers.delete(pageId);
  }

  const maxWaitTimer = localSaveMaxWaitTimers.get(pageId);
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
    localSaveMaxWaitTimers.delete(pageId);
  }
};

export const flushPendingLocalSaveByPageIdInternal = (
  pageId: string,
  getState: () => PagesState,
) => {
  clearLocalSaveTimers(pageId);
  const chain = localSaveWriteChains.get(pageId) ?? Promise.resolve();
  const next = chain
    .catch(() => {})
    .then(async () => {
      while (pendingLocalSaveContents.has(pageId)) {
        const latestContent = pendingLocalSaveContents.get(pageId);
        if (!latestContent) {
          pendingLocalSaveContents.delete(pageId);
          continue;
        }
        pendingLocalSaveContents.delete(pageId);
        try {
          await getState().saveLocalPageContent(pageId, cloneJSONContent(latestContent));
        } catch (err) {
          // save 失败：把内容重新放回 pending，下次 flush 可重试
          if (!pendingLocalSaveContents.has(pageId)) {
            pendingLocalSaveContents.set(pageId, latestContent);
          }
          throw err;
        }
      }
    });

  const finalized = next.finally(() => {
    if (localSaveWriteChains.get(pageId) === finalized) {
      localSaveWriteChains.delete(pageId);
    }
  });

  localSaveWriteChains.set(pageId, finalized);
  return finalized;
};

export const queueLocalPageSave = (
  pageId: string,
  content: JSONContent,
  getState: () => PagesState,
) => {
  pendingLocalSaveContents.set(pageId, content);

  const existingDebounceTimer = localSaveDebounceTimers.get(pageId);
  if (existingDebounceTimer) {
    clearTimeout(existingDebounceTimer);
  }

  const debounceTimer = setTimeout(() => {
    void flushPendingLocalSaveByPageIdInternal(pageId, getState);
  }, LOCAL_SAVE_DEBOUNCE_MS);
  localSaveDebounceTimers.set(pageId, debounceTimer);

  if (!localSaveMaxWaitTimers.has(pageId)) {
    const maxWaitTimer = setTimeout(() => {
      void flushPendingLocalSaveByPageIdInternal(pageId, getState);
    }, LOCAL_SAVE_MAX_WAIT_MS);
    localSaveMaxWaitTimers.set(pageId, maxWaitTimer);
  }
};

/**
 * 页面 id 重建（文件 rename）时迁移防抖保存队列：
 * 把挂在旧 id 上的待写内容与计时器迁到新 id，避免计时器到期后按旧 id
 * 查不到页面导致内容丢失、脏标记永远清不掉。
 */
export const migratePendingLocalSave = (
  oldPageId: string,
  newPageId: string,
  getState: () => PagesState,
) => {
  if (oldPageId === newPageId) return;
  clearLocalSaveTimers(oldPageId);
  const pending = pendingLocalSaveContents.get(oldPageId);
  pendingLocalSaveContents.delete(oldPageId);
  if (pending) {
    queueLocalPageSave(newPageId, pending, getState);
  }
};

export const flushAllPendingLocalSavesInternal = async (getState: () => PagesState) => {
  const pageIds = new Set<string>([
    ...pendingLocalSaveContents.keys(),
    ...localSaveDebounceTimers.keys(),
    ...localSaveMaxWaitTimers.keys(),
    ...localSaveWriteChains.keys(),
  ]);

  await Promise.all(
    Array.from(pageIds).map((pageId) =>
      flushPendingLocalSaveByPageIdInternal(pageId, getState),
    ),
  );
};
