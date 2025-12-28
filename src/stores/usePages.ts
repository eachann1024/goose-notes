
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Page, JSONContent } from '@/types'
import { uToolsStorage } from '@/lib/storage'

interface PagesState {
  pages: Record<string, Page> // Normalize by ID
  activePageId: string | null
  
  // Actions
  createPage: (parentId?: string) => string
  updatePage: (id: string, updates: Partial<Page>) => void
  deletePage: (id: string) => void // Soft delete
  restorePage: (id: string) => void
  duplicatePage: (id: string) => string
  permanentlyDeletePage: (id: string) => void
  setActivePage: (id: string | null) => void
  
  // Computed (helper functions)
  getPage: (id: string) => Page | undefined
  getChildren: (parentId?: string) => Page[]
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

      createPage: (parentId) => {
        const id = uuidv4()
        const now = Date.now()
        const newPage: Page = {
          id,
          workspaceId: 'default', // TODO: Support multiple workspaces
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
        }
        
        set((state) => ({
          pages: { ...state.pages, [id]: newPage },
          activePageId: id, // Switch to new page immediately
        }))
        
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

      setActivePage: (id) => set({ activePageId: id }),

      getPage: (id) => get().pages[id],
      
      getChildren: (parentId) => {
        const pages = get().pages
        return Object.values(pages)
          .filter(p => p.parentId === parentId && !p.trashedAt)
          .sort((a, b) => b.updatedAt - a.updatedAt) // Sort by recently updated
      },
    }),
    {
      name: 'goose-notion-storage',
      storage: createJSONStorage(() => throttledStorage),
      // 只持久化 pages，不持久化临时状态
      partialize: (state) => ({ pages: state.pages }),
    }
  )
)
