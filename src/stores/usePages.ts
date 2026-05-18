import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { Page, JSONContent } from "@/types";
import { useNotebooks, DEFAULT_NOTEBOOK } from "./useNotebooks";
import { extractTitleFromContent } from "@/lib/content-text-extractor";
import { jsonContentToMarkdown } from "@/lib/export";
import { getPageTitle } from "@/lib/page-title";
import {
  buildLocalPageId,
  scanLocalFolderPages,
} from "@/lib/local-folder-scanner";
import {
  ONBOARDING_PAGE_CONTENT,
  ONBOARDING_CHILD_PAGE_CONTENT,
  ONBOARDING_SECOND_CHILD_CONTENT,
} from "@/lib/onboarding";
import {
  clonePageContent as cloneBlockNotePageContent,
  createEmptyBlockNoteContent,
  normalizePageContent,
} from "@/lib/blocknote-content";
import type { PersistedLocalPageMetaDoc } from "@/lib/storage/pageRepository";
import {
  loadPagesFromStorage,
  removeInternalPage,
  removeLocalPageMeta,
  saveInternalPage,
  saveLocalPageMeta,
  savePagesMeta,
} from "@/lib/storage/pageRepository";
import { getDbStorageItem, setDbStorageItem } from "@/lib/storage/utoolsDbStorage";

// 本地文件采用近实时后台保存，尽量缩短独立窗口关闭前的未落盘窗口。
const LOCAL_SAVE_DEBOUNCE_MS = 180;
const LOCAL_SAVE_MAX_WAIT_MS = 1000;
const localSaveDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const localSaveMaxWaitTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingLocalSaveContents = new Map<string, JSONContent>();
const localSaveWriteChains = new Map<string, Promise<void>>();

// 本地页面元数据缓存 (用于在重新加载本地文件夹时防止元数据丢失)
const localPageMetadataCache = new Map<
  string,
  {
    isFavorite?: boolean;
    favoriteOrder?: number;
    icon?: string;
    isPinned?: boolean;
    pinnedAt?: number;
  }
>();

type LocalPageMetadata = {
  isFavorite?: boolean;
  favoriteOrder?: number;
  icon?: string;
  isPinned?: boolean;
  pinnedAt?: number;
};

const LEGACY_TITLE_CHILDREN_REPAIR_MARK_KEY =
  "goose-note:content-repair:title-children:v1";

// 辅助函数：生成本地页面ID（基于相对路径的hash）
function generateLocalPageId(notebookId: string, filePath: string): string {
  const notebook = useNotebooks.getState().notebooks[notebookId];
  if (!notebook?.localPath) return uuidv4();
  return buildLocalPageId(notebookId, notebook.localPath, filePath);
}

const LOCAL_PAGE_META_UPDATE_KEYS: Array<keyof Page> = [
  "isFavorite",
  "favoriteOrder",
  "icon",
  "isPinned",
  "pinnedAt",
];

const buildLocalPageMetadata = (
  source: Partial<Page> | PersistedLocalPageMetaDoc,
): LocalPageMetadata | null => {
  const metadata: LocalPageMetadata = {};

  if (source.isFavorite) {
    metadata.isFavorite = true;
  }
  if (typeof source.favoriteOrder === "number") {
    metadata.favoriteOrder = source.favoriteOrder;
  }
  if (typeof source.icon === "string" && source.icon.trim()) {
    metadata.icon = source.icon;
  }
  if (source.isPinned) {
    metadata.isPinned = true;
  }
  if (typeof source.pinnedAt === "number") {
    metadata.pinnedAt = source.pinnedAt;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
};

const syncLocalPageMetadataCache = (
  pageId: string,
  source: Partial<Page> | PersistedLocalPageMetaDoc | null,
) => {
  const metadata = source ? buildLocalPageMetadata(source) : null;
  if (!metadata) {
    localPageMetadataCache.delete(pageId);
    return;
  }
  localPageMetadataCache.set(pageId, metadata);
};

const seedLocalPageMetadataCache = (
  localPageMetas: Record<string, PersistedLocalPageMetaDoc>,
) => {
  localPageMetadataCache.clear();
  Object.entries(localPageMetas).forEach(([pageId, metadata]) => {
    syncLocalPageMetadataCache(pageId, metadata);
  });
};

const isLocalFolderPage = (page: Page | undefined): boolean => {
  if (!page) return false;
  if (page.localFilePath) return true;
  const notebook = useNotebooks.getState().notebooks[page.workspaceId];
  return notebook?.source === "local-folder";
};

const persistPageSnapshot = (page: Page | undefined) => {
  if (!page) return;

  if (isLocalFolderPage(page)) {
    syncLocalPageMetadataCache(page.id, page);
    saveLocalPageMeta({
      id: page.id,
      workspaceId: page.workspaceId,
      updatedAt: page.updatedAt,
      isFavorite: page.isFavorite,
      favoriteOrder: page.favoriteOrder,
      icon: page.icon,
      isPinned: page.isPinned,
      pinnedAt: page.pinnedAt,
    });
    return;
  }

  saveInternalPage(page);
};

const persistPageSnapshots = (
  pages: Record<string, Page>,
  pageIds: Iterable<string>,
) => {
  for (const pageId of pageIds) {
    persistPageSnapshot(pages[pageId]);
  }
};

const removePersistedPageSnapshot = (page: Page | undefined, pageId?: string) => {
  const targetPageId = page?.id ?? pageId;
  if (!targetPageId) return;

  if (isLocalFolderPage(page)) {
    syncLocalPageMetadataCache(targetPageId, null);
    removeLocalPageMeta(targetPageId);
    return;
  }

  removeInternalPage(targetPageId);
};

const removePersistedPageSnapshots = (
  pages: Record<string, Page>,
  pageIds: Iterable<string>,
) => {
  for (const pageId of pageIds) {
    removePersistedPageSnapshot(pages[pageId], pageId);
  }
};

const shouldPersistLocalPageMetaUpdate = (updates: Partial<Page>) => {
  return LOCAL_PAGE_META_UPDATE_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(updates, key),
  );
};

function compareSiblingPages(
  a: Page,
  b: Page,
  isLocalNotebook: boolean,
): number {
  if (isLocalNotebook) {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    const titleCompare = getPageTitle(a).localeCompare(getPageTitle(b), "zh-CN", {
      numeric: true,
    });
    if (titleCompare !== 0) return titleCompare;
    return a.id.localeCompare(b.id);
  }

  const orderA = a.order ?? a.createdAt;
  const orderB = b.order ?? b.createdAt;
  if (orderA !== orderB) return orderA - orderB;
  return a.id.localeCompare(b.id);
}

