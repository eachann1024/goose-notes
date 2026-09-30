import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  comparisonLocalPath,
  localPathsAreCaseInsensitive,
} from "@/lib/canonicalLocalPath";
import { localStorageAdapter } from "@/lib/storage";
import { removeLocalPageMetaByWorkspaceId } from "@/lib/storage/pageRepository";
import { removeLocalFolderOrders } from "./localFolderOrder";
import { fs } from "@/lib/electron-platform/fs";
import { persistPageSnapshots } from "./pages/persistence";
import { useSettings } from "./useSettings";
import { usePages } from "./usePages";
import { effectiveSingleTabMode } from "@/lib/tabMode";

export interface Notebook {
  id: string;
  name: string;
  icon?: string; // emoji 或 Lucide 图标名
  createdAt: number;
  updatedAt: number;
  /** 用户自定义排序；缺省时回退 createdAt */
  order?: number;
  source?: "default" | "local-folder";
  localPath?: string; // 本地文件夹路径
  localPathMissing?: boolean;
  /** 开启后不出现在「所有记事本」全局搜索；当前本搜索仍可见 */
  excludeFromGlobalSearch?: boolean;
}

/** 按 order（缺省 createdAt）升序；同值再用 createdAt 稳定排序 */
export function sortNotebooksByOrder(
  notebooks: Record<string, Notebook>,
): Notebook[] {
  return Object.values(notebooks).sort((a, b) => {
    const orderA = a.order ?? a.createdAt;
    const orderB = b.order ?? b.createdAt;
    if (orderA !== orderB) return orderA - orderB;
    return a.createdAt - b.createdAt;
  });
}

function nextNotebookOrder(notebooks: Record<string, Notebook>): number {
  const list = Object.values(notebooks);
  if (list.length === 0) return 0;
  return Math.max(...list.map((n) => n.order ?? n.createdAt)) + 1;
}

export type LocalFolderLoadStatus = "idle" | "loading" | "ready" | "error";

export interface LocalFolderLoadState {
  status: LocalFolderLoadStatus;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

const IDLE_LOCAL_FOLDER_LOAD_STATE: LocalFolderLoadState = {
  status: "idle",
};

interface NotebooksState {
  notebooks: Record<string, Notebook>;
  activeNotebookId: string | null;
  lastActivePageByNotebook: Record<string, string | null>;
  localFolderLoadStates: Record<string, LocalFolderLoadState>;

