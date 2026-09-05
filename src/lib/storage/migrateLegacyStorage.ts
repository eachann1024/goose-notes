import type { Page } from "@/types";
import {
  PAGE_DOC_PREFIX,
  saveInternalPage,
  saveLocalPageMeta,
  savePagesMeta,
} from "./pageRepository";
import {
  getDbStorageItem,
  removeDbStorageItem,
  setDbStorageItem,
} from "./localDbStorage";
import { HostAdapter } from "../host/adapter";

const LEGACY_PAGES_KEY = "goose-note-storage";
const LEGACY_NOTEBOOKS_KEY = "goose-note-notebooks";
const LEGACY_SETTINGS_KEY = "goose-note-settings";
const LEGACY_MIGRATION_MARK_KEY = "goose-note:storage-migration:v2";
const LEGACY_MIGRATION_CLEANUP_KEY = "goose-note:storage-migration:v3-cleanup";
const DEFAULT_NOTEBOOK_ID = "default-notebook";

type LegacyPagesSourceName = "db" | "localStorage";

interface LegacyPersistEnvelope<T> {
  state?: T;
  version?: number;
}

interface LegacyNotebookRecord {
  id: string;
  source?: "default" | "local-folder";
  localPath?: string;
  [key: string]: unknown;
}

interface LegacyNotebooksState {
  notebooks?: Record<string, LegacyNotebookRecord>;
}

export interface LegacyPersistedPagesState {
  pages?: Record<string, Page>;
  onboardingCompleted?: boolean;
}

interface LegacyPagesSource {
  name: LegacyPagesSourceName;
  raw: string | null;
  envelope: LegacyPersistEnvelope<LegacyPersistedPagesState> | null;
}

interface LegacyMigrationMark {
  version: 3;
  cleanupPending: Partial<Record<LegacyPagesSourceName, true>>;
}

const readLegacyRawFromDb = (key: string): string | null => {
  const doc = HostAdapter.db.get<string>(key);
  return typeof doc?.data === "string" ? doc.data : null;
};

const readLegacyRawFromLocalStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const readLegacyRaw = (key: string): string | null =>
  readLegacyRawFromDb(key) ?? readLegacyRawFromLocalStorage(key);

const parseLegacyEnvelope = <T>(raw: string | null): LegacyPersistEnvelope<T> | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LegacyPersistEnvelope<T>;
  } catch (error) {
    console.error("[storageMigration] parse legacy storage failed", error);
    return null;
  }
};

const hasValidLegacyPages = (
  envelope: LegacyPersistEnvelope<LegacyPersistedPagesState> | null,
): envelope is LegacyPersistEnvelope<LegacyPersistedPagesState> & {
  state: LegacyPersistedPagesState & { pages: Record<string, Page> };
} => {
  const pages = envelope?.state?.pages;
  return Boolean(
    pages &&
      typeof pages === "object" &&
      Object.keys(pages).length > 0 &&
      Object.values(pages).every(
        (page) =>
          page &&
          typeof page === "object" &&
          typeof page.id === "string" &&
          typeof page.workspaceId === "string" &&
          Array.isArray(page.content),
      ),
  );
};

const readLegacyMigrationMark = (): LegacyMigrationMark | null => {
  if (getDbStorageItem(LEGACY_MIGRATION_MARK_KEY) !== "1") return null;
  try {
    const parsed = JSON.parse(getDbStorageItem(LEGACY_MIGRATION_CLEANUP_KEY) ?? "{}") as Partial<LegacyMigrationMark>;
    return parsed.version === 3 && parsed.cleanupPending
      ? { version: 3, cleanupPending: parsed.cleanupPending }
      // v2 markers predate source tracking, so preserve their cleanup retry.
      : { version: 3, cleanupPending: { db: true, localStorage: true } };
  } catch {
    return { version: 3, cleanupPending: { db: true, localStorage: true } };
  }
};

const writeLegacyMigrationMark = (mark: LegacyMigrationMark): boolean =>
  setDbStorageItem(LEGACY_MIGRATION_CLEANUP_KEY, JSON.stringify(mark)) &&
  setDbStorageItem(LEGACY_MIGRATION_MARK_KEY, "1");

const removeLegacyPagesSource = (source: LegacyPagesSourceName): boolean => {
  if (source === "db") {
    const current = HostAdapter.db.get(LEGACY_PAGES_KEY);
    if (!current) return true;
    const result = HostAdapter.db.remove(LEGACY_PAGES_KEY);
    if (result.ok === false) {
      console.error("[storageMigration] remove legacy pages db doc failed", result.error);
      return false;
    }
    return true;
  }
  return removeDbStorageItem(LEGACY_PAGES_KEY);
};

const buildNotebooksPersistPayload = (
  envelope: LegacyPersistEnvelope<LegacyNotebooksState> | null,
  notebooks: Record<string, LegacyNotebookRecord>,
): string => {
  const persisted = envelope && typeof envelope === "object" ? envelope : {};
  const state = persisted.state && typeof persisted.state === "object" ? persisted.state : {};
  return JSON.stringify({ ...persisted, state: { ...state, notebooks } });
};

