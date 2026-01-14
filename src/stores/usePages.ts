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
  setHydrated: (hydrated: boolean) => void;

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
  createLocalPage: (parentId?: string, workspaceId?: string) => string | null;
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

      createLocalPage: (parentId?: string, workspaceId?: string) => {
        if (!workspaceId) return null;
        const notebook = useNotebooks.getState().notebooks[workspaceId];
        if (
          !notebook?.localPath ||
          typeof window === "undefined" ||
          !(window as any).gooseFs
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

        if ((window as any).gooseFs.exists(filePath)) {
          let suffix = 1;
          while (
            (window as any).gooseFs.exists(
              `${normalizedBaseDir}/${title} (${suffix}).md`,
            )
          ) {
            suffix++;
          }
          filePath = `${normalizedBaseDir}/${title} (${suffix}).md`;
        }

        if (!(window as any).gooseFs.writeFile(filePath, `# \n`)) {
          return null;
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
            if (!targetPath || !(window as any).gooseFs) return state;

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
              ? (window as any).gooseFs.deleteDir(targetPath)
              : (window as any).gooseFs.deleteFile(targetPath);
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
          if (!page) return state;

          const { trashedAt, ...rest } = page;
          return {
            pages: {
              ...state.pages,
              [id]: { ...rest, updatedAt: Date.now() } as Page,
            },
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
          if (typeof window === "undefined" || !(window as any).gooseFs) return;
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
            ? (window as any).gooseFs.deleteDir(targetPath)
            : (window as any).gooseFs.deleteFile(targetPath);
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

      setActivePage: (id) => {
        flushEditorContent();

        if (!id) {
          set({ activePageId: null });
          return;
        }

        set((state) => {
          const page = state.pages[id];
          if (!page) {
            return { activePageId: id };
          }

          // 本地文件页面：切换时重新从磁盘读取内容
          const notebook = useNotebooks.getState().notebooks[page.workspaceId];
          if (
            notebook?.source === "local-folder" &&
            page.localFilePath &&
            !page.isFolder &&
            (window as any).gooseFs
          ) {
            const markdownContent =
              (window as any).gooseFs.readFile(page.localFilePath) || "";
            const imported = importFromMarkdown(markdownContent);
            const jsonContent = imported.content || {
              type: "doc",
              content: [],
            };

            return {
              activePageId: id,
              pages: {
                ...state.pages,
                [id]: {
                  ...page,
                  content: jsonContent,
                },
              },
            };
          }

          // 切换页面不应更新 updatedAt，只在真正编辑内容时更新
          return {
            activePageId: id,
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
          .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
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
        if (typeof window === "undefined" || !(window as any).gooseFs) return;
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

        const scanDirectory = (dirPath: string, parentId?: string): Page[] => {
          const entries = (window as any).gooseFs.readDir(dirPath);
          const pages: Page[] = [];

          entries.forEach((entry: any) => {
            if (shouldIgnoreEntry(entry.name)) return;

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
              };
              pages.push(folderPage);

              // 递归扫描子目录
              const subPages = scanDirectory(entry.path, folderId);
              pages.push(...subPages);
            } else if (
              entry.isFile &&
              (entry.name.endsWith(".md") || entry.name.endsWith(".markdown"))
            ) {
              // 创建文件页面
              const fileId = generateLocalPageId(notebookId, entry.path);
              const markdownContent =
                (window as any).gooseFs.readFile(entry.path) || "";
              const imported = importFromMarkdown(markdownContent);
              const jsonContent = imported.content || {
                type: "doc",
                content: [],
              };

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
          });

          return pages;
        };

        const localPages = scanDirectory(basePath);

        set((state) => ({
          pages: {
            ...state.pages,
            ...localPages.reduce(
              (acc, page) => {
                acc[page.id] = page;
                return acc;
              },
              {} as Record<string, Page>,
            ),
          },
        }));

        const activeNotebookId = useNotebooks.getState().activeNotebookId;
        if (activeNotebookId === notebookId) {
          const lastActivePageId = useNotebooks
            .getState()
            .getLastActivePage(notebookId);
          const pageIdSet = new Set(localPages.map((p) => p.id));

          if (lastActivePageId && pageIdSet.has(lastActivePageId)) {
            set({ activePageId: lastActivePageId });
          } else {
            const firstPage = localPages
              .filter((p) => !p.trashedAt)
              .sort(
                (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
              )[0];
            set({ activePageId: firstPage?.id ?? null });
            useNotebooks
              .getState()
              .setLastActivePage(notebookId, firstPage?.id ?? null);
          }
        }
      },

      saveLocalPageContent: async (pageId, content) => {
        if (typeof window === "undefined" || !(window as any).gooseFs)
          return false;

        const page = get().pages[pageId];
        if (!page) return false;

        const filePath = get().getLocalFilePath(pageId);
        if (!filePath) return false;

        // 使用 export.ts 中的 jsonContentToMarkdown 函数进行完整转换
        // 这里需要实现图片资源处理逻辑
        let processedContent = content;

        // 处理图片资源：将 base64 图片保存到 assets 文件夹
        const assetsDir = filePath.replace(/[^\/\\]+$/, "") + "assets";
        if (!(window as any).gooseFs.exists(assetsDir)) {
          (window as any).gooseFs.mkdir(assetsDir);
        }

        // 遍历内容中的图片节点
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
                (window as any).gooseFs.writeFile(imagePath, match[3]);

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

        const markdownContent = jsonContentToMarkdown(processedContent);

        return (window as any).gooseFs.writeFile(filePath, markdownContent);
      },

      getLocalFilePath: (pageId) => {
        const page = get().pages[pageId];
        return page?.localFilePath || null;
      },
    }),
    {
      name: "goose-note-storage",
      storage: createJSONStorage(() => uToolsStorage),
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
