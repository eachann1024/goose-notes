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
    openSearchInUtools: boolean

    windowHeight: number
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

// 界面字体大小选项
export type UIFontSize = 'small' | 'normal' | 'large'

// 编辑器字体大小边界
export const EDITOR_FONT_SIZE_MIN = 12
export const EDITOR_FONT_SIZE_MAX = 24
export const EDITOR_FONT_SIZE_DEFAULT = 16

interface SettingsState {
    theme: Theme
    codeStyle: CodeStyle
    searchProviders: SearchProvider[]
    utools: UToolsSettings
    searchAllNotebooks: boolean
    customFonts: CustomFonts
    uiFontSize: UIFontSize
    editorFontSize: number
    setTheme: (theme: Theme) => void
    setCodeStyle: (style: CodeStyle) => void
    toggleSearchProvider: (id: string) => void
    setUToolsGlobalSearchEnabled: (enabled: boolean) => void
    setOpenSearchInUtools: (enabled: boolean) => void

    setUToolsWindowHeight: (height: number) => void
    setSearchAllNotebooks: (searchAll: boolean) => void
    setCustomLabel: (type: 'default' | 'serif' | 'mono', label: string | null) => void
    setCustomFont: (type: 'default' | 'serif' | 'mono', font: string | null) => void
    resetCustomFont: (type: 'default' | 'serif' | 'mono') => void
    setUIFontSize: (size: UIFontSize) => void
    setEditorFontSize: (size: number) => void
    increaseEditorFontSize: () => void
    decreaseEditorFontSize: () => void
    resetEditorFontSize: () => void
}

export const DEFAULT_SEARCH_PROVIDERS: SearchProvider[] = [
    {
        id: 'baidu',
        name: '百度',
        urlTemplate: 'https://www.baidu.com/s?wd=%s',
        isEnabled: true,
    },
    {
        id: 'google',
        name: 'Google',
        urlTemplate: 'https://www.google.com/search?q=%s',
        isEnabled: false,
    },
    {
        id: 'quark',
        name: '夸克',
        urlTemplate: 'https://quark.sm.cn/s?q=%s',
        isEnabled: true,
    },
    {
        id: 'xiaohongshu',
        name: '小红书',
        urlTemplate: 'https://www.xiaohongshu.com/search_result?keyword=%s',
        isEnabled: true,
    },
    {
        id: 'bilibili',
        name: '哔哩哔哩',
        urlTemplate: 'https://search.bilibili.com/all?keyword=%s',
        isEnabled: false,
    },
    {
        id: 'douyin',
        name: '抖音',
        urlTemplate: 'https://www.douyin.com/search/%s',
        isEnabled: false,
    },
    
    {
        id: 'perplexity',
        name: 'Perplexity',
        urlTemplate: 'https://www.perplexity.ai/search?q=%s',
        isEnabled: false,
    },
    {
        id: 'bing',
        name: 'Bing',
        urlTemplate: 'https://www.bing.com/search?q=%s',
        isEnabled: false,
    },

    {
        id: 'metaso',
        name: '秘塔',
        urlTemplate: 'https://metaso.cn/?q=%s',
        isEnabled: false,
    },
]