const samePage = (left: Page, right: Page): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const migrateLegacyStorage = async (): Promise<void> => {
  const mark = readLegacyMigrationMark();
  if (mark) {
    // Only sources whose deletion previously failed are retried. Do not infer
    // that any other same-named source is safe to remove.
    (["db", "localStorage"] as const).forEach((source) => {
      if (mark.cleanupPending[source] && removeLegacyPagesSource(source)) {
        delete mark.cleanupPending[source];
        writeLegacyMigrationMark(mark);
      }
    });
    return;
  }

  const sourceInputs: Array<Pick<LegacyPagesSource, "name" | "raw">> = [
    { name: "db", raw: readLegacyRawFromDb(LEGACY_PAGES_KEY) },
    { name: "localStorage", raw: readLegacyRawFromLocalStorage(LEGACY_PAGES_KEY) },
  ];
  const sources: LegacyPagesSource[] = sourceInputs.map((source) => ({
    ...source,
    envelope: parseLegacyEnvelope<LegacyPersistedPagesState>(source.raw),
  }));
  const validSources = sources.filter((source): source is LegacyPagesSource & {
    envelope: LegacyPersistEnvelope<LegacyPersistedPagesState> & { state: LegacyPersistedPagesState & { pages: Record<string, Page> } };
  } => hasValidLegacyPages(source.envelope));
  const legacyNotebooksRaw = readLegacyRaw(LEGACY_NOTEBOOKS_KEY);
  const legacySettingsRaw = readLegacyRaw(LEGACY_SETTINGS_KEY);

  // A malformed source is never removed. A valid companion source can still be
  // migrated independently, leaving the damaged source available for repair.
  if (validSources.length === 0) return;

  const legacyNotebooksEnvelope = parseLegacyEnvelope<LegacyNotebooksState>(legacyNotebooksRaw);
  const migratedPages: Record<string, Page> = {};
  const unsafeSources = new Set<LegacyPagesSourceName>();
  validSources.forEach((source) => {
    Object.entries(source.envelope.state.pages).forEach(([id, page]) => {
      const existing = migratedPages[id];
      if (!existing) {
        migratedPages[id] = page;
      } else if (!samePage(existing, page)) {
        // DB is deterministic first. Keep the other complete envelope as the
        // recoverable conflict copy rather than silently discarding it.
        unsafeSources.add(source.name);
      }
    });
  });

  const legacyNotebooks = legacyNotebooksEnvelope?.state?.notebooks;
  const nextNotebooks: Record<string, LegacyNotebookRecord> = legacyNotebooks ? { ...legacyNotebooks } : {};
  if (Object.keys(nextNotebooks).length === 0) {
    nextNotebooks[DEFAULT_NOTEBOOK_ID] = { id: DEFAULT_NOTEBOOK_ID, name: "Note", icon: "📓", createdAt: Date.now(), updatedAt: Date.now() };
  }
  Object.values(migratedPages).forEach((page) => {
    if (!nextNotebooks[page.workspaceId]) {
      nextNotebooks[page.workspaceId] = { id: page.workspaceId, name: "Note", icon: "📓", createdAt: page.createdAt, updatedAt: page.updatedAt };
    }
  });

  if (!setDbStorageItem(LEGACY_NOTEBOOKS_KEY, buildNotebooksPersistPayload(legacyNotebooksEnvelope, nextNotebooks)) ||
    (legacySettingsRaw && !setDbStorageItem(LEGACY_SETTINGS_KEY, legacySettingsRaw))) return;

  const existingPageIds = new Set(HostAdapter.db.allDocs<Page>(PAGE_DOC_PREFIX).map((doc) => doc._id.slice(PAGE_DOC_PREFIX.length)));
  let migrationSucceeded = true;
  Object.values(migratedPages).forEach((page) => {
    if (existingPageIds.has(page.id)) return;
    const notebook = nextNotebooks[page.workspaceId];
    const isLocalFolderPage = notebook?.source === "local-folder" || Boolean(page.localFilePath);
    migrationSucceeded = (isLocalFolderPage
      ? saveLocalPageMeta({ id: page.id, workspaceId: page.workspaceId, updatedAt: page.updatedAt, isFavorite: page.isFavorite, favoriteOrder: page.favoriteOrder, icon: page.icon, isPinned: page.isPinned, pinnedAt: page.pinnedAt })
      : saveInternalPage(page)) && migrationSucceeded;
  });
  migrationSucceeded = savePagesMeta({ onboardingCompleted: validSources.some((source) => Boolean(source.envelope.state.onboardingCompleted)) }) && migrationSucceeded;
  if (!migrationSucceeded) return;

  const nextMark: LegacyMigrationMark = { version: 3, cleanupPending: {} };
  // A dual-source conflict keeps both complete envelopes recoverable. Otherwise
  // each valid source is eligible for independent cleanup after this durable
  // commit; a failed commit leaves every source untouched for a full retry.
  if (unsafeSources.size === 0) {
    validSources.forEach((source) => { nextMark.cleanupPending[source.name] = true; });
  }
  if (!writeLegacyMigrationMark(nextMark)) return;
  (Object.keys(nextMark.cleanupPending) as LegacyPagesSourceName[]).forEach((source) => {
    if (removeLegacyPagesSource(source)) delete nextMark.cleanupPending[source];
  });
  writeLegacyMigrationMark(nextMark);
};

export const clearLegacyStorage = (): void => {
  removeLegacyPagesSource("db");
  removeLegacyPagesSource("localStorage");
  removeDbStorageItem(LEGACY_MIGRATION_MARK_KEY);
  removeDbStorageItem(LEGACY_MIGRATION_CLEANUP_KEY);
};