  createNotebook: (
    name?: string,
    icon?: string,
    overrideIfExists?: boolean,
    customId?: string,
  ) => string;
  createLocalFolderNotebook: (name: string, localPath: string) => string;
  updateNotebook: (
    id: string,
    updates: Partial<Omit<Notebook, "id" | "createdAt">>,
  ) => void;
  deleteNotebook: (id: string) => void;
  reorderNotebooks: (orderedIds: string[]) => void;
  setActiveNotebook: (id: string) => void;
  getNotebook: (id: string) => Notebook | undefined;
  setLastActivePage: (notebookId: string, pageId: string | null) => void;
  getLastActivePage: (notebookId: string) => string | null;
  setLocalFolderLoadState: (
    notebookId: string,
    state: LocalFolderLoadState,
  ) => void;
  getLocalFolderLoadState: (notebookId: string) => LocalFolderLoadState;
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 默认记事本
const DEFAULT_NOTEBOOK_ID = "default-notebook";

// Electron 桌面端为「仅本地文件夹」模式：无内置笔记本，数据层不种 default-notebook。
// 单元测试没有 vite define，用 typeof 兜底避免模块加载即 ReferenceError。
const isElectronHost =
  typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron";

export const useNotebooks = create<NotebooksState>()(
  persist(
    (set, get) => ({
      notebooks: isElectronHost
        ? ({} as Record<string, Notebook>)
        : {
            [DEFAULT_NOTEBOOK_ID]: {
              id: DEFAULT_NOTEBOOK_ID,
              name: "Note",
              icon: "BookOpen",
              order: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
      activeNotebookId: isElectronHost ? null : DEFAULT_NOTEBOOK_ID,
      lastActivePageByNotebook: {},
      localFolderLoadStates: {},

      createNotebook: (
        name = "Note",
        icon = "BookOpen",
        overrideIfExists = false,
        customId?: string,
      ) => {
        // Electron 仅本地文件夹模式：拒绝创建内置记事本
        if (isElectronHost) return "";
        const dupNotebook = overrideIfExists
          ? Object.values(get().notebooks).find(
              (n) => (customId && n.id === customId) || n.name === name,
            )
          : null;

        const finalId = customId ?? generateId();

        if (dupNotebook) {
          const now = Date.now();
          const batchId = `b-${now}-${dupNotebook.id}`;
          const pagesStore = usePages.getState();
          const notebookPages = Object.values(pagesStore.pages).filter(
            (p) => p.workspaceId === dupNotebook.id,
          );

          if (notebookPages.length > 0) {
            const nextPages = { ...pagesStore.pages };
            const changedIds: string[] = [];

            notebookPages.forEach((page) => {
              if (page.trashedAt) {
                nextPages[page.id] = {
                  ...page,
                  workspaceId: finalId,
                };
              } else {
                nextPages[page.id] = {
                  ...page,
                  workspaceId: finalId,
                  trashedAt: now,
                  trashBatchId: batchId,
                  isFavorite: false,
                  isPinned: false,
                  pinnedAt: undefined,
                };
              }
              changedIds.push(page.id);
            });

            usePages.setState({ pages: nextPages });
            persistPageSnapshots(nextPages, changedIds);
          }

          const { [dupNotebook.id]: _, ...remainingNotebooks } =
            get().notebooks;
          const { [dupNotebook.id]: __, ...remainingLastActive } =
            get().lastActivePageByNotebook;
          const { [dupNotebook.id]: ___, ...remainingLoadStates } =
            get().localFolderLoadStates;

          const notebook: Notebook = {
            id: finalId,
            name,
            icon,
            order: dupNotebook.order ?? nextNotebookOrder(remainingNotebooks),
            createdAt: dupNotebook.createdAt,
            updatedAt: now,
          };

          set({
            notebooks: { ...remainingNotebooks, [finalId]: notebook },
            lastActivePageByNotebook: remainingLastActive,
            localFolderLoadStates: remainingLoadStates,
            activeNotebookId: finalId,
          });

          return finalId;
        }

        // 检查是否存在同名笔记本，生成唯一名称
        const existingNames = new Set(
          Object.values(get().notebooks).map((n) => n.name),
        );

        let finalName = name;
        let suffix = 2;
        const baseName = name;
        while (existingNames.has(finalName)) {
          finalName = `${baseName}(${suffix})`;
          suffix++;
        }

        const currentNotebooks = get().notebooks;
        const notebook: Notebook = {
          id: finalId,
          name: finalName,
          icon,
          order: nextNotebookOrder(currentNotebooks),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const nextNotebooks = { ...currentNotebooks, [finalId]: notebook };
        set({
          notebooks: nextNotebooks,
          activeNotebookId: finalId,
        });
        return finalId;
      },

      createLocalFolderNotebook: (name, localPath) => {
        const pagesStore = usePages.getState();
        const caseInsensitive = localPathsAreCaseInsensitive();
        const targetPath = comparisonLocalPath(localPath, caseInsensitive);
        const existing = Object.values(get().notebooks).find(
          (notebook) =>
            notebook.source === "local-folder" &&
            typeof notebook.localPath === "string" &&
            comparisonLocalPath(notebook.localPath, caseInsensitive) ===
              targetPath,
        );
        if (existing) {
          set((state) => ({
            notebooks: {
              ...state.notebooks,
              [existing.id]: {
                ...existing,
                name,
                localPathMissing: false,
                updatedAt: Date.now(),
              },
            },
            activeNotebookId: existing.id,
          }));
          const lastActivePageId = get().lastActivePageByNotebook[existing.id];
          const lastActivePage = lastActivePageId
            ? pagesStore.pages[lastActivePageId]
            : undefined;
          void pagesStore.setActivePage(
            lastActivePage?.workspaceId === existing.id &&
              !lastActivePage.trashedAt
              ? lastActivePage.id
              : null,
          );
          return existing.id;
        }

        const id = generateId();
        const currentNotebooks = get().notebooks;
        const notebook: Notebook = {
          id,
          name,
          icon: "FolderOpen",
          source: "local-folder",
          localPath,
          localPathMissing: false,
          order: nextNotebookOrder(currentNotebooks),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const nextNotebooks = { ...currentNotebooks, [id]: notebook };
        set({
          notebooks: nextNotebooks,
          activeNotebookId: id,
        });
        // 新本尚没有可复用的页面缓存，必须立即离开旧本编辑器；不能等异步
        // scan 的 showWelcome 收尾才清空，否则新库加载期间会短暂显示旧库正文。
        void pagesStore.setActivePage(null);
        return id;
      },

      updateNotebook: (id, updates) => {
        set((state) => {
          const notebook = state.notebooks[id];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [id]: { ...notebook, ...updates, updatedAt: Date.now() },
            },
          };
        });
      },

      reorderNotebooks: (orderedIds) => {
        set((state) => {
          const nextNotebooks = { ...state.notebooks };
          let changed = false;
          orderedIds.forEach((id, index) => {
            const notebook = nextNotebooks[id];
            if (!notebook || notebook.order === index) return;
            nextNotebooks[id] = { ...notebook, order: index };
            changed = true;
          });
          return changed ? { notebooks: nextNotebooks } : state;
        });
      },

      deleteNotebook: (id) => {
        const state = get();
        const notebookCount = Object.keys(state.notebooks).length;
        // 桌面端允许移除最后一个文件夹（回到空态）；Electron 至少保留一本。
        if (!isElectronHost && notebookCount <= 1) return;
        const deletedNotebook = state.notebooks[id];

        const pagesStore = usePages.getState();
        const tabsStore = useTabs.getState();
        const deletedPageIds = new Set(
          Object.values(pagesStore.pages)
            .filter((page) => page.workspaceId === id)
            .map((page) => page.id),
        );
        const remainingPages = Object.values(pagesStore.pages).filter(
          (page) => page.workspaceId !== id && !page.trashedAt,
        );
        const remainingPageById = new Map(
          remainingPages.map((page) => [page.id, page]),
        );

        const { [id]: _deletedNotebook, ...remainingNotebooks } =
          state.notebooks;
        const { [id]: _deletedLastActive, ...remainingLastActive } =
          state.lastActivePageByNotebook;
        const { [id]: _deletedLoadState, ...remainingLoadStates } =
          state.localFolderLoadStates;

        let remainingTabs = tabsStore.openTabs.filter(
          (tab) => !deletedPageIds.has(tab.pageId),
        );
        if (effectiveSingleTabMode() && remainingTabs.length > 1) {
          const active = remainingTabs.find(
            (tab) => tab.id === tabsStore.activeTabId,
          );
          remainingTabs = active ? [active] : [remainingTabs[0]];
        }
        const nextActiveTabId =
          tabsStore.activeTabId &&
          remainingTabs.some((tab) => tab.id === tabsStore.activeTabId)
            ? tabsStore.activeTabId
            : (remainingTabs[0]?.id ?? null);
        const nextActiveTab = remainingTabs.find(
          (tab) => tab.id === nextActiveTabId,
        );
        const nextTabPage = nextActiveTab
          ? remainingPageById.get(nextActiveTab.pageId)
          : undefined;

        const remainingNotebookIds = Object.keys(remainingNotebooks);
        const nextActiveNotebookId =
          nextTabPage?.workspaceId ??
          (state.activeNotebookId === id
            ? remainingNotebookIds[0] || null
            : state.activeNotebookId);

        let nextActivePageId =
          nextTabPage?.id ??
          (pagesStore.activePageId &&
          !deletedPageIds.has(pagesStore.activePageId)
            ? pagesStore.activePageId
            : null);

        if (!nextActivePageId && nextActiveNotebookId) {
          const nextLastPageId = remainingLastActive[nextActiveNotebookId];
          if (nextLastPageId && remainingPageById.has(nextLastPageId)) {
            nextActivePageId = nextLastPageId;
          } else {
            const firstValidPage = remainingPages
              .filter((page) => page.workspaceId === nextActiveNotebookId)
              .sort(
                (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
              )[0];
            nextActivePageId = firstValidPage?.id ?? null;
          }
        }

        pagesStore.removePagesByWorkspaceId(id, { purgePersistence: true });
        if (deletedNotebook?.source === "local-folder") {
          removeLocalPageMetaByWorkspaceId(id);
          removeLocalFolderOrders(id);
        }
        useTabs.setState({
          openTabs: remainingTabs,
          activeTabId: nextActiveTabId,
        });
        set({
          notebooks: remainingNotebooks,
          lastActivePageByNotebook: remainingLastActive,
          localFolderLoadStates: remainingLoadStates,
          activeNotebookId: nextActiveNotebookId,
        });

        if (
          state.activeNotebookId === id ||
          deletedPageIds.has(pagesStore.activePageId || "") ||
          nextActiveTabId !== tabsStore.activeTabId
        ) {
          void pagesStore.setActivePage(nextActivePageId);
        }
      },

      setActiveNotebook: (id) => {
        const pagesStore = usePages.getState();
        const pendingId = pagesStore.pendingNavigatePageId;
        const pendingPage = pendingId ? pagesStore.pages[pendingId] : undefined;
        const notebook = get().notebooks[id];
        const lastActivePageId = get().lastActivePageByNotebook[id];
        const lastActivePage = lastActivePageId
          ? pagesStore.pages[lastActivePageId]
          : undefined;
        // 已经打开过的本地库可立即回到其缓存的上次页面，再在后台重扫。
        // 这条普通的侧栏切库路径没有 pending target，不能因此回退到空白页。
        const cachedLocalLandingPageId =
          notebook?.source === "local-folder" &&
          lastActivePage?.workspaceId === id &&
          !lastActivePage.trashedAt
            ? lastActivePage.id
            : null;
        // 分屏/搜索的跨本导航已明确目标页时，目标页本来就在内存树中。
        // 不能先清 activePage 再在同一链路写回，否则主区会短暂卸载为
        // 空白页；真实重扫若发现目标不存在，loader 仍会在完成时清理它。
        const keepsPendingTarget = pendingPage?.workspaceId === id;
        set({ activeNotebookId: id });
        if (notebook?.source === "local-folder" && !keepsPendingTarget) {
          void pagesStore.setActivePage(cachedLocalLandingPageId);
        }
        if (
          notebook?.source === "local-folder" &&
          notebook.localPath &&
          typeof window !== "undefined" &&
          fs.isAvailable()
        ) {
          void (async () => {
            const exists = await fs.existsAsync(notebook.localPath!);

            if (get().activeNotebookId !== id) return;

            if (exists) {
              if (notebook.localPathMissing) {
                get().updateNotebook(id, { localPathMissing: false });
              }
              await usePages
                .getState()
                .loadLocalFolderPages(id, notebook.localPath!);
            } else {
              if (!notebook.localPathMissing) {
                get().updateNotebook(id, { localPathMissing: true });
              }
              usePages.getState().removePagesByWorkspaceId(id);
            }
          })().catch((error) => {
            console.error("[local-folder] 切换记事本时加载失败", error);
          });
        }

        if (pendingId) {
          if (pendingPage && pendingPage.workspaceId === id) {
            pagesStore.setActivePage(pendingId);
            pagesStore.setExpandPageId(pendingId);

            // 如果是本地文件夹笔记本，且正在重新加载页面，暂不清除 pendingNavigatePageId
            // 让 loadLocalFolderPages 在加载完成后处理（能够确保页面存在且触发展开）
            const isLoadingLocal =
              notebook?.source === "local-folder" &&
              notebook.localPath &&
              typeof window !== "undefined" &&
              fs.isAvailable();

            if (!isLoadingLocal) {
              pagesStore.setPendingNavigatePageId(null);
            }
          }
        }
      },

      getNotebook: (id) => {
        return get().notebooks[id];
      },

      setLastActivePage: (notebookId, pageId) => {
        set((state) => ({
          lastActivePageByNotebook: {
            ...state.lastActivePageByNotebook,
            [notebookId]: pageId,
          },
        }));
      },

      getLastActivePage: (notebookId) => {
        return get().lastActivePageByNotebook[notebookId] || null;
      },

      setLocalFolderLoadState: (notebookId, loadState) => {
        set((state) => ({
          localFolderLoadStates: {
            ...state.localFolderLoadStates,
            [notebookId]: loadState,
          },
        }));
      },

      getLocalFolderLoadState: (notebookId) => {
        return (
          get().localFolderLoadStates[notebookId] ??
          IDLE_LOCAL_FOLDER_LOAD_STATE
        );
      },
    }),
    {
      name: "goose-note-notebooks",
      version: 4,
      storage: createJSONStorage(() => localStorageAdapter),
      partialize: (state) => ({
        notebooks: state.notebooks,
        activeNotebookId: state.activeNotebookId,
        lastActivePageByNotebook: state.lastActivePageByNotebook,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // Electron 仅本地文件夹模式：水合后立刻丢掉内置本（含历史 default-notebook），
        // 绝不回种；activeNotebookId 失效时回空态。
        if (!isElectronHost || !state) return;
        const localOnly = Object.fromEntries(
          Object.entries(state.notebooks).filter(
            ([, notebook]) => notebook.source === "local-folder",
          ),
        );
        const activeValid =
          state.activeNotebookId && localOnly[state.activeNotebookId]
            ? state.activeNotebookId
            : null;
        useNotebooks.setState({
          notebooks: localOnly,
          activeNotebookId: activeValid,
        });
      },
      migrate: (persistedState: unknown) => {
        const safeState = persistedState as
          | {
              notebooks?: Record<string, Notebook>;
              activeNotebookId?: string | null;
              lastActivePageByNotebook?: Record<string, string | null>;
            }
          | undefined;
        if (!safeState?.notebooks) return persistedState;

        const migratedNotebooks = Object.fromEntries(
          Object.entries(safeState.notebooks).map(([id, notebook]) => [
            id,
            (() => {
              const {
                editorFullWidth: _legacyEditorFullWidth,
                ...persistedNotebook
              } = notebook as Notebook & { editorFullWidth?: boolean };
              return {
                ...persistedNotebook,
                icon:
                  id === DEFAULT_NOTEBOOK_ID && notebook.icon === "📓"
                    ? "BookOpen"
                    : notebook.source === "local-folder" && notebook.icon === "📁"
                      ? "FolderOpen"
                      : notebook.icon,
              };
            })(),
          ]),
        );

        // v4：缺 order 的本按 createdAt 升序补 0..n-1
        const sortedForOrder = Object.values(migratedNotebooks).sort(
          (a, b) => a.createdAt - b.createdAt,
        );
        sortedForOrder.forEach((notebook, index) => {
          if (notebook.order === undefined) {
            migratedNotebooks[notebook.id] = { ...notebook, order: index };
          }
        });

        return {
          ...safeState,
          notebooks: migratedNotebooks,
        };
      },
    },
  ),
);

export const DEFAULT_NOTEBOOK = DEFAULT_NOTEBOOK_ID;
