
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Page, JSONContent } from '@/types'
import { uToolsStorage } from '@/lib/storage'
import { useNotebooks } from './useNotebooks'

interface PagesState {
  pages: Record<string, Page> // Normalize by ID
  activePageId: string | null
  
  // Actions
  createPage: (parentId?: string, workspaceId?: string) => string
  updatePage: (id: string, updates: Partial<Page>) => void
  deletePage: (id: string) => void // Soft delete
  restorePage: (id: string) => void
  duplicatePage: (id: string) => string
  permanentlyDeletePage: (id: string) => void
  reorderPages: (ids: string[], parentId: string | undefined) => void
  setActivePage: (id: string | null) => void
  
  // Computed (helper functions)
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

// 节流存储适配器，减少写入频率
function createThrottledStorage(storage: typeof uToolsStorage, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let pendingValue: string | null = null
  let pendingName: string | null = null
  
  return {
    getItem: storage.getItem,
    setItem: (name: string, value: string) => {
      pendingName = name
      pendingValue = value
      
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (pendingName && pendingValue) {
            storage.setItem(pendingName, pendingValue)
          }
          timeoutId = null
          pendingName = null
          pendingValue = null
        }, delay)
      }
    },
    removeItem: storage.removeItem,
  }
}

const throttledStorage = createThrottledStorage(uToolsStorage, 500)

export const usePages = create<PagesState>()(
  persist(
    (set, get) => ({
      pages: {},
      activePageId: null,

      createPage: (parentId, workspaceId = 'default') => {
        const id = uuidv4()
        const now = Date.now()
        const newPage: Page = {
          id,
          workspaceId,
          parentId,
          title: '',
          content: initialContent,
          isFolder: false, // Unified: initially not a folder
          isLocked: false,
          isFullWidth: false,
          fontSize: 'default',
          fontFamily: 'default',
          createdAt: now,
          updatedAt: now,
          order: now, // Default order to created time
        }

        set((state) => ({
          pages: { ...state.pages, [id]: newPage },
          activePageId: id, // Switch to new page immediately
        }))

// 记录到当前记事本的历史
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
        set((state) => {
          const page = state.pages[id]
          if (!page) return state
          
          return {
            pages: {
              ...state.pages,
              [id]: { ...page, trashedAt: Date.now(), updatedAt: Date.now() },
            },
            // If active page is deleted, clear active
            activePageId: state.activePageId === id ? null : state.activePageId,
          }
        })
      },

      restorePage: (id) => {
        set((state) => {
          const page = state.pages[id]
          if (!page) return state
          
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        let newId = ""
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
            trashedAt: undefined, // Ensure it's not trashed
            isFavorite: false, // Don't inherit favorite status
            order: now, // Put duplicate at the end by default
          }

          return {
            pages: {
              ...state.pages,
              [newId]: newPage,
            }
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
                activePageId: state.activePageId === id ? null : state.activePageId
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
                updatedAt: Date.now(), // Update timestamp? Maybe not if we want to avoid "edit" trigger side effects?
                // Actually the user wants to avoid "position changes on edit".
                // Since our sort logic now prioritizes 'order', updating 'updatedAt' is fine.
              }
            }
          })
          
          return { pages: newPages }
        })
      },

      setActivePage: (id) => {
        const currentId = get().activePageId
        // 只在页面 ID 实际变化时才更新状态和记录
        if (currentId === id) return

        set({ activePageId: id })
        // 同步更新当前记事本的最后活跃页面记录
        const notebookId = useNotebooks.getState().activeNotebookId
        if (notebookId) {
          useNotebooks.getState().setLastActivePage(notebookId, id)
        }
      },

      getPage: (id) => get().pages[id],
      
      getChildren: (parentId, workspaceId) => {
        const pages = get().pages
        return Object.values(pages)
          .filter(p => {
            const matchParent = p.parentId === parentId && !p.trashedAt
            const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true
            return matchParent && matchWorkspace
          })
          .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
      },

      getTrashedPages: (workspaceId) => {
        const pages = get().pages
        return Object.values(pages)
          .filter(p => {
            const isTrashed = !!p.trashedAt
            const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true
            return isTrashed && matchWorkspace
          })
          .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)) // 最近删除的在前
      },

      getFavorites: (workspaceId) => {
        const pages = get().pages
        return Object.values(pages)
          .filter(p => {
            const isFavorite = p.isFavorite && !p.trashedAt
            const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true
            return isFavorite && matchWorkspace
          })
          .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
      },
    }),
    {
      name: 'goose-notion-storage',
      storage: createJSONStorage(() => throttledStorage),
      // Persist pages and activePageId
      partialize: (state) => ({ 
        pages: state.pages,
        activePageId: state.activePageId 
      }),
    }
  )
)