function resolveAdjacentPageAfterDeletion({
  pages,
  currentPage,
  removedIds,
  isLocalNotebook,
}: {
  pages: Record<string, Page>;
  currentPage: Page;
  removedIds: Set<string>;
  isLocalNotebook: boolean;
}): string | null {
  const siblingsBeforeDelete = Object.values(pages)
    .filter(
      (candidate) =>
        candidate.workspaceId === currentPage.workspaceId &&
        !candidate.trashedAt &&
        candidate.parentId === currentPage.parentId,
    )
    .sort((a, b) => compareSiblingPages(a, b, isLocalNotebook));

  const deletedPageIndex = siblingsBeforeDelete.findIndex(
    (candidate) => candidate.id === currentPage.id,
  );
  const siblingsAfterDelete = siblingsBeforeDelete.filter(
    (candidate) => !removedIds.has(candidate.id),
  );

  if (siblingsAfterDelete.length === 0) {
    return null;
  }

  const fallbackIndex =
    deletedPageIndex === -1
      ? siblingsAfterDelete.length - 1
      : Math.min(deletedPageIndex, siblingsAfterDelete.length - 1);

  return siblingsAfterDelete[fallbackIndex]?.id ?? null;
}

interface PagesState {
  pages: Record<string, Page>;
  activePageId: string | null;
  pendingNavigatePageId: string | null;
  expandPageId: string | null;
  searchHighlightQuery: string | null; // 搜索跳转后高亮的关键词
  searchHighlightPageId: string | null;
  searchHighlightNonce: number;
  handledSearchHighlightNonce: number;
  hydrated: boolean;
  lastSavedAt: number | null;
  onboardingCompleted: boolean;
  hydrateFromStorage: () => Promise<void>;

  createOnboardingPages: () => void;
  createPage: (parentId?: string, workspaceId?: string) => string;
  createPageRecord: (options: {
    workspaceId: string;
    parentId?: string;
    content?: JSONContent;
  }) => string;
  updatePage: (id: string, updates: Partial<Page>) => void;
  deletePage: (id: string) => Promise<boolean>;
  restorePage: (id: string) => {
    ok: boolean;
    pageTitle?: string;
    notebookName?: string;
    parentTitles?: string[];
    restoredCount?: number;
    itemLabel?: string;
  };
  duplicatePage: (id: string) => string;
  permanentlyDeletePage: (id: string) => Promise<void>;
  reorderPages: (ids: string[], parentId: string | undefined) => void;
  reorderFavorites: (ids: string[]) => void;
  movePageTreeToNotebook: (
    pageId: string,
    targetNotebookId: string,
  ) => {
    ok: boolean;
    movedCount: number;
    sourceNotebookId?: string;
    targetNotebookId?: string;
    reason?: string;
  };
  setActivePage: (id: string | null) => void;
  setPendingNavigatePageId: (id: string | null) => void;
  setExpandPageId: (id: string | null) => void;
  setSearchHighlightQuery: (query: string | null) => void;
  setSearchHighlightPageId: (id: string | null) => void;
  setSearchHighlightNonce: (nonce: number) => void;
  setHandledSearchHighlightNonce: (nonce: number) => void;
  setHydrated: (hydrated: boolean) => void;
  setLastSavedAt: (timestamp: number | null) => void;
  getAncestorIds: (pageId: string) => string[];

  getPage: (id: string) => Page | undefined;
  getChildren: (parentId?: string, workspaceId?: string) => Page[];
  getTrashedPages: (workspaceId?: string) => Page[];
  getFavorites: (workspaceId?: string) => Page[];
  getPinnedPages: () => Page[];
  removePagesByWorkspaceId: (
    workspaceId: string,
    options?: { purgePersistence?: boolean },
  ) => void;

  // 本地文件夹相关函数
  loadLocalFolderPages: (
    notebookId: string,
    basePath: string,
    options?: { showWelcome?: boolean },
  ) => Promise<void>;
  saveLocalPageContent: (
    pageId: string,
    content: JSONContent,
  ) => Promise<boolean>;
  flushPendingLocalSaves: () => Promise<void>;
  flushPendingLocalSaveByPageId: (pageId: string) => Promise<void>;
  getLocalFilePath: (pageId: string) => string | null;
  createLocalPage: (
    parentId?: string,
    workspaceId?: string,
  ) => Promise<string | null> | string | null;
  createLocalPageRecord: (options: {
    workspaceId: string;
    parentId?: string;
    title?: string;
    content?: JSONContent;
  }) => Promise<string | null>;
  writePageContent: (
    pageId: string,
    content: JSONContent,
    mode?: "replace",
  ) => Promise<boolean>;
  appendPageContent: (
    pageId: string,
    content: JSONContent,
  ) => Promise<boolean>;
}

const cloneJSONContent = (content: JSONContent): JSONContent => {
  return JSON.parse(JSON.stringify(content)) as JSONContent;
};

