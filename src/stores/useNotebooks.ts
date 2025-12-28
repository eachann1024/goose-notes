import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Notebook {
  id: string
  name: string
  icon?: string // emoji 或 Lucide 图标名
  createdAt: number
  updatedAt: number
}

interface NotebooksState {
  notebooks: Record<string, Notebook>
  activeNotebookId: string | null
  
  createNotebook: (name?: string) => string
  updateNotebook: (id: string, updates: Partial<Omit<Notebook, 'id' | 'createdAt'>>) => void
  deleteNotebook: (id: string) => void
  setActiveNotebook: (id: string) => void
  getNotebook: (id: string) => Notebook | undefined
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// 默认记事本
const DEFAULT_NOTEBOOK_ID = 'default-notebook'

export const useNotebooks = create<NotebooksState>()(
  persist(
    (set, get) => ({
      notebooks: {
        [DEFAULT_NOTEBOOK_ID]: {
          id: DEFAULT_NOTEBOOK_ID,
          name: '我的记事本',
          icon: '📓',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      activeNotebookId: DEFAULT_NOTEBOOK_ID,

      createNotebook: (name = '新记事本') => {
        const id = generateId()
        const notebook: Notebook = {
          id,
          name,
          icon: '📓',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          notebooks: { ...state.notebooks, [id]: notebook },
          activeNotebookId: id,
        }))
        return id
      },

      updateNotebook: (id, updates) => {
        set((state) => {
          const notebook = state.notebooks[id]
          if (!notebook) return state
          return {
            notebooks: {
              ...state.notebooks,
              [id]: { ...notebook, ...updates, updatedAt: Date.now() },
            },
          }
        })
      },

      deleteNotebook: (id) => {
        // 不能删除默认记事本
        if (id === DEFAULT_NOTEBOOK_ID) return
        
        set((state) => {
          const { [id]: _, ...rest } = state.notebooks
          return {
            notebooks: rest,
            // 如果删除的是当前激活的，切换到默认
            activeNotebookId:
              state.activeNotebookId === id
                ? DEFAULT_NOTEBOOK_ID
                : state.activeNotebookId,
          }
        })
      },

      setActiveNotebook: (id) => {
        set({ activeNotebookId: id })
      },

      getNotebook: (id) => {
        return get().notebooks[id]
      },
    }),
    {
      name: 'goose-notion-notebooks',
    }
  )
)

export const DEFAULT_NOTEBOOK = DEFAULT_NOTEBOOK_ID
