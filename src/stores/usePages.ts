import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Page, JSONContent } from '@/types'
import { uToolsStorage } from '@/lib/storage'
import { useNotebooks } from './useNotebooks'

interface PagesState {
  pages: Record<string, Page>
  activePageId: string | null

  createPage: (parentId?: string, workspaceId?: string) => string
  updatePage: (id: string, updates: Partial<Page>) => void
  deletePage: (id: string) => void
  restorePage: (id: string) => void
  duplicatePage: (id: string) => string
  permanentlyDeletePage: (id: string) => void
  reorderPages: (ids: string[], parentId: string | undefined) => void
  setActivePage: (id: string | null) => void

  getPage: (id: string) => Page | undefined
  getChildren: (parentId?: string, workspaceId?: string) => Page[]
  getTrashedPages: (workspaceId?: string) => Page[]
  getFavorites: (workspaceId?: string) => Page[]
}

const initialContent: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
    },
  ],
}

export const flushEditorContent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('goose-note:flush-editor'))
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushEditorContent)

  if ((window as any).utools) {
    ;(window as any).utools.onPluginOut(flushEditorContent)
  }
}

export const usePages = create<PagesState>()(
  persist(
    (set, get) => ({
      pages: {},
      activePageId: null,

      createPage: (parentId, workspaceId = 'default') => {
        flushEditorContent()

        const id = uuidv4()
        const now = Date.now()
        const newPage: Page = {
          id,
          workspaceId,
          parentId,
          title: '',
          content: initialContent,
          isFolder: false,
          isLocked: false,
          isFullWidth: false,
          fontSize: 'default',
          fontFamily: 'default',
          createdAt: now,
          updatedAt: now,
          order: now,
        }

        set((state) => ({
          pages: { ...state.pages, [id]: newPage },
          activePageId: id,
        }))

        useNotebooks.getState().setLastActivePage(workspaceId, id)

        return id
      },

      updatePage: (id, updates) => {
        set((state) => {
          const page = state.pages[id]
          if (!page) return state

          return {
            pages: {
              ...state.pages,
              [id]: { ...page, ...updates, updatedAt: Date.now() },
            },
          }
        })
      },

      deletePage: (id) => {
        flushEditorContent()

        set((state) => {
          const page = state.pages[id]
          if (!page) return state

          return {
            pages: {
              ...state.pages,
              [id]: { ...page, trashedAt: Date.now(), updatedAt: Date.now() },
            },
            activePageId: state.activePageId === id ? null : state.activePageId,
          }
        })
      },

      restorePage: (id) => {
        set((state) => {
          const page = state.pages[id]
          if (!page) return state

          const { trashedAt, ...rest } = page
          return {
            pages: {
              ...state.pages,
              [id]: { ...rest, updatedAt: Date.now() } as Page,
            },
          }
        })
      },

      duplicatePage: (id) => {
        flushEditorContent()

        let newId = ''
        set((state) => {
          const page = state.pages[id]
          if (!page) return state

          newId = uuidv4()
          const now = Date.now()
          const newPage: Page = {
            ...page,
            id: newId,
            title: `${page.title} 副本`,
            updatedAt: now,
            createdAt: now,
            trashedAt: undefined,
            isFavorite: false,
            order: now,
          }

          return {
            pages: {
              ...state.pages,
              [newId]: newPage,
            },
          }
        })
        return newId
      },

      permanentlyDeletePage: (id) => {
        set((state) => {
          const newPages = { ...state.pages }
          delete newPages[id]
          return {
            pages: newPages,
            activePageId: state.activePageId === id ? null : state.activePageId,
          }
        })
      },

      reorderPages: (ids, parentId) => {
        set((state) => {
          const newPages = { ...state.pages }

          ids.forEach((id, index) => {
            if (newPages[id]) {
              newPages[id] = {
                ...newPages[id],
                parentId: parentId,
                order: index,
                updatedAt: Date.now(),
              }
            }
          })

          return { pages: newPages }
        })
      },

      setActivePage: (id) => {
        flushEditorContent()

        if (!id) {
          set({ activePageId: null })
          return
        }

        set((state) => {
          const page = state.pages[id]
          if (!page) {
            return { activePageId: id }
          }

          // 切换页面不应更新 updatedAt，只在真正编辑内容时更新
          return {
            activePageId: id,
          }
        })

        const notebookId = useNotebooks.getState().activeNotebookId
        if (notebookId) {
          useNotebooks.getState().setLastActivePage(notebookId, id)
        }
      },

      getPage: (id) => get().pages[id],

      getChildren: (parentId, workspaceId) => {
        const pages = get().pages
        return Object.values(pages)
          .filter((p) => {
            const matchParent = p.parentId === parentId && !p.trashedAt
            const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true
            return matchParent && matchWorkspace
          })
          .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
      },

      getTrashedPages: (workspaceId) => {
        const pages = get().pages
        return Object.values(pages)
          .filter((p) => {
            const isTrashed = !!p.trashedAt
            const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true
            return isTrashed && matchWorkspace
          })
          .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
      },

      getFavorites: (workspaceId) => {
        const pages = get().pages
        return Object.values(pages)
          .filter((p) => {
            const isFavorite = p.isFavorite && !p.trashedAt
            const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true
            return isFavorite && matchWorkspace
          })
          .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
      },
    }),
    {
      name: 'goose-note-storage',
      storage: createJSONStorage(() => uToolsStorage),
      partialize: (state) => ({
        pages: state.pages,
        activePageId: state.activePageId,
      }),
    }
  )
)
