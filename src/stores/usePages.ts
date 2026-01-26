import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { Page, JSONContent } from "@/types";
import { uToolsStorage } from "@/lib/storage";
import { useNotebooks, DEFAULT_NOTEBOOK } from "./useNotebooks";
import { extractTitleFromContent } from "@/lib/content-text-extractor";
import { jsonContentToMarkdown } from "@/lib/export";
import { getPageTitle } from "@/lib/page-title";
import {
  ONBOARDING_PAGE_CONTENT,
  ONBOARDING_CHILD_PAGE_CONTENT,
} from "@/lib/onboarding";

// 防抖保存的映射
const saveTimeouts = new Map<string, NodeJS.Timeout>();

// 本地页面元数据缓存 (用于在重新加载本地文件夹时防止元数据丢失)
const localPageMetadataCache = new Map<
  string,
  { isFavorite?: boolean; icon?: string }
>();

// 辅助函数：生成本地页面ID（基于相对路径的hash）
function generateLocalPageId(notebookId: string, filePath: string): string {
  const notebook = useNotebooks.getState().notebooks[notebookId];
  if (!notebook?.localPath) return uuidv4();

  const relativePath = filePath
    .replace(notebook.localPath, "")
    .replace(/^[\/\\]/, "");
  // 使用 encodeURIComponent 而不是 btoa，避免中文路径报错
  const encoded = encodeURIComponent(relativePath);
  return `local-${notebookId}-${encoded}`;
}

interface PagesState {
  pages: Record<string, Page>;
  activePageId: string | null;
  onboardingCompleted: boolean;
  onboardingExpandPageId: string | null;
  pendingNavigatePageId: string | null;
  expandPageId: string | null;
  searchHighlightQuery: string | null; // 搜索跳转后高亮的关键词
  searchHighlightPageId: string | null;
  searchHighlightNonce: number;
  handledSearchHighlightNonce: number;
  hydrated: boolean;

  createOnboardingPages: () => void;
  createPage: (parentId?: string, workspaceId?: string) => string;
  updatePage: (id: string, updates: Partial<Page>) => void;
  deletePage: (id: string) => boolean;
  restorePage: (id: string) => void;
  duplicatePage: (id: string) => string;
  permanentlyDeletePage: (id: string) => void;
  reorderPages: (ids: string[], parentId: string | undefined) => void;
  setActivePage: (id: string | null) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setOnboardingExpandPageId: (id: string | null) => void;
  setPendingNavigatePageId: (id: string | null) => void;
  setExpandPageId: (id: string | null) => void;
  setSearchHighlightQuery: (query: string | null) => void;
  setSearchHighlightPageId: (id: string | null) => void;
  setSearchHighlightNonce: (nonce: number) => void;
  setHandledSearchHighlightNonce: (nonce: number) => void;
  setHydrated: (hydrated: boolean) => void;
  getAncestorIds: (pageId: string) => string[];

  getPage: (id: string) => Page | undefined;
  getChildren: (parentId?: string, workspaceId?: string) => Page[];
  getTrashedPages: (workspaceId?: string) => Page[];
  getFavorites: (workspaceId?: string) => Page[];
  removePagesByWorkspaceId: (workspaceId: string) => void;

  // 本地文件夹相关函数
  loadLocalFolderPages: (notebookId: string, basePath: string) => Promise<void>;
  saveLocalPageContent: (
    pageId: string,
    content: JSONContent,
  ) => Promise<boolean>;
  getLocalFilePath: (pageId: string) => string | null;
  createLocalPage: (
    parentId?: string,
    workspaceId?: string,
  ) => Promise<string | null> | string | null;
}

const initialContent: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
    },
    {
      type: "paragraph",
    },
  ],
};

export const flushEditorContent = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("goose-note:flush-editor"));
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushEditorContent);

  if ((window as any).utools) {
    (window as any).utools.onPluginOut(flushEditorContent);
  }
}

