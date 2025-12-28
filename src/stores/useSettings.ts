import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SearchProvider {
  id: string
  name: string
  urlTemplate: string
  isEnabled: boolean
}

interface SettingsState {
  searchProviders: SearchProvider[]
  toggleSearchProvider: (id: string) => void
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
      searchProviders: DEFAULT_SEARCH_PROVIDERS,
      toggleSearchProvider: (id) =>
        set((state) => ({
          searchProviders: state.searchProviders.map((provider) =>
            provider.id === id ? { ...provider, isEnabled: !provider.isEnabled } : provider
          ),
        })),
    }),
    {
      name: 'goose-notion-settings',
    }
  )
)
