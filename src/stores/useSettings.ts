import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uToolsStorage } from '@/lib/storage'

export interface SearchProvider {
  id: string
  name: string
  urlTemplate: string
  isEnabled: boolean
}

export type Theme = 'light' | 'dark' | 'system'

export interface UToolsSettings {
  globalSearchEnabled: boolean
}

interface SettingsState {
  theme: Theme
  searchProviders: SearchProvider[]
  utools: UToolsSettings
  searchAllNotebooks: boolean
  setTheme: (theme: Theme) => void
  toggleSearchProvider: (id: string) => void
  setUToolsGlobalSearchEnabled: (enabled: boolean) => void
  setSearchAllNotebooks: (searchAll: boolean) => void
}

export const DEFAULT_SEARCH_PROVIDERS: SearchProvider[] = [
  { id: 'google', name: 'Google', urlTemplate: 'https://www.google.com/search?q=%s', isEnabled: true },
  { id: 'perplexity', name: 'Perplexity', urlTemplate: 'https://www.perplexity.ai/search?q=%s', isEnabled: false },
  { id: 'bing', name: 'Bing', urlTemplate: 'https://www.bing.com/search?q=%s', isEnabled: false },
  { id: 'baidu', name: 'Baidu', urlTemplate: 'https://www.baidu.com/s?wd=%s', isEnabled: false },
  { id: 'duckduckgo', name: 'DuckDuckGo', urlTemplate: 'https://duckduckgo.com/?q=%s', isEnabled: false },
]

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      searchProviders: DEFAULT_SEARCH_PROVIDERS,
      utools: {
        globalSearchEnabled: false,
      },
      searchAllNotebooks: false,
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      toggleSearchProvider: (id) =>
        set((state) => ({
          searchProviders: state.searchProviders.map((provider) =>
            provider.id === id ? { ...provider, isEnabled: !provider.isEnabled } : provider
          ),
        })),
      setUToolsGlobalSearchEnabled: (enabled) =>
        set((state) => ({
          utools: { ...state.utools, globalSearchEnabled: enabled },
        })),
      setSearchAllNotebooks: (searchAll) =>
        set({ searchAllNotebooks: searchAll }),
    }),
    {
      name: 'goose-note-settings',
      storage: createJSONStorage(() => uToolsStorage),
      onRehydrateStorage: () => (state) => {
        // 恢复后立即应用主题
        if (state?.theme) {
          applyTheme(state.theme)
        }
      },
    }
  )
)

// 应用主题到 DOM
function applyTheme(theme: Theme) {
  const root = document.documentElement
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// 监听系统主题变化
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    const { theme } = useSettings.getState()
    if (theme === 'system') {
      applyTheme('system')
    }
  })
}
