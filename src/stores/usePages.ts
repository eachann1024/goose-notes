import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { Page, JSONContent } from "@/types";
import { uToolsStorage } from "@/lib/storage";
import { useNotebooks } from "./useNotebooks";
import { extractTitleFromContent, extractTextFromContent } from "@/lib/content-text-extractor";

interface PagesState {
  pages: Record<string, Page>;
  activePageId: string | null;

  createPage: (parentId?: string, workspaceId?: string) => string;
  updatePage: (id: string, updates: Partial<Page>) => void;
  deletePage: (id: string) => void;
  restorePage: (id: string) => void;
  duplicatePage: (id: string) => string;
  permanentlyDeletePage: (id: string) => void;
  reorderPages: (ids: string[], parentId: string | undefined) => void;
  setActivePage: (id: string | null) => void;

  getPage: (id: string) => Page | undefined;
  getChildren: (parentId?: string, workspaceId?: string) => Page[];
  getTrashedPages: (workspaceId?: string) => Page[];
  getFavorites: (workspaceId?: string) => Page[];
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

      createPage: (parentId, workspaceId = "default") => {
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

        return id;
      },

      updatePage: (id, updates) => {
        set((state) => {
          const page = state.pages[id];
          if (!page) return state;

          return {
            pages: {
              ...state.pages,
              [id]: { ...page, ...updates, updatedAt: Date.now() },
            },
          };
        });
      },

      deletePage: (id) => {
        flushEditorContent();

        set((state) => {
          const page = state.pages[id];
          if (!page) return state;

          const workspaceId = page.workspaceId;
          const newPages = {
            ...state.pages,
            [id]: { ...page, trashedAt: Date.now(), updatedAt: Date.now() },
          };

          let newActivePageId = state.activePageId;
          if (state.activePageId === id) {
            const siblings = Object.values(newPages).filter(
              (p) =>
                p.workspaceId === workspaceId && !p.trashedAt && p.id !== id,
            );
            newActivePageId = siblings.length > 0 ? siblings[0].id : null;
          }

          return {
            pages: newPages,
            activePageId: newActivePageId,
          };
        });
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

        let newId = "";
        set((state) => {
          const page = state.pages[id];
          if (!page) return state;

          newId = uuidv4();
          const now = Date.now();
          
          // 复制内容并在标题后添加 " 副本"
          const clonedContent = JSON.parse(JSON.stringify(page.content));
          if (clonedContent.content?.[0]?.type === 'heading' && clonedContent.content[0].attrs?.level === 1) {
            const titleNode = clonedContent.content[0];
            const titleText = extractTitleFromContent(page.content);
            titleNode.content = [{ type: 'text', text: `${titleText} 副本` }];
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
        set((state) => {
          const page = state.pages[id];
          const workspaceId = page?.workspaceId;
          const newPages = { ...state.pages };
          delete newPages[id];

          let newActivePageId = state.activePageId;
          if (state.activePageId === id) {
            const siblings = Object.values(newPages).filter(
              (p) => p.workspaceId === workspaceId && !p.trashedAt,
            );
            newActivePageId = siblings.length > 0 ? siblings[0].id : null;
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
    }),
    {
      name: "goose-note-storage",
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({
        pages: state.pages,
        activePageId: state.activePageId,
      }),
      migrate: (persistedState: any, version: number) => {
        // 迁移旧版 Page 数据：将 title 字段移入 content 的第一个 h1 节点
        if (persistedState?.pages) {
          const migratedPages: Record<string, Page> = {};
          
          for (const [id, page] of Object.entries(persistedState.pages) as [string, any][]) {
            // 如果存在 title 字段，说明是旧数据
            if ('title' in page) {
              const oldTitle = page.title || '';
              const content = page.content as JSONContent;
              
              // 检查第一个节点
              const firstNode = content.content?.[0];
              
              // 如果第一个节点已经是 h1，更新其内容
              if (firstNode?.type === 'heading' && firstNode.attrs?.level === 1) {
                firstNode.content = oldTitle ? [{ type: 'text', text: oldTitle }] : undefined;
              } else {
                // 否则在开头插入 h1
                content.content = [
                  {
                    type: 'heading',
                    attrs: { level: 1 },
                    content: oldTitle ? [{ type: 'text', text: oldTitle }] : undefined
                  },
                  ...(content.content || [])
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