export const useSettings = create<SettingsState>()(
    persist(
        (set) => ({
            theme: 'system',
            codeStyle: 'default',
            searchProviders: DEFAULT_SEARCH_PROVIDERS,
            utools: {
                globalSearchEnabled: false,
                openSearchInUtools: true,

                windowHeight: 600,
            },
            searchAllNotebooks: false,
            customFonts: {
                default: { label: null, font: null },
                serif: { label: null, font: null },
                mono: { label: null, font: null },
            },
            uiFontSize: 'normal',
            editorFontSize: EDITOR_FONT_SIZE_DEFAULT,
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
                    searchProviders: state.searchProviders.map((provider) => (provider.id === id ? { ...provider, isEnabled: !provider.isEnabled } : provider)),
                })),
            setUToolsGlobalSearchEnabled: (enabled) =>
                set((state) => ({
                    utools: { ...state.utools, globalSearchEnabled: enabled },
                })),
            setOpenSearchInUtools: (enabled) =>
                set((state) => ({
                    utools: { ...state.utools, openSearchInUtools: enabled },
                })),

            setUToolsWindowHeight: (height) =>
                set((state) => ({
                    utools: { ...state.utools, windowHeight: height },
                })),
            setSearchAllNotebooks: (searchAll) => set({ searchAllNotebooks: searchAll }),
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
            setUIFontSize: (uiFontSize) => set({ uiFontSize }),
            setEditorFontSize: (size) =>
                set({
                    editorFontSize: Math.max(EDITOR_FONT_SIZE_MIN, Math.min(EDITOR_FONT_SIZE_MAX, size)),
                }),
            increaseEditorFontSize: () =>
                set((state) => ({
                    editorFontSize: Math.min(EDITOR_FONT_SIZE_MAX, state.editorFontSize + 1),
                })),
            decreaseEditorFontSize: () =>
                set((state) => ({
                    editorFontSize: Math.max(EDITOR_FONT_SIZE_MIN, state.editorFontSize - 1),
                })),
            resetEditorFontSize: () => set({ editorFontSize: EDITOR_FONT_SIZE_DEFAULT }),
        }),
        {
            name: 'goose-note-settings',
            storage: createJSONStorage(() => uToolsStorage),
            onRehydrateStorage: () => (state) => {
                const theme = state?.theme || 'system'
                const codeStyle = (state?.codeStyle || 'default') as CodeStyle
                applyTheme(theme)
                applyCodeStyle(codeStyle)
                
                // Apply window height immediately upon rehydration
                if (state?.utools?.windowHeight) {
                    // Try to apply directly if possible, or via adapter
                    // We need to import UToolsAdapter dynamically or assume it's available globally or rely on side effects
                    // Since UToolsAdapter is in lib, we can access it if we import it.
                    // However, we are in the store file.
                    // Check if we can import UToolsAdapter at top level (we already do).
                    // So we can use it.
                    // Delaying slightly can safeguard against race conditions in uTools init
                    try {
                         // @ts-ignore
                         if (window.utools) {
                             // @ts-ignore
                             window.utools.setExpendHeight(state.utools.windowHeight);
                         }
                    } catch (e) {
                        console.error("Failed to apply window height on rehydrate", e)
                    }
                }

                if (state) {
                    // Always apply DEFAULT_SEARCH_PROVIDERS order, preserving user's enabled state
                    const enabledMap = new Map(state.searchProviders.map((p) => [p.id, p.isEnabled]))
                    const reorderedProviders = DEFAULT_SEARCH_PROVIDERS.map((provider) => ({
                        ...provider,
                        isEnabled: enabledMap.get(provider.id) ?? provider.isEnabled,
                    }))
                    useSettings.setState({ searchProviders: reorderedProviders })
                }
            },
        }
    )
)

// Force reorder searchProviders to match DEFAULT_SEARCH_PROVIDERS on initialization
setTimeout(() => {
    const state = useSettings.getState()
    if (state?.searchProviders) {
        const enabledMap = new Map(state.searchProviders.map((p) => [p.id, p.isEnabled]))
        const reorderedProviders = DEFAULT_SEARCH_PROVIDERS.map((provider) => ({
            ...provider,
            isEnabled: enabledMap.get(provider.id) ?? provider.isEnabled,
        }))
        useSettings.setState({ searchProviders: reorderedProviders })
    }
}, 0)

// 应用主题到 DOM
function applyTheme(theme: Theme) {
    const root = document.documentElement
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

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
    const allThemeClasses = ['one-dark', 'one-light', 'github-dark', 'github-light', 'dracula', 'atom-light', 'nord', 'nord-light', 'tokyo-night', 'github-light-mod']
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