export const usePages = create<PagesState>()(
  persist(
    (set, get) => ({
      pages: {},
      activePageId: null,
      onboardingCompleted: false,
      onboardingExpandPageId: null,
      pendingNavigatePageId: null,
      expandPageId: null,
      searchHighlightQuery: null,
      searchHighlightPageId: null,
      searchHighlightNonce: 0,
      handledSearchHighlightNonce: 0,
      hydrated: false,

      createOnboardingPages: () => {
        const id = uuidv4();
        const now = Date.now();
        const workspaceId = DEFAULT_NOTEBOOK;

        const mainPage: Page = {
          id,
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

        const childId = uuidv4();
        const childPage: Page = {
          id: childId,
          workspaceId,
          parentId: id,
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

        set((state) => ({
          pages: {
            ...state.pages,
            [id]: mainPage,
            [childId]: childPage,
          },
          activePageId: id,
          onboardingCompleted: true,
          onboardingExpandPageId: id,
        }));

        useNotebooks.getState().setActiveNotebook(workspaceId);
        useNotebooks.getState().setLastActivePage(workspaceId, id);
      },

      createPage: (parentId, workspaceId = DEFAULT_NOTEBOOK) => {
        flushEditorContent();

        const id = uuidv4();
        const now = Date.now();
        const newPage: Page = {
          id,
          workspaceId,
          parentId,
          content: initialContent,
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
          activePageId: id,
        }));

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

      createLocalPage: async (parentId?: string, workspaceId?: string) => {
        if (!workspaceId) return null;
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
        const title = "新页面";
        const parentPath = resolveParentPath();
        const parentPage = parentId ? get().pages[parentId] : undefined;
        const baseDir = parentPath
          ? parentPage?.isFolder
            ? parentPath
            : parentPath.replace(/[^\/\\]+$/, "")
          : notebook.localPath;
        const normalizedBaseDir = baseDir.replace(/[\/\\]$/, "");
        let filePath = `${normalizedBaseDir}/${title}.md`;

        const checkExists = async (path: string) => {
          if (window.gooseFs?.existsAsync) {
            return await window.gooseFs.existsAsync(path);
          }
          return window.gooseFs?.exists(path) ?? false;
        };

        if (await checkExists(filePath)) {
          let suffix = 1;
          while (
            await checkExists(`${normalizedBaseDir}/${title} (${suffix}).md`)
          ) {
            suffix++;
          }
          filePath = `${normalizedBaseDir}/${title} (${suffix}).md`;
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
          parentId,
          content: initialContent,
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
          activePageId: id,
        }));

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

      updatePage: (id, updates) => {
        set((state) => {
          const page = state.pages[id];
          if (!page) return state;

          const updatedPage = { ...page, ...updates, updatedAt: Date.now() };

          // 如果是本地文件夹页面且内容有更新，触发防抖保存
          if (
            updates.content &&
            useNotebooks.getState().notebooks[page.workspaceId]?.source ===
              "local-folder"
          ) {
            // 清除之前的定时器
            const existingTimeout = saveTimeouts.get(id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // 设置新的防抖保存定时器（3秒）
            const timeout = setTimeout(() => {
              get().saveLocalPageContent(id, updates.content!);
              saveTimeouts.delete(id);
            }, 3000);

            saveTimeouts.set(id, timeout);
          }

          return {
            pages: {
              ...state.pages,
              [id]: updatedPage,
            },
          };
        });
      },

      deletePage: (id) => {
        flushEditorContent();
        let deleted = false;

        set((state) => {
          const page = state.pages[id];
          if (!page) return state;

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
            if (!targetPath || !window.gooseFs) return state;

            const confirmed = confirm(
              page.isFolder
                ? `确定要删除文件夹 "${getPageTitle(page)}" 及其内容吗？`
                : `确定要删除文件 "${getPageTitle(page)}" 吗？`,
            );
            if (!confirmed) return state;

            const removedIds = new Set<string>();
            const stack = [id];
            while (stack.length) {
              const currentId = stack.pop()!;
              removedIds.add(currentId);
              Object.values(state.pages).forEach((p) => {
                if (p.parentId === currentId) stack.push(p.id);
              });
            }

            const removeOk = page.isFolder
              ? window.gooseFs.deleteDir(targetPath)
              : window.gooseFs.deleteFile(targetPath);
            if (!removeOk) return state;
            deleted = true;

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
          }

          const workspaceId = page.workspaceId;
          deleted = true;

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
              };
            }
          });

          let newActivePageId = state.activePageId;
          if (removedIds.has(state.activePageId || "")) {
            newActivePageId = null;
            // 清理 Notebook 记录
            useNotebooks.getState().setLastActivePage(workspaceId, null);
          }

          return {
            pages: newPages,
            activePageId: newActivePageId,
          };
        });

        return deleted;
      },

      restorePage: (id) => {
        set((state) => {
          const page = state.pages[id];
          if (!page || !page.trashedAt) return state;

          const trashStamp = page.trashedAt;
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
            order: now,
          };

          return {
            pages: {
              ...state.pages,
              [newId]: newPage,
            },
          };
        });
        return newId;
      },

      permanentlyDeletePage: (id) => {
        const page = get().pages[id];
        const notebook = page
          ? useNotebooks.getState().notebooks[page.workspaceId]
          : undefined;
        const isLocalFolder = notebook?.source === "local-folder";

        // 本地模式需要确认对话框
        if (isLocalFolder && notebook?.localPath) {
          if (typeof window === "undefined" || !window.gooseFs) return;
          if (!page) return;

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
              ? `确定要永久删除 "${getPageTitle(page)}" 及其内容吗？`
              : `确定要永久删除 "${getPageTitle(page)}" 及其对应的文件吗？`,
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
            ? window.gooseFs.deleteDir(targetPath)
            : window.gooseFs.deleteFile(targetPath);
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
          return;
        }

        set((state) => {
          const page = state.pages[id];
          const workspaceId = page?.workspaceId;
          const newPages = { ...state.pages };
          delete newPages[id];

          let newActivePageId = state.activePageId;
          if (state.activePageId === id) {
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

          return {
            pages: newPages,
            activePageId: newActivePageId,
          };
        });
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
      },

      setActivePage: async (id) => {
        flushEditorContent();

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

      setOnboardingCompleted: (completed) => {
        set({ onboardingCompleted: completed });
      },

      setOnboardingExpandPageId: (id) => {
        set({ onboardingExpandPageId: id });
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
          .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
      },

      removePagesByWorkspaceId: (workspaceId) => {
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
      },

      // 本地文件夹相关函数
      loadLocalFolderPages: async (notebookId, basePath) => {
        if (typeof window === "undefined" || !window.gooseFs) return;

        const normalizeLocalFileTitle = (name: string) => {
          const base = name.replace(/\.(md|markdown)$/i, "").trim();
          return base || "无标题";
        };

        const ensureLocalFileTitle = (content: JSONContent, title: string) => {
          const safeContent =
            content && content.type === "doc"
              ? content
              : { type: "doc", content: [] };
          const nodes = Array.isArray(safeContent.content)
            ? [...safeContent.content]
            : [];
          const first = nodes[0];
          const hasTitleNode =
            first?.type === "heading" && first.attrs?.level === 1;
          const nextTitle = title.trim();

          if (hasTitleNode) {
            const hasText = first.content && first.content.length > 0;
            if (!hasText) {
              first.content = [{ type: "text", text: nextTitle }];
            }
            return { ...safeContent, content: nodes };
          }

          return {
            ...safeContent,
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: nextTitle }],
              },
              ...nodes,
            ],
          };
        };



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
                icon: p.icon,
              });
            }
          });
        }

        get().removePagesByWorkspaceId(notebookId);

        // 需要忽略的文件夹
        const ignoredFolders = new Set([
          "node_modules",
          "dist",
          "build",
          ".git",
          ".vscode",
          ".idea",
          "target",
          "__pycache__",
          ".next",
          ".nuxt",
          ".venv",
          "venv",
        ]);

        const shouldIgnoreEntry = (name: string) =>
          name.startsWith(".") || ignoredFolders.has(name);

        const scanDirectory = async (
          dirPath: string,
          parentId?: string,
        ): Promise<Page[]> => {
          let entries: any[] = [];
          
          if (window.gooseFs?.readDirAsync) {
            try {
              entries = await window.gooseFs.readDirAsync(dirPath);
            } catch (e) {
              console.error("readDirAsync failed", e);
              return [];
            }
          } else {
            try {
              entries = window.gooseFs?.readDir(dirPath) || [];
            } catch (e) {
              console.error("readDir sync failed", e);
              return [];
            }
          }
          let pages: Page[] = [];

          for (const entry of entries) {
            if (shouldIgnoreEntry(entry.name)) continue;

            if (entry.isDirectory) {
              // 创建文件夹页面
              const folderId = generateLocalPageId(notebookId, entry.path);
              const folderTitle = entry.name;
              const folderPage: Page = {
                id: folderId,
                workspaceId: notebookId,
                parentId,
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "heading",
                      attrs: { level: 1 },
                      content: [{ type: "text", text: folderTitle }],
                    },
                  ],
                },
                isFolder: true,
                isLocked: false,
                isFullWidth: false,
                fontSize: "default",
                fontFamily: "default",
                localFilePath: entry.path,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                order: 0,
              };
              pages.push(folderPage);

              // 递归扫描子目录 (Async await)
              const subPages = await scanDirectory(entry.path, folderId);
              pages.push(...subPages);
            } else if (
              entry.isFile &&
              (entry.name.endsWith(".md") || entry.name.endsWith(".markdown"))
            ) {
              // 创建文件页面
              const fileId = generateLocalPageId(notebookId, entry.path);
              let markdownContent = "";
              if (window.gooseFs?.readFileAsync) {
                markdownContent =
                  (await window.gooseFs.readFileAsync(entry.path)) ||
                  "";
              } else {
                markdownContent =
                  window.gooseFs?.readFile(entry.path) || "";
              }

              const imported = importFromMarkdown(markdownContent);
              let jsonContent = imported.content || {
                type: "doc",
                content: [],
              };

              const existingTitle = extractTitleFromContent(jsonContent);
              if (!existingTitle || existingTitle === "无标题") {
                const fallbackTitle = normalizeLocalFileTitle(entry.name);
                jsonContent = ensureLocalFileTitle(jsonContent, fallbackTitle);
              }

              const filePage: Page = {
                id: fileId,
                workspaceId: notebookId,
                parentId,
                content: jsonContent,
                isFolder: false,
                isLocked: false,
                isFullWidth: false,
                fontSize: "default",
                fontFamily: "default",
                localFilePath: entry.path,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              pages.push(filePage);
            }
          }
          return pages;
        };

        const localPages = await scanDirectory(basePath);

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
                  if (existing.icon) {
                    page.icon = existing.icon;
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
                const lastActivePageId = useNotebooks.getState().getLastActivePage(notebookId);
                const pageIdSet = new Set(localPages.map((p) => p.id));

                if (lastActivePageId && pageIdSet.has(lastActivePageId)) {
                   nextActivePageId = lastActivePageId;
                } else {
                    const notebook = useNotebooks.getState().notebooks[notebookId];
                    const isLocalFolder = notebook?.source === "local-folder";
                    if (!isLocalFolder) {
                        const firstPage = localPages
                            .filter((p) => !p.trashedAt)
                            .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))[0];
                        if (firstPage) {
                            nextActivePageId = firstPage.id;
                        }
                    }
                }
                
                if (nextActivePageId !== state.activePageId) {
                    result.activePageId = nextActivePageId;
                }
            }
          }

          // Sync to Notebook store
          const currentActive = result.activePageId || state.activePageId; // Use the potentially updated activePageId
          const activeNotebookId = useNotebooks.getState().activeNotebookId;
          if (activeNotebookId === notebookId && currentActive) {
               useNotebooks.getState().setLastActivePage(notebookId, currentActive);
          }

          return result;
        });
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
                     writePromises.push(window.gooseFs.writeFileAsync(imagePath, match[3]));
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

        if (window.gooseFs?.writeFileAsync) {
             return await window.gooseFs.writeFileAsync(filePath, markdownContent);
        }
        return window.gooseFs?.writeFile(filePath, markdownContent) ?? false;
      },

      getLocalFilePath: (pageId) => {
        const page = get().pages[pageId];
        return page?.localFilePath || null;
      },
    }),
    {
      name: "goose-note-storage",
      storage: createJSONStorage(() => uToolsStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      partialize: (state) => ({
        pages: state.pages,
        activePageId: state.activePageId,
        onboardingCompleted: state.onboardingCompleted,
      }),
      migrate: (persistedState: any, _version: number) => {
        // 迁移旧版 Page 数据：将 title 字段移入 content 的第一个 h1 节点
        if (persistedState?.pages) {
          const migratedPages: Record<string, Page> = {};

          for (const [id, page] of Object.entries(persistedState.pages) as [
            string,
            any,
          ][]) {
            // 如果存在 title 字段，说明是旧数据
            if ("title" in page) {
              const oldTitle = page.title || "";
              const content = page.content as JSONContent;

              // 检查第一个节点
              const firstNode = content.content?.[0];

              // 如果第一个节点已经是 h1，更新其内容
              if (
                firstNode?.type === "heading" &&
                firstNode.attrs?.level === 1
              ) {
                firstNode.content = oldTitle
                  ? [{ type: "text", text: oldTitle }]
                  : undefined;
              } else {
                // 否则在开头插入 h1
                content.content = [
                  {
                    type: "heading",
                    attrs: { level: 1 },
                    content: oldTitle
                      ? [{ type: "text", text: oldTitle }]
                      : undefined,
                  },
                  ...(content.content || []),
                ];
              }

              // 移除 title 字段
              const { title, ...pageWithoutTitle } = page;
              migratedPages[id] = pageWithoutTitle as Page;
            } else {
              migratedPages[id] = page as Page;
            }
          }

          persistedState.pages = migratedPages;
        }

        return persistedState;
      },
    },
  ),
);

const setupImageStorageResolver = async () => {
  const { imageStorage } = await import("@/lib/imageStorage");
  imageStorage.setLocalFolderAccessResolver(() => {
    const activePageId = usePages.getState().activePageId;
    if (!activePageId) return false;

    const page = usePages.getState().pages[activePageId];
    if (!page) return false;

    const notebook = useNotebooks.getState().notebooks[page.workspaceId];
    return notebook?.source === "local-folder" && !!notebook.localPath;
  });
};

void setupImageStorageResolver();
