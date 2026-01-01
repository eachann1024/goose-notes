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

export type CodeStyle = 'default' | 'github' | 'modern' | 'vivid' | 'night'

export interface UToolsSettings {
  globalSearchEnabled: boolean
}

export interface FontConfig {
  label: string | null
  font: string | null
}

export interface CustomFonts {
  default: FontConfig
  serif: FontConfig
  mono: FontConfig
}

interface SettingsState {
  theme: Theme
  codeStyle: CodeStyle
  searchProviders: SearchProvider[]
  utools: UToolsSettings
  searchAllNotebooks: boolean
  customFonts: CustomFonts
  setTheme: (theme: Theme) => void
  setCodeStyle: (style: CodeStyle) => void
  toggleSearchProvider: (id: string) => void
  setUToolsGlobalSearchEnabled: (enabled: boolean) => void
  setSearchAllNotebooks: (searchAll: boolean) => void
  setCustomLabel: (type: 'default' | 'serif' | 'mono', label: string | null) => void
  setCustomFont: (type: 'default' | 'serif' | 'mono', font: string | null) => void
  resetCustomFont: (type: 'default' | 'serif' | 'mono') => void
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
      codeStyle: 'default',
      searchProviders: DEFAULT_SEARCH_PROVIDERS,
      utools: {
        globalSearchEnabled: false,
      },
      searchAllNotebooks: false,
      customFonts: {
        default: { label: null, font: null },
        serif: { label: null, font: null },
        mono: { label: null, font: null },
      },
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      setCodeStyle: (codeStyle) => {
        set({ codeStyle })
        applyCodeStyle(codeStyle)
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
      setCustomLabel: (type, label) =>
        set((state) => ({
          customFonts: {
            ...state.customFonts,
            [type]: { ...state.customFonts[type], label },
          },
        })),
      setCustomFont: (type, font) =>
        set((state) => ({
          customFonts: {
            ...state.customFonts,
            [type]: { ...state.customFonts[type], font },
          },
        })),
      resetCustomFont: (type) =>
        set((state) => ({
          customFonts: {
            ...state.customFonts,
            [type]: { label: null, font: null },
          },
        })),
    }),
    {
      name: 'goose-note-settings',
      storage: createJSONStorage(() => uToolsStorage),
      onRehydrateStorage: () => (state) => {
        const theme = state?.theme || 'system'
        // Migration or fallback
        const codeStyle = (state?.codeStyle || 'default') as CodeStyle
        applyTheme(theme)
        applyCodeStyle(codeStyle)
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
  
  // Re-apply code style when theme changes (because light/dark mode changed)
  const state = useSettings.getState()
  if (state) {
     applyCodeStyle(state.codeStyle)
  }
}

// 监听系统主题变化
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    const { theme, codeStyle } = useSettings.getState()
    if (theme === 'system') {
      applyTheme('system')
    }
    applyCodeStyle(codeStyle)
  })

  // 立即初始化主题（确保在 DOM 加载后立即应用）
  const initThemes = () => {
    const state = useSettings.getState()
    applyTheme(state.theme)
    applyCodeStyle(state.codeStyle)
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemes)
  } else {
    initThemes()
  }
}

// 应用代码主题到 DOM
function applyCodeStyle(codeStyle: CodeStyle) {
  const root = document.documentElement
  // Get current effective theme mode
  const isDark = root.classList.contains('dark')

  // Remove all existing theme classes
  const allThemeClasses = [
    'one-dark', 'one-light', 
    'github-dark', 'github-light', 
    'dracula', 'atom-light', 
    'nord', 'nord-light',
    'tokyo-night', 'github-light-mod'
  ]
  root.classList.remove(...allThemeClasses)

  // Define logic for pairs
  let finalClass = ''

  switch (codeStyle) {
    case 'default':
      // Goose Style: Clean logic
      // Using GitHub Light / Dark as base for now as per plan suggestion to map to something clean
      // User requested Vercel style - we will implement that visually, but using 'github-*' classes 
      // as they are most complete, or we can add specific adjustments.
      finalClass = isDark ? 'github-dark' : 'github-light' 
      break
    case 'github':
      finalClass = isDark ? 'github-dark' : 'github-light'
      break
    case 'modern':
      // One Dark / One Light
      finalClass = isDark ? 'one-dark' : 'one-light'
      break
    case 'vivid':
      // Dracula / Atom Light? Or maybe Dracula Light if we had it.
      // Using Dracula (Dark) and Atom Light (Light) as contrast pair
      finalClass = isDark ? 'dracula' : 'atom-light'
      break
    case 'night':
      // Tokyo Night
      finalClass = isDark ? 'tokyo-night' : 'github-light-mod' // 'github-light-mod' was mapped to tokyo-day-ish in old map
      break
    default:
      finalClass = isDark ? 'github-dark' : 'github-light'
  }

  if (finalClass) {
    root.classList.add(finalClass)
  }
}
