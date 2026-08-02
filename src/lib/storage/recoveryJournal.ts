import type { JSONContent } from "@/types";
import { getContentSignature } from "@/components/editor/utils/blocknote-content";
import {
  getDbStorageItem,
  removeDbStorageItem,
  setDbStorageItem,
} from "./utoolsDbStorage";

export type RecoverySource = "internal-page" | "local-file" | "quicknote";

export interface RecoveryJournalEntry {
  source: RecoverySource;
  id: string;
  content: JSONContent | null;
  revision: number;
  updatedAt: number;
  /** 写入恢复稿时主存储/磁盘中内容的签名，用来避免覆盖外部新版本。 */
  baseSignature?: string;
  baseUpdatedAt?: number;
}

interface RecoveryJournalState {
  version: 1;
  entries: Record<string, RecoveryJournalEntry>;
}

export const RECOVERY_JOURNAL_STORAGE_KEY = "goose-note:recovery-journal:v1";

const entryKey = (source: RecoverySource, id: string) => `${source}:${id}`;

const emptyJournal = (): RecoveryJournalState => ({ version: 1, entries: {} });

const readState = (): RecoveryJournalState => {
  const raw = getDbStorageItem(RECOVERY_JOURNAL_STORAGE_KEY);
  if (!raw) return emptyJournal();
  try {
    const parsed = JSON.parse(raw) as Partial<RecoveryJournalState>;
    return parsed.version === 1 && parsed.entries && typeof parsed.entries === "object"
      ? { version: 1, entries: parsed.entries }
      : emptyJournal();
  } catch {
    return emptyJournal();
  }
};

const writeState = (state: RecoveryJournalState): boolean => {
  if (Object.keys(state.entries).length === 0) {
    removeDbStorageItem(RECOVERY_JOURNAL_STORAGE_KEY);
    return true;
  }
  return setDbStorageItem(RECOVERY_JOURNAL_STORAGE_KEY, JSON.stringify(state));
};

export const listRecoveryEntries = (
  source?: RecoverySource,
): RecoveryJournalEntry[] =>
  Object.values(readState().entries).filter(
    (entry) => !source || entry.source === source,
  );

export const getRecoveryEntry = (
  source: RecoverySource,
  id: string,
): RecoveryJournalEntry | null =>
  readState().entries[entryKey(source, id)] ?? null;

export const recordRecoveryEntry = (input: {
  source: RecoverySource;
  id: string;
  content: JSONContent | null;
  baseSignature?: string;
  baseUpdatedAt?: number;
  now?: number;
}): RecoveryJournalEntry | null => {
  const state = readState();
  const key = entryKey(input.source, input.id);
  const previousRevision = state.entries[key]?.revision ?? 0;
  const entry: RecoveryJournalEntry = {
    source: input.source,
    id: input.id,
    content: input.content,
    revision: previousRevision + 1,
    updatedAt: input.now ?? Date.now(),
    ...(input.baseSignature ? { baseSignature: input.baseSignature } : {}),
    ...(typeof input.baseUpdatedAt === "number"
      ? { baseUpdatedAt: input.baseUpdatedAt }
      : {}),
  };
  state.entries[key] = entry;
  return writeState(state) ? entry : null;
};

/** 只有主存储确认的是同一版恢复稿时才清理，旧 ACK 不能清掉更新内容。 */
export const acknowledgeRecoveryEntry = (
  source: RecoverySource,
  id: string,
  revision: number,
): boolean => {
  const state = readState();
  const key = entryKey(source, id);
  const current = state.entries[key];
  if (!current || current.revision !== revision) return false;
  delete state.entries[key];
  return writeState(state);
};

export const moveRecoveryEntry = (
  source: RecoverySource,
  oldId: string,
  newId: string,
): boolean => {
  if (oldId === newId) return true;
  const state = readState();
  const oldKey = entryKey(source, oldId);
  const current = state.entries[oldKey];
  if (!current) return true;
  delete state.entries[oldKey];
  state.entries[entryKey(source, newId)] = { ...current, id: newId };
  return writeState(state);
};

export const clearRecoveryJournalForTests = (): void => {
  removeDbStorageItem(RECOVERY_JOURNAL_STORAGE_KEY);
};

/** 仅当目标仍是记录恢复稿时看到的版本，才允许把恢复内容放回内存。 */
export const canApplyRecoveryEntry = (
  entry: RecoveryJournalEntry,
  currentContent: JSONContent | null | undefined,
  currentUpdatedAt?: number,
): boolean => {
  if (
    typeof entry.baseUpdatedAt === "number" &&
    typeof currentUpdatedAt === "number" &&
    currentUpdatedAt > entry.baseUpdatedAt
  ) {
    return false;
  }
  return (
    !entry.baseSignature ||
    entry.baseSignature === getContentSignature(currentContent ?? null)
  );
};