const clearLocalSaveTimers = (pageId: string) => {
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

const flushPendingLocalSaveByPageIdInternal = (
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
        pendingLocalSaveContents.delete(pageId);
        if (!latestContent) continue;
        await getState().saveLocalPageContent(pageId, cloneJSONContent(latestContent));
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

const queueLocalPageSave = (
  pageId: string,
  content: JSONContent,
  getState: () => PagesState,
) => {
  pendingLocalSaveContents.set(pageId, cloneJSONContent(content));

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

const flushAllPendingLocalSavesInternal = async (getState: () => PagesState) => {
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

const initialContent: JSONContent = createEmptyBlockNoteContent();

function createDefaultPageContent(title = ""): JSONContent {
  return createEmptyBlockNoteContent(title);
}

function clonePageContent(content?: JSONContent | null) {
  if (!content) {
    return cloneBlockNotePageContent(initialContent);
  }
  return cloneBlockNotePageContent(normalizePageContent(content));
}

function mergePageContent(base: JSONContent, addition: JSONContent): JSONContent {
  const baseBlocks = normalizePageContent(base);
  const additionBlocks = normalizePageContent(addition);
  if (!additionBlocks.length) {
    return baseBlocks;
  }

  const lastBlock = baseBlocks.at(-1);
  const firstAdditionBlock = additionBlocks[0];
  const needsSpacer =
    baseBlocks.length > 0 &&
    lastBlock?.type !== "paragraph" &&
    firstAdditionBlock?.type !== "paragraph";

  return [
    ...baseBlocks,
    ...(needsSpacer ? ([{ type: "paragraph", content: "" }] as JSONContent) : []),
    ...additionBlocks,
  ];
}

function flattenLegacyTitleHeadingChildren(
  content: JSONContent,
): { content: JSONContent; repaired: boolean } {
  if (!Array.isArray(content) || content.length === 0) {
    return { content, repaired: false };
  }

  const firstBlock = content[0] as Record<string, unknown> | undefined;
  if (!firstBlock || firstBlock.type !== "heading") {
    return { content, repaired: false };
  }

  const nestedChildren = Array.isArray(firstBlock.children) ? firstBlock.children : [];
  if (nestedChildren.length === 0) {
    return { content, repaired: false };
  }

  const { children: _ignoredChildren, ...titleWithoutChildren } = firstBlock;
  const normalizedTitle = {
    ...titleWithoutChildren,
    props: {
      ...(typeof firstBlock.props === "object" && firstBlock.props
        ? (firstBlock.props as Record<string, unknown>)
        : {}),
      level: 1,
    },
  };

  return {
    content: [
      normalizedTitle as JSONContent[number],
      ...nestedChildren,
      ...content.slice(1),
    ] as JSONContent,
    repaired: true,
  };
}

function repairLegacyTitleChildrenInPages(
  pages: Record<string, Page>,
): { pages: Record<string, Page>; repairedPageIds: string[] } {
  let nextPages = pages;
  const repairedPageIds: string[] = [];

  Object.entries(pages).forEach(([pageId, page]) => {
    const repairResult = flattenLegacyTitleHeadingChildren(page.content);
    if (!repairResult.repaired) {
      return;
    }

    if (nextPages === pages) {
      nextPages = { ...pages };
    }

    nextPages[pageId] = {
      ...page,
      content: repairResult.content,
    };
    repairedPageIds.push(pageId);
  });

  return { pages: nextPages, repairedPageIds };
}

export const flushEditorContent = (immediate = false) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("goose-note:flush-editor", { detail: { immediate } })
    );
  }
};

export const clearLocalPageMetadataCache = () => {
  localPageMetadataCache.clear();
};

export const usePages = create<PagesState>()((set, get) => ({
      pages: {},
      activePageId: null,
      pendingNavigatePageId: null,
      expandPageId: null,
      searchHighlightQuery: null,
      searchHighlightPageId: null,
      searchHighlightNonce: 0,
      handledSearchHighlightNonce: 0,
      hydrated: false,
      lastSavedAt: null,
      onboardingCompleted: false,
      hydrateFromStorage: async () => {
        const { pages, localPageMetas, onboardingCompleted } =
          loadPagesFromStorage();
        const hasRepairedLegacyTitleChildren =
          getDbStorageItem(LEGACY_TITLE_CHILDREN_REPAIR_MARK_KEY) === "1";
        const { pages: repairedPages, repairedPageIds } = hasRepairedLegacyTitleChildren
          ? { pages, repairedPageIds: [] as string[] }
          : repairLegacyTitleChildrenInPages(pages);

        if (!hasRepairedLegacyTitleChildren) {
          if (repairedPageIds.length > 0) {
            repairedPageIds.forEach((pageId) => {
              const repairedPage = repairedPages[pageId];
              if (!repairedPage || repairedPage.localFilePath) return;
              saveInternalPage(repairedPage);
            });
            console.info(
              `[usePages] repaired legacy title-children structure in ${repairedPageIds.length} page(s).`,
            );
          }
          setDbStorageItem(LEGACY_TITLE_CHILDREN_REPAIR_MARK_KEY, "1");
        }

        seedLocalPageMetadataCache(localPageMetas);
        set({
          pages: repairedPages,
          activePageId: null,
          pendingNavigatePageId: null,
          expandPageId: null,
          searchHighlightQuery: null,
          searchHighlightPageId: null,
          searchHighlightNonce: 0,
          handledSearchHighlightNonce: 0,
          hydrated: true,
          lastSavedAt: null,
          onboardingCompleted,
        });
      },

      createOnboardingPages: () => {
        let createdMainId: string | null = null;
        const workspaceId = DEFAULT_NOTEBOOK;

        set((state) => {
          const hasExistingOnboardingPage = Object.values(state.pages).some(
            (page) =>
              page.workspaceId === workspaceId &&
              !page.trashedAt &&
              extractTitleFromContent(page.content) === "鹅的笔记 · 新手指南",
          );

          if (state.onboardingCompleted || hasExistingOnboardingPage) {
            if (state.onboardingCompleted) return state;
            return { ...state, onboardingCompleted: true };
          }

          const mainId = uuidv4();
          const childId1 = uuidv4();
          const childId2 = uuidv4();
          const now = Date.now();

          createdMainId = mainId;

          const mainPage: Page = {
            id: mainId,
            workspaceId,
            parentId: undefined,
            content: ONBOARDING_PAGE_CONTENT,
            isFolder: false,
            isLocked: false,
            isFullWidth: false,
            fontSize: "default",
            fontFamily: "default",
            createdAt: now,
            updatedAt: now,
            order: now,
          };

          const childPage1: Page = {
            id: childId1,
            workspaceId,
            parentId: mainId,
            content: ONBOARDING_CHILD_PAGE_CONTENT,
            isFolder: false,
            isLocked: false,
            isFullWidth: false,
            fontSize: "default",
            fontFamily: "default",
            createdAt: now + 1,
            updatedAt: now + 1,
            order: now + 1,
          };

          const childPage2: Page = {
            id: childId2,
            workspaceId,
            parentId: mainId,
            content: ONBOARDING_SECOND_CHILD_CONTENT,
            isFolder: false,
            isLocked: false,
            isFullWidth: false,
            fontSize: "default",
            fontFamily: "default",
            createdAt: now + 2,
            updatedAt: now + 2,
            order: now + 2,
          };

          return {
            ...state,
            pages: {
              ...state.pages,
              [mainId]: mainPage,
              [childId1]: childPage1,
              [childId2]: childPage2,
            },
            activePageId: mainId,
            onboardingCompleted: true,
            expandPageId: mainId,
          };
        });

        if (createdMainId) {
          useNotebooks.getState().setActiveNotebook(workspaceId);
          useNotebooks.getState().setLastActivePage(workspaceId, createdMainId);
          const currentPages = get().pages;
          persistPageSnapshots(currentPages, [createdMainId]);
          Object.values(currentPages)
            .filter((page) => page.parentId === createdMainId)
            .forEach((page) => persistPageSnapshot(page));
        }
        savePagesMeta({ onboardingCompleted: true });
      },

      createPage: (parentId, workspaceId = DEFAULT_NOTEBOOK) => {
        flushEditorContent();

        const id = get().createPageRecord({
          workspaceId,
          parentId,
        });
        set({ activePageId: id });
        useNotebooks.getState().setLastActivePage(workspaceId, id);

        // 新建页面时自动聚焦标题
        if (typeof window !== "undefined") {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("goose-note:focus-editor-start"),
            );
          }, 100);
        }

        return id;
      },

      createPageRecord: ({ workspaceId, parentId, content }) => {
        const id = uuidv4();
        const now = Date.now();
        const newPage: Page = {
          id,
          workspaceId,
          parentId,
          content: clonePageContent(content),
          isFolder: false,
          isLocked: false,
          isFullWidth: false,
          fontSize: "default",
          fontFamily: "default",
          createdAt: now,
          updatedAt: now,
          order: now,
        };

        set((state) => ({
          pages: { ...state.pages, [id]: newPage },
        }));

        persistPageSnapshot(get().pages[id]);
        return id;
      },

      createLocalPage: async (parentId?: string, workspaceId?: string) => {
        if (!workspaceId) return null;
        const id = await get().createLocalPageRecord({
          workspaceId,
          parentId,
          title: "新页面",
          content: createDefaultPageContent(""),
        });
        if (!id) return null;
        set({ activePageId: id });
        useNotebooks.getState().setLastActivePage(workspaceId, id);

        if (typeof window !== "undefined") {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("goose-note:focus-editor-start"),
            );
          }, 100);
        }

        return id;
      },

      createLocalPageRecord: async ({
        workspaceId,
        parentId,
        title,
        content,
      }) => {
        const notebook = useNotebooks.getState().notebooks[workspaceId];
        if (
          !notebook?.localPath ||
          typeof window === "undefined" ||
          !window.gooseFs
        ) {
          return null;
        }

        const resolveParentPath = () => {
          if (!parentId) return null;
          const parentPage = get().pages[parentId];
          if (parentPage?.localFilePath) return parentPage.localFilePath;
          const prefix = `local-${workspaceId}-`;
          if (!parentId.startsWith(prefix)) return null;
          const encoded = parentId.slice(prefix.length);
          try {
            const relativePath = decodeURIComponent(encoded);
            return `${notebook.localPath}/${relativePath}`;
          } catch {
            return null;
          }
        };

        const now = Date.now();
        const normalizedTitle =
          ((title || "新页面").trim() || "新页面").replace(/[\\/:*?"<>|]/g, "_");
        const parentPath = resolveParentPath();
        const parentPage = parentId ? get().pages[parentId] : undefined;
        const storedParentId =
          parentPage?.localFilePath && !parentPage.isFolder
            ? parentPage.parentId
            : parentId;
        const baseDir = parentPath
          ? parentPage?.isFolder
            ? parentPath
            : parentPath.replace(/[^\/\\]+$/, "")
          : notebook.localPath;
        const normalizedBaseDir = baseDir.replace(/[\/\\]$/, "");
        let filePath = `${normalizedBaseDir}/${normalizedTitle}.md`;

        const checkExists = async (path: string) => {
          if (window.gooseFs?.existsAsync) {
            return await window.gooseFs.existsAsync(path);
          }
          return window.gooseFs?.exists(path) ?? false;
        };

        if (await checkExists(filePath)) {
          let suffix = 1;
          while (
            await checkExists(`${normalizedBaseDir}/${normalizedTitle} (${suffix}).md`)
          ) {
            suffix++;
          }
          filePath = `${normalizedBaseDir}/${normalizedTitle} (${suffix}).md`;
        }

        if (window.gooseFs.writeFileAsync) {
          const ok = await window.gooseFs.writeFileAsync(filePath, `# \n`);
          if (!ok) return null;
        } else {
          if (!window.gooseFs.writeFile(filePath, `# \n`)) {
            return null;
          }
        }

        const id = generateLocalPageId(workspaceId, filePath);
        const newPage: Page = {
          id,
          workspaceId,
          parentId: storedParentId,
          content: clonePageContent(content),
          isFolder: false,
          isLocked: false,
          isFullWidth: false,
          fontSize: "default",
          fontFamily: "default",
          localFilePath: filePath,
          createdAt: now,
          updatedAt: now,
          order: now,
        };

        set((state) => ({
          pages: { ...state.pages, [id]: newPage },
        }));

        syncLocalPageMetadataCache(id, null);
        const saved = await get().saveLocalPageContent(id, clonePageContent(newPage.content));
        if (!saved) {
          set((state) => {
            const nextPages = { ...state.pages };
            delete nextPages[id];
            return { pages: nextPages };
          });
          return null;
        }

        return id;
      },

      updatePage: (id, updates) => {
        const page = get().pages[id];
        const shouldPersistLocalMeta =
          isLocalFolderPage(page) && shouldPersistLocalPageMetaUpdate(updates);

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

          const updatedPage = {
            ...page,
            ...updates,
            ...(favoriteOrder !== undefined ? { favoriteOrder } : {}),
            pinnedAt,
            updatedAt: now,
          };

          // 如果是本地文件夹页面且内容有更新，触发防抖保存
          if (
            updates.content &&
            useNotebooks.getState().notebooks[page.workspaceId]?.source ===
              "local-folder"
          ) {
            queueLocalPageSave(id, updates.content, get);
          }

          return {
            pages: {
              ...state.pages,
              [id]: updatedPage,
            },
          };
        });

        const updatedPage = get().pages[id];
        if (!updatedPage) return;

        if (isLocalFolderPage(updatedPage)) {
          if (shouldPersistLocalMeta) {
            persistPageSnapshot(updatedPage);
          }
          return;
        }

        persistPageSnapshot(updatedPage);
      },

      deletePage: async (id) => {
        flushEditorContent();
        const page = get().pages[id];
        if (!page) return false;

        const notebook = useNotebooks.getState().notebooks[page.workspaceId];
        const isLocalFolder = notebook?.source === "local-folder";
        if (isLocalFolder && notebook?.localPath) {
          const resolvePathFromId = (pageId: string) => {
            const prefix = `local-${page.workspaceId}-`;
            if (!pageId.startsWith(prefix)) return null;
            const encoded = pageId.slice(prefix.length);
            try {
              const relativePath = decodeURIComponent(encoded);
              return `${notebook.localPath}/${relativePath}`;
            } catch {
              return null;
            }
          };

          const targetPath = page.localFilePath || resolvePathFromId(id);
          if (!targetPath || !window.gooseFs) return false;

          const confirmed = confirm(
            page.isFolder
              ? `确定要删除本地文件夹 "${getPageTitle(page)}" 及其内容吗？将移入系统回收站。`
              : `确定要删除本地文件 "${getPageTitle(page)}" 吗？将移入系统回收站。`,
          );
          if (!confirmed) return false;

          const removedIds = new Set<string>();
          const stack = [id];
          const snapshotPages = get().pages;
          while (stack.length) {
            const currentId = stack.pop()!;
            removedIds.add(currentId);
            Object.values(snapshotPages).forEach((p) => {
              if (p.parentId === currentId) stack.push(p.id);
            });
          }

          const removeOk = page.isFolder
            ? await window.gooseFs.deleteDir(targetPath)
            : await window.gooseFs.deleteFile(targetPath);
          if (!removeOk) return false;

	          set((state) => {
            const newPages = { ...state.pages };
            removedIds.forEach((pid) => delete newPages[pid]);

            let nextActivePageId = state.activePageId;
            if (removedIds.has(state.activePageId || "")) {
              nextActivePageId = resolveAdjacentPageAfterDeletion({
                pages: state.pages,
                currentPage: page,
                removedIds,
                isLocalNotebook: true,
              });
              // 同步清理 Notebook 中记录的最后活跃页面
              useNotebooks.getState().setLastActivePage(
                page.workspaceId,
                nextActivePageId,
              );
            }

            return {
              pages: newPages,
              activePageId: nextActivePageId,
            };
          });

          removePersistedPageSnapshots(snapshotPages, removedIds);

          return true;
        }

        const workspaceId = page.workspaceId;
        const changedIds: string[] = [];

        set((state) => {
          // 递归获取所有子页面 ID
          const removedIds = new Set<string>();
          const stack = [id];
          while (stack.length) {
            const currentId = stack.pop()!;
            removedIds.add(currentId);
            Object.values(state.pages).forEach((p) => {
              if (p.parentId === currentId && !p.trashedAt) stack.push(p.id);
            });
          }

          const newPages = { ...state.pages };
          const now = Date.now();
          removedIds.forEach((pid) => {
            if (newPages[pid]) {
              newPages[pid] = {
                ...newPages[pid],
                trashedAt: now,
                updatedAt: now,
                isFavorite: false,
                isPinned: false,
                pinnedAt: undefined,
              };
              changedIds.push(pid);
            }
          });

          let newActivePageId = state.activePageId;
          if (removedIds.has(state.activePageId || "")) {
            newActivePageId = resolveAdjacentPageAfterDeletion({
              pages: state.pages,
              currentPage: page,
              removedIds,
              isLocalNotebook: false,
            });
            // 清理 Notebook 记录
            useNotebooks.getState().setLastActivePage(
              workspaceId,
              newActivePageId,
            );
          }

          return {
            pages: newPages,
            activePageId: newActivePageId,
          };
        });

        persistPageSnapshots(get().pages, changedIds);

        return true;
      },

      restorePage: (id) => {
        const snapshotPages = get().pages;
        const page = snapshotPages[id];
        if (!page || !page.trashedAt) {
          return { ok: false };
        }

        const notebookName =
          useNotebooks.getState().notebooks[page.workspaceId]?.name ||
          "未命名记事本";
        const pageTitle = getPageTitle(page) || "无标题";
        const itemLabel = page.isFolder
          ? "文件夹"
          : page.localFilePath
            ? "文件"
            : "页面";

        const parentTitles: string[] = [];
        const parentVisited = new Set<string>();
        let currentParentId = page.parentId;
        while (currentParentId && !parentVisited.has(currentParentId)) {
          parentVisited.add(currentParentId);
          const parentPage = snapshotPages[currentParentId];
          if (!parentPage) break;
          parentTitles.unshift(getPageTitle(parentPage) || "无标题");
          currentParentId = parentPage.parentId;
        }

        let restoredCount = 0;
        const restoredIds: string[] = [];
        set((state) => {
          const currentPage = state.pages[id];
          if (!currentPage || !currentPage.trashedAt) return state;

          const trashStamp = currentPage.trashedAt;
          const now = Date.now();
          const restoredPages = { ...state.pages };

          const stack = [id];
          const visited = new Set<string>();
          while (stack.length) {
            const currentId = stack.pop()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            const current = restoredPages[currentId];
            if (current?.trashedAt === trashStamp) {
              const { trashedAt, ...rest } = current;
              restoredPages[currentId] = {
                ...rest,
                updatedAt: now,
              } as Page;
              restoredCount += 1;
              restoredIds.push(currentId);
            }
            Object.values(restoredPages).forEach((p) => {
              if (p.parentId === currentId && !visited.has(p.id)) {
                stack.push(p.id);
              }
            });
          }

          return {
            pages: restoredPages,
          };
        });

        persistPageSnapshots(get().pages, restoredIds);

        return {
          ok: true,
          pageTitle,
          notebookName,
          parentTitles,
          restoredCount,
          itemLabel,
        };
      },

      duplicatePage: (id) => {
        flushEditorContent();

        const sourcePage = get().pages[id];
        const notebook = sourcePage
          ? useNotebooks.getState().notebooks[sourcePage.workspaceId]
          : undefined;
        if (notebook?.source === "local-folder") {
          return id;
        }

        let newId = "";
        set((state) => {
          const page = state.pages[id];
          if (!page) return state;

          newId = uuidv4();
          const now = Date.now();

          // 复制内容并在标题后添加 " 副本"
          const clonedContent = JSON.parse(JSON.stringify(page.content));
          if (
            clonedContent.content?.[0]?.type === "heading" &&
            clonedContent.content[0].attrs?.level === 1
          ) {
            const titleNode = clonedContent.content[0];
            const titleText = extractTitleFromContent(page.content);
            titleNode.content = [{ type: "text", text: `${titleText} 副本` }];
          }

          const newPage: Page = {
            ...page,
            id: newId,
            content: clonedContent,
            updatedAt: now,
            createdAt: now,
            trashedAt: undefined,
            isFavorite: false,
            isPinned: false,
            pinnedAt: undefined,
            order: now,
          };

          return {
            pages: {
              ...state.pages,
              [newId]: newPage,
            },
          };
        });
        persistPageSnapshot(get().pages[newId]);
        return newId;
      },

      permanentlyDeletePage: async (id) => {
        const page = get().pages[id];
        const notebook = page
          ? useNotebooks.getState().notebooks[page.workspaceId]
          : undefined;
        const isLocalFolder = notebook?.source === "local-folder";

        // 本地模式需要确认对话框
	        if (isLocalFolder && notebook?.localPath) {
	          if (typeof window === "undefined" || !window.gooseFs) return;
	          if (!page) return;
          const snapshotPages = get().pages;

	          const resolvePathFromId = (pageId: string) => {
            const prefix = `local-${page.workspaceId}-`;
            if (!pageId.startsWith(prefix)) return null;
            const encoded = pageId.slice(prefix.length);
            try {
              const relativePath = decodeURIComponent(encoded);
              return `${notebook.localPath}/${relativePath}`;
            } catch {
              return null;
            }
          };

          const targetPath = page.localFilePath || resolvePathFromId(id);
          if (!targetPath) return;

          const confirmed = confirm(
            page.isFolder
              ? `确定要删除本地文件夹 "${getPageTitle(page)}" 及其内容吗？将移入系统回收站。`
              : `确定要删除本地文件 "${getPageTitle(page)}" 及其对应的文件吗？将移入系统回收站。`,
          );
          if (!confirmed) return;

          const removedIds = new Set<string>();
          const stack = [id];
          while (stack.length) {
            const currentId = stack.pop()!;
            removedIds.add(currentId);
            Object.values(get().pages).forEach((p) => {
              if (p.parentId === currentId) stack.push(p.id);
            });
          }

          const deleted = page.isFolder
            ? await window.gooseFs.deleteDir(targetPath)
            : await window.gooseFs.deleteFile(targetPath);
          if (!deleted) return;

	          set((state) => {
            const newPages = { ...state.pages };
            removedIds.forEach((pid) => delete newPages[pid]);

            let nextActivePageId = state.activePageId;
            if (removedIds.has(state.activePageId || "")) {
              nextActivePageId = null;
              // 同步清理 Notebook 中记录的最后活跃页面
              useNotebooks.getState().setLastActivePage(page.workspaceId, null);
            }

            return {
              pages: newPages,
              activePageId: nextActivePageId,
            };
          });
          removePersistedPageSnapshots(snapshotPages, removedIds);
          return;
        }

        const targetPage = get().pages[id];
        set((state) => {
          const page = state.pages[id];
          if (!page) return state;
          const workspaceId = page.workspaceId;
          const deletingTrashedPage = !!page.trashedAt;
          const newPages = { ...state.pages };
          delete newPages[id];

          let newActivePageId = state.activePageId;
          if (state.activePageId === id) {
            if (deletingTrashedPage) {
              const trashedPagesAfterDelete = Object.values(newPages)
                .filter((p) => p.workspaceId === workspaceId && !!p.trashedAt)
                .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));

              if (trashedPagesAfterDelete.length > 0) {
                const trashedPagesBeforeDelete = Object.values(state.pages)
                  .filter((p) => p.workspaceId === workspaceId && !!p.trashedAt)
                  .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));

                const deletedPageIndex = trashedPagesBeforeDelete.findIndex(
                  (p) => p.id === id,
                );
                const safeCurrentIndex = Math.max(deletedPageIndex, 0);
                const nextIndex =
                  safeCurrentIndex >= trashedPagesAfterDelete.length
                    ? trashedPagesAfterDelete.length - 1
                    : safeCurrentIndex;

                newActivePageId = trashedPagesAfterDelete[nextIndex].id;
              } else {
                newActivePageId = null;
              }
            } else {
              const siblings = Object.values(newPages)
                .filter(
                  (p) =>
                    p.workspaceId === workspaceId && !p.trashedAt && p.id !== id,
                )
                .sort(
                  (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
                );

              if (siblings.length > 0) {
                const deletedPageIndex = Object.values(state.pages)
                  .filter((p) => p.workspaceId === workspaceId && !p.trashedAt)
                  .sort(
                    (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
                  )
                  .findIndex((p) => p.id === id);

                const nextIndex =
                  deletedPageIndex >= siblings.length
                    ? siblings.length - 1
                    : deletedPageIndex;
                newActivePageId = siblings[nextIndex].id;
              } else {
                newActivePageId = null;
              }
            }
          }

          return {
            pages: newPages,
            activePageId: newActivePageId,
          };
        });
        removePersistedPageSnapshot(targetPage, id);
      },

      reorderPages: (ids, parentId) => {
        set((state) => {
          const newPages = { ...state.pages };

          ids.forEach((id, index) => {
            if (newPages[id]) {
              newPages[id] = {
                ...newPages[id],
                parentId: parentId,
                order: index,
                updatedAt: Date.now(),
              };
            }
          });

          return { pages: newPages };
        });
        persistPageSnapshots(get().pages, ids);
      },

      reorderFavorites: (ids) => {
        set((state) => {
          const newPages = { ...state.pages };
          const now = Date.now();

          ids.forEach((id, index) => {
            if (!newPages[id]) return;
            newPages[id] = {
              ...newPages[id],
              favoriteOrder: index,
              updatedAt: now,
            };
          });

          return { pages: newPages };
        });
        persistPageSnapshots(get().pages, ids);
      },

      movePageTreeToNotebook: (pageId, targetNotebookId) => {
        flushEditorContent(true);

        const snapshotPages = get().pages;
        const sourcePage = snapshotPages[pageId];
        if (!sourcePage || sourcePage.trashedAt) {
          return {
            ok: false,
            movedCount: 0,
            reason: "page-not-found",
          };
        }

        const sourceNotebookId = sourcePage.workspaceId;
        const notebooksStore = useNotebooks.getState();
        const sourceNotebook = notebooksStore.notebooks[sourceNotebookId];
        const targetNotebook = notebooksStore.notebooks[targetNotebookId];

        if (!sourceNotebook || sourceNotebook.source === "local-folder") {
          return {
            ok: false,
            movedCount: 0,
            reason: "source-not-supported",
          };
        }

        if (!targetNotebook || targetNotebook.source === "local-folder") {
          return {
            ok: false,
            movedCount: 0,
            reason: "target-not-supported",
          };
        }

        if (sourceNotebookId === targetNotebookId) {
          return {
            ok: false,
            movedCount: 0,
            reason: "same-notebook",
          };
        }

        const movedIds: string[] = [];
        const movedIdSet = new Set<string>();
        const stack = [pageId];

        while (stack.length) {
          const currentId = stack.pop()!;
          if (movedIdSet.has(currentId)) continue;
          const currentPage = snapshotPages[currentId];
          if (!currentPage || currentPage.trashedAt) continue;
          movedIdSet.add(currentId);
          movedIds.push(currentId);

          Object.values(snapshotPages).forEach((p) => {
            if (!p.trashedAt && p.parentId === currentId && !movedIdSet.has(p.id)) {
              stack.push(p.id);
            }
          });
        }

        if (movedIds.length === 0) {
          return {
            ok: false,
            movedCount: 0,
            reason: "empty-tree",
          };
        }

        const now = Date.now();
        const targetTopLevelOrders = Object.values(snapshotPages)
          .filter(
            (p) =>
              !p.trashedAt &&
              p.workspaceId === targetNotebookId &&
              p.parentId === undefined,
          )
          .map((p) => p.order ?? p.createdAt);
        const maxTopLevelOrder =
          targetTopLevelOrders.length > 0
            ? Math.max(...targetTopLevelOrders)
            : now - 1;
        const rootOrder = maxTopLevelOrder + 1;

        const activeNotebookId = notebooksStore.activeNotebookId;
        const activePageId = get().activePageId;
        const shouldFallbackActive =
          !!activePageId &&
          movedIdSet.has(activePageId) &&
          activeNotebookId === sourceNotebookId;

        let nextActivePageId: string | null = activePageId;
        if (shouldFallbackActive) {
          const remainingPages = Object.values(snapshotPages)
            .filter(
              (p) =>
                !p.trashedAt &&
                p.workspaceId === sourceNotebookId &&
                !movedIdSet.has(p.id),
            )
            .sort((a, b) => {
              const valA = a.order ?? a.createdAt;
              const valB = b.order ?? b.createdAt;
              if (valA !== valB) return valA - valB;
              return a.id.localeCompare(b.id);
            });
          nextActivePageId = remainingPages[0]?.id ?? null;
        }

        set((state) => {
          const newPages = { ...state.pages };

          movedIds.forEach((id) => {
            const current = newPages[id];
            if (!current || current.trashedAt) return;

            newPages[id] = {
              ...current,
              workspaceId: targetNotebookId,
              parentId: id === pageId ? undefined : current.parentId,
              order: id === pageId ? rootOrder : current.order,
              updatedAt: now,
            };
          });

          return {
            pages: newPages,
            activePageId: shouldFallbackActive ? nextActivePageId : state.activePageId,
          };
        });

        persistPageSnapshots(get().pages, movedIds);

        if (shouldFallbackActive) {
          notebooksStore.setLastActivePage(sourceNotebookId, nextActivePageId);
        }

        return {
          ok: true,
          movedCount: movedIds.length,
          sourceNotebookId,
          targetNotebookId,
        };
      },

      setActivePage: async (id) => {
        const previousActivePageId = get().activePageId;
        flushEditorContent(true);
        if (previousActivePageId) {
          await get().flushPendingLocalSaveByPageId(previousActivePageId);
        }

        if (!id) {
          set({ activePageId: null });
          return;
        }

        const page = get().pages[id];
        if (!page) {
          set({ activePageId: id });
          return;
        }

        let newContent = page.content;
        const notebook = useNotebooks.getState().notebooks[page.workspaceId];

        // 本地文件页面：切换时重新从磁盘读取内容
        if (
          notebook?.source === "local-folder" &&
          page.localFilePath &&
          !page.isFolder &&
          window.gooseFs
        ) {
          try {
            let markdownContent = "";
            if (window.gooseFs.readFileAsync) {
              markdownContent =
                (await window.gooseFs.readFileAsync(
                  page.localFilePath,
                )) || "";
            } else {
              markdownContent =
                window.gooseFs.readFile(page.localFilePath) || "";
            }
            const imported = importFromMarkdown(markdownContent);
            if (imported.content) {
              newContent = imported.content;
            }
          } catch (e) {
            console.error("Failed to read local file", e);
          }
        }

        set((state) => {
          const currentPage = state.pages[id];
          if (!currentPage) return { activePageId: id };

          return {
            activePageId: id,
            pages: {
              ...state.pages,
              [id]: {
                ...currentPage,
                content: newContent,
              },
            },
          };
        });

        const notebookId = useNotebooks.getState().activeNotebookId;
        if (notebookId) {
          useNotebooks.getState().setLastActivePage(notebookId, id);
        }
      },

      setPendingNavigatePageId: (id) => {
        set({ pendingNavigatePageId: id });
      },

      setExpandPageId: (id) => {
        set({ expandPageId: id });
      },

      setSearchHighlightQuery: (query) => {
        set({ searchHighlightQuery: query });
      },
      setSearchHighlightPageId: (id) => {
        set({ searchHighlightPageId: id });
      },
      setSearchHighlightNonce: (nonce) => {
        set({ searchHighlightNonce: nonce });
      },
      setHandledSearchHighlightNonce: (nonce) => {
        set({ handledSearchHighlightNonce: nonce });
      },

      setLastSavedAt: (timestamp) => {
        set({ lastSavedAt: timestamp });
      },

      getAncestorIds: (pageId) => {
        const pages = get().pages;
        const ancestorIds: string[] = [];
        let current = pages[pageId];
        while (current && current.parentId && pages[current.parentId]) {
          ancestorIds.push(current.parentId);
          current = pages[current.parentId];
        }
        return ancestorIds;
      },

      setHydrated: (hydrated) => {
        set({ hydrated });
      },

      getPage: (id) => get().pages[id],

      getChildren: (parentId, workspaceId) => {
        const pages = get().pages;
        return Object.values(pages)
          .filter((p) => {
            const matchParent = p.parentId === parentId && !p.trashedAt;
            const matchWorkspace = workspaceId
              ? p.workspaceId === workspaceId
              : true;
            return matchParent && matchWorkspace;
          })
          .sort((a, b) => {
            const valA = a.order ?? a.createdAt;
            const valB = b.order ?? b.createdAt;
            if (valA !== valB) return valA - valB;
            return a.id.localeCompare(b.id);
          });
      },

      getTrashedPages: (workspaceId) => {
        const pages = get().pages;
        return Object.values(pages)
          .filter((p) => {
            const isTrashed = !!p.trashedAt;
            const matchWorkspace = workspaceId
              ? p.workspaceId === workspaceId
              : true;
            return isTrashed && matchWorkspace;
          })
          .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
      },

      getFavorites: (workspaceId) => {
        const pages = get().pages;
        return Object.values(pages)
          .filter((p) => {
            const isFavorite = p.isFavorite;
            const matchWorkspace = workspaceId
              ? p.workspaceId === workspaceId
              : true;
            return isFavorite && matchWorkspace;
          })
          .sort((a, b) => {
            const orderA = a.favoriteOrder ?? a.order ?? a.createdAt;
            const orderB = b.favoriteOrder ?? b.order ?? b.createdAt;
            if (orderA !== orderB) return orderA - orderB;
            return a.id.localeCompare(b.id);
          });
      },

      getPinnedPages: () => {
        const pages = get().pages;
        return Object.values(pages)
          .filter((p) => !p.trashedAt && p.isPinned)
          .sort((a, b) => {
            const pinA = a.pinnedAt ?? 0;
            const pinB = b.pinnedAt ?? 0;
            if (pinA !== pinB) return pinB - pinA;
            return b.updatedAt - a.updatedAt;
          });
      },

      removePagesByWorkspaceId: (workspaceId, options) => {
        const snapshotPages = get().pages;
        const removedIds = Object.values(snapshotPages)
          .filter((page) => page.workspaceId === workspaceId)
          .map((page) => page.id);

        set((state) => {
          const newPages = { ...state.pages };
          Object.values(state.pages).forEach((page) => {
            if (page.workspaceId === workspaceId) {
              delete newPages[page.id];
            }
          });

          const activePage = state.activePageId
            ? state.pages[state.activePageId]
            : null;
          const nextActivePageId =
            activePage?.workspaceId === workspaceId ? null : state.activePageId;

          return {
            pages: newPages,
            activePageId: nextActivePageId,
          };
        });

        if (options?.purgePersistence) {
          removePersistedPageSnapshots(snapshotPages, removedIds);
        }
      },

      // 本地文件夹相关函数
      loadLocalFolderPages: async (notebookId, basePath, options) => {
        if (typeof window === "undefined" || !window.gooseFs) return;

        const previousActivePageId = get().activePageId;
        const previousActivePage = previousActivePageId
          ? get().pages[previousActivePageId]
          : undefined;
        const previousActiveInNotebook =
          previousActivePage?.workspaceId === notebookId
            ? previousActivePageId
            : null;
        useNotebooks.getState().setLocalFolderLoadState(notebookId, {
          status: "loading",
          startedAt: Date.now(),
        });

        // 备份当前页面元数据到缓存
        // 注意：只在存在页面时更新缓存，以防在快速连续调用时（此时 store 可能已被清空）覆盖了有效的缓存
        const currentPages = get().pages;
        const hasExistingPages = Object.values(currentPages).some(
          (p) => p.workspaceId === notebookId,
        );
        
        if (hasExistingPages) {
          Object.values(currentPages).forEach((p) => {
            if (p.workspaceId === notebookId) {
              localPageMetadataCache.set(p.id, {
                isFavorite: p.isFavorite,
                favoriteOrder: p.favoriteOrder,
                icon: p.icon,
                isPinned: p.isPinned,
                pinnedAt: p.pinnedAt,
              });
            }
          });
        }

        get().removePagesByWorkspaceId(notebookId);
        try {
          const localPages = await scanLocalFolderPages({
            notebookId,
            basePath,
            gooseFs: window.gooseFs,
          });

          set((state) => {
            const updated = {
              ...state.pages,
              ...localPages.reduce(
                (acc, page) => {
                  // 尝试从缓存中恢复元数据
                  const existing = localPageMetadataCache.get(page.id);
                  if (existing) {
                    if (existing.isFavorite !== undefined) {
                      page.isFavorite = existing.isFavorite;
                    }
                    if (existing.favoriteOrder !== undefined) {
                      page.favoriteOrder = existing.favoriteOrder;
                    }
                    if (existing.icon) {
                      page.icon = existing.icon;
                    }
                    if (existing.isPinned !== undefined) {
                      page.isPinned = existing.isPinned;
                    }
                    if (existing.pinnedAt !== undefined) {
                      page.pinnedAt = existing.pinnedAt;
                    }
                  }

                  acc[page.id] = page;
                  return acc;
                },
                {} as Record<string, Page>,
              ),
            };

            // Handle navigation priority:
            // 1. Pending cross-notebook navigation (highest priority)
            // 2. Restore last active page for this notebook
            // 3. Default to first page (for non-local folders)
            const { pendingNavigatePageId } = state;
            const result: any = { pages: updated };
            let nextActivePageId = state.activePageId;
            let handledNavigation = false;

            // 1. Try Pending Navigation
            if (pendingNavigatePageId && updated[pendingNavigatePageId]) {
              nextActivePageId = pendingNavigatePageId;
              result.activePageId = nextActivePageId;
              result.expandPageId = nextActivePageId;
              result.pendingNavigatePageId = null;
              handledNavigation = true;
            }

            // 2 & 3. If no pending navigation, check if we need to restore/init active page
            if (!handledNavigation) {
              const activeNotebookId = useNotebooks.getState().activeNotebookId;
              // Only update if this is the active notebook
              if (activeNotebookId === notebookId) {
                const autoOpenLastNote =
                  typeof window !== "undefined"
                    ? (window as any).__gooseNoteAutoOpenLastNote !== false
                    : true;
                const allowAutoRestore = autoOpenLastNote === true;
                const notebook = useNotebooks.getState().notebooks[notebookId];
                const isLocalFolder = notebook?.source === "local-folder";

                if (allowAutoRestore || !isLocalFolder) {
                  const lastActivePageId = useNotebooks
                    .getState()
                    .getLastActivePage(notebookId);
                  const pageIdSet = new Set(localPages.map((p) => p.id));

                  if (lastActivePageId && pageIdSet.has(lastActivePageId)) {
                    nextActivePageId = lastActivePageId;
                  } else if (
                    previousActiveInNotebook &&
                    pageIdSet.has(previousActiveInNotebook)
                  ) {
                    nextActivePageId = previousActiveInNotebook;
                  } else if (!isLocalFolder) {
                    const firstPage = localPages
                      .filter((p) => !p.trashedAt)
                      .sort(
                        (a, b) =>
                          (a.order ?? a.createdAt) -
                          (b.order ?? b.createdAt),
                      )[0];
                    if (firstPage) {
                      nextActivePageId = firstPage.id;
                    }
                  }

                  if (nextActivePageId !== state.activePageId) {
                    result.activePageId = nextActivePageId;
                  }
                }
              }
            }

            if (options?.showWelcome) {
              result.activePageId = null;
              result.expandPageId = null;
              result.pendingNavigatePageId = null;
            }

            // Sync to Notebook store
            const hasActivePageUpdate = Object.prototype.hasOwnProperty.call(
              result,
              "activePageId",
            );
            const currentActive = hasActivePageUpdate
              ? result.activePageId
              : state.activePageId;
            const activeNotebookId = useNotebooks.getState().activeNotebookId;
            if (activeNotebookId === notebookId && currentActive) {
              useNotebooks.getState().setLastActivePage(notebookId, currentActive);
            }

            return result;
          });
        } finally {
          useNotebooks.getState().setLocalFolderLoadState(notebookId, {
            status: "ready",
            finishedAt: Date.now(),
          });
        }
      },

      writePageContent: async (pageId, content, _mode = "replace") => {
        const page = get().pages[pageId];
        if (!page || page.isFolder) return false;

        get().updatePage(pageId, {
          content: clonePageContent(content),
        });

        if (isLocalFolderPage(page)) {
          await get().flushPendingLocalSaveByPageId(pageId);
        }

        return true;
      },

      appendPageContent: async (pageId, content) => {
        const page = get().pages[pageId];
        if (!page || page.isFolder) return false;

        const mergedContent = mergePageContent(
          clonePageContent(page.content),
          clonePageContent(content),
        );

        return await get().writePageContent(pageId, mergedContent);
      },

      saveLocalPageContent: async (pageId, content) => {
        if (typeof window === "undefined" || !window.gooseFs)
          return false;

        const page = get().pages[pageId];
        if (!page) return false;

        const filePath = get().getLocalFilePath(pageId);
        if (!filePath) return false;

        // 使用 export.ts 中的 jsonContentToMarkdown 函数进行完整转换
        // 这里需要实现图片资源处理逻辑
        const processedContent = content;

        // 处理图片资源：将 base64 图片保存到 assets 文件夹
        const assetsDir = filePath.replace(/[^\/\\]+$/, "") + "assets";
        // 简单处理：尝试创建文件夹（如果不存在）
        try {
           if (window.gooseFs.mkdir) {
              await window.gooseFs.mkdir(assetsDir);
           }
        } catch {}

        // 遍历内容中的图片节点
        // Async processing needed if we want to write files asynchronously
        // But traversing JSON is sync.
        // We collect write promises.
        const writePromises: Promise<any>[] = [];

        const processImages = (nodes: any[]) => {
          nodes.forEach((node) => {
            if (
              (node.type === "image" || node.type === "imageResize") &&
              node.attrs?.src?.startsWith("data:image")
            ) {
              const match = node.attrs.src.match(
                /^data:(image\/([a-zA-Z+]+));base64,(.+)$/,
              );
              if (match) {
                const ext = match[2] === "jpeg" ? "jpg" : match[2];
                const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
                const imagePath = `${assetsDir}/${filename}`;

                // 保存图片文件（base64 数据）
                if (window.gooseFs?.writeFileAsync) {
                     writePromises.push(window.gooseFs.writeFileAsync(imagePath, match[3], "base64"));
                } else {
                     window.gooseFs?.writeFile(imagePath, match[3]);
                }

                // 更新节点中的图片路径为相对路径
                node.attrs.src = `./assets/${filename}`;
              }
            }
            if (node.content) {
              processImages(node.content);
            }
          });
        };

        if (processedContent.content) {
          processImages(processedContent.content);
        }
        
        // Wait for images to be written
        if (writePromises.length > 0) {
            await Promise.all(writePromises);
        }

        const markdownContent = jsonContentToMarkdown(processedContent);

        // 数据完整性保护
        // Note: Async read for integrity check?
        // Browsers might not support sync read.
        // For now, in browser, we skip this integrity check or rely on async read.
        // Let's implement async read check.
        if (!markdownContent.trim()) {
            let exists = false;
            // exists check might be sync mock in browser
            try { exists = window.gooseFs?.exists(filePath) ?? false; } catch {}
            
            if (exists) {
                 let oldContent = "";
                 if (window.gooseFs?.readFileAsync) {
                     oldContent = await window.gooseFs.readFileAsync(filePath) || "";
                 } else {
                     oldContent = window.gooseFs?.readFile(filePath) || "";
                 }
                 
                 if (oldContent && oldContent.trim().length > 10) {
                    console.error("[Data Integrity] Refusing to save empty content.");
                    return false;
                 }
            }
        }

        let result: boolean;
        if (window.gooseFs?.writeFileAsync) {
             result = await window.gooseFs.writeFileAsync(filePath, markdownContent);
        } else {
             result = window.gooseFs?.writeFile(filePath, markdownContent) ?? false;
        }

        if (result) {
          set({ lastSavedAt: Date.now() });
        }
        return result;
      },

      flushPendingLocalSaveByPageId: async (pageId) => {
        await flushPendingLocalSaveByPageIdInternal(pageId, get);
      },

      flushPendingLocalSaves: async () => {
        await flushAllPendingLocalSavesInternal(get);
      },

      getLocalFilePath: (pageId) => {
        const page = get().pages[pageId];
        return page?.localFilePath || null;
      },
    }),
);

const setupImageStorageResolver = async () => {
  const { imageStorage } = await import("@/lib/imageStorage");
  imageStorage.setLocalFolderAccessResolver(() => {
    const activePageId = usePages.getState().activePageId;
    if (!activePageId) return null;

    const page = usePages.getState().pages[activePageId];
    if (!page) return null;

    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    return notebook?.source === "local-folder" ? notebook.localPath : null;
  });
};

void setupImageStorageResolver();
