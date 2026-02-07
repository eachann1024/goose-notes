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

export type CodeStyle = 'default' | 'github' | 'modern' | 'night' | 'nord' | 'nord-light'

export interface UToolsSettings {
    globalSearchEnabled: boolean
    openSearchInUtools: boolean

    windowHeight: number
}

export interface DesktopSettings {
    wakeHotkey: string
    wakeHotkeyEnabled: boolean
    searchHotkey: string
    searchHotkeyEnabled: boolean
}

export interface PrivacySettings {
    autoOpenLastNote: boolean
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

export interface CustomAction {
    id: string
    name: string
    pluginName?: string
    command: string
    isEnabled: boolean
}

// 界面字体大小选项
export type UIFontSize = 'small' | 'normal' | 'large'

// 编辑器字体大小边界
export const EDITOR_FONT_SIZE_MIN = 12
export const EDITOR_FONT_SIZE_MAX = 24
export const EDITOR_FONT_SIZE_DEFAULT = 16
export const DEFAULT_WAKE_HOTKEY = "CmdOrCtrl+Alt+N"
export const DEFAULT_SEARCH_HOTKEY = "CmdOrCtrl+Shift+K"

interface SettingsState {
    theme: Theme
    codeStyle: CodeStyle
    searchProviders: SearchProvider[]
    utools: UToolsSettings
    desktop: DesktopSettings
    privacy: PrivacySettings
    searchAllNotebooks: boolean
    customFonts: CustomFonts
    uiFontSize: UIFontSize
    editorFontSize: number
    customActions: CustomAction[]
    setTheme: (theme: Theme) => void
    setCodeStyle: (style: CodeStyle) => void
    toggleSearchProvider: (id: string) => void
    reorderSearchProviders: (nextIds: string[]) => void
    setUToolsGlobalSearchEnabled: (enabled: boolean) => void
    setOpenSearchInUtools: (enabled: boolean) => void

    setUToolsWindowHeight: (height: number) => void
    setWakeHotkey: (hotkey: string) => void
    setWakeHotkeyEnabled: (enabled: boolean) => void
    setSearchHotkey: (hotkey: string) => void
    setSearchHotkeyEnabled: (enabled: boolean) => void
    setAutoOpenLastNote: (enabled: boolean) => void
    setSearchAllNotebooks: (searchAll: boolean) => void
    setCustomLabel: (type: 'default' | 'serif' | 'mono', label: string | null) => void
    setCustomFont: (type: 'default' | 'serif' | 'mono', font: string | null) => void
    resetCustomFont: (type: 'default' | 'serif' | 'mono') => void
    setUIFontSize: (size: UIFontSize) => void
    setEditorFontSize: (size: number) => void
    increaseEditorFontSize: () => void
    decreaseEditorFontSize: () => void
    resetEditorFontSize: () => void
    addCustomAction: (action: Omit<CustomAction, 'id'>) => void
    updateCustomAction: (id: string, updates: Partial<Omit<CustomAction, 'id'>>) => void
    removeCustomAction: (id: string) => void
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

const CODE_STYLE_MIGRATION_MAP: Record<string, CodeStyle> = {
    vivid: 'nord',
}

function normalizeCodeStyle(codeStyle: string | undefined): CodeStyle {
    if (!codeStyle) return 'default'
    if (codeStyle in CODE_STYLE_MIGRATION_MAP) {
        return CODE_STYLE_MIGRATION_MAP[codeStyle]
    }
    if (codeStyle === 'default' || codeStyle === 'github' || codeStyle === 'modern' || codeStyle === 'night' || codeStyle === 'nord' || codeStyle === 'nord-light') {
        return codeStyle
    }
    return 'default'
}

function mergeSearchProvidersWithDefaults(searchProviders: SearchProvider[] | undefined): SearchProvider[] {
    if (!searchProviders || searchProviders.length === 0) {
        return DEFAULT_SEARCH_PROVIDERS
    }

    const defaultMap = new Map(DEFAULT_SEARCH_PROVIDERS.map((provider) => [provider.id, provider]))
    const merged = searchProviders
        .filter((provider) => defaultMap.has(provider.id))
        .map((provider) => ({
            ...defaultMap.get(provider.id)!,
            isEnabled: provider.isEnabled,
        }))

    const existingIds = new Set(merged.map((provider) => provider.id))
    DEFAULT_SEARCH_PROVIDERS.forEach((provider) => {
        if (!existingIds.has(provider.id)) {
            merged.push(provider)
        }
    })

    return merged
}

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
            desktop: {
                wakeHotkey: DEFAULT_WAKE_HOTKEY,
                wakeHotkeyEnabled: true,
                searchHotkey: DEFAULT_SEARCH_HOTKEY,
                searchHotkeyEnabled: true,
            },
            privacy: {
                autoOpenLastNote: true,
            },
            searchAllNotebooks: false,
            customFonts: {
                default: { label: null, font: null },
                serif: { label: null, font: null },
                mono: { label: null, font: null },
            },
            uiFontSize: 'normal',
            editorFontSize: EDITOR_FONT_SIZE_DEFAULT,
            customActions: [
                {
                    id: 'default-translate',
                    name: '跳转到翻译',
                    command: '翻译',
                    isEnabled: true,
                }
            ],
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
            reorderSearchProviders: (nextIds) =>
                set((state) => {
                    const providerMap = new Map(state.searchProviders.map((provider) => [provider.id, provider]))
                    const nextProviders: SearchProvider[] = []
                    const seen = new Set<string>()

                    nextIds.forEach((id) => {
                        const provider = providerMap.get(id)
                        if (!provider || seen.has(id)) return
                        nextProviders.push(provider)
                        seen.add(id)
                    })

                    state.searchProviders.forEach((provider) => {
                        if (seen.has(provider.id)) return
                        nextProviders.push(provider)
                    })

                    return { searchProviders: nextProviders }
                }),
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
            setWakeHotkey: (hotkey) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        wakeHotkey: hotkey,
                    },
                })),
            setWakeHotkeyEnabled: (enabled) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        wakeHotkeyEnabled: enabled,
                    },
                })),
            setSearchHotkey: (hotkey) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        searchHotkey: hotkey,
                    },
                })),
            setSearchHotkeyEnabled: (enabled) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        searchHotkeyEnabled: enabled,
                    },
                })),
            setAutoOpenLastNote: (enabled) =>
                set((state) => ({
                    privacy: { ...state.privacy, autoOpenLastNote: enabled },
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
            addCustomAction: (action) =>
                set((state) => ({
                    customActions: [...state.customActions, {
                        ...action,
                        id: Date.now().toString(),
                    }],
                })),
            updateCustomAction: (id, updates) =>
                set((state) => ({
                    customActions: state.customActions.map((a) => {
                        if (a.id !== id) return a
                        const newAction = { ...a, ...updates }
                        // 名称为空时自动关闭
                        if (!newAction.name.trim()) newAction.isEnabled = false
                        return newAction
                    }),
                })),
            removeCustomAction: (id) =>
                set((state) => ({
                    customActions: state.customActions.filter((a) => a.id !== id),
                })),
        }),
        {
            name: 'goose-note-settings',
            storage: createJSONStorage(() => uToolsStorage),
            onRehydrateStorage: () => (state) => {
                const theme = state?.theme || 'system'
                const codeStyle = normalizeCodeStyle(state?.codeStyle as string | undefined)
                applyTheme(theme)
                applyCodeStyle(codeStyle)
                if (state && state.codeStyle !== codeStyle) {
                    useSettings.setState({ codeStyle })
                }
                
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
                         const hostWindow = window as Window & {
                            utools?: {
                                setExpendHeight?: (height: number) => void
                            }
                         }
                         hostWindow.utools?.setExpendHeight?.(state.utools.windowHeight)
                    } catch (e) {
                        console.error("Failed to apply window height on rehydrate", e)
                    }
                }

                if (state) {
                    const mergedProviders = mergeSearchProvidersWithDefaults(state.searchProviders)
                    if (JSON.stringify(state.searchProviders) !== JSON.stringify(mergedProviders)) {
                        useSettings.setState({ searchProviders: mergedProviders })
                    }

                    const storedDesktop = state.desktop as Partial<DesktopSettings> | undefined
                    const mergedDesktop: DesktopSettings = {
                        wakeHotkey: storedDesktop?.wakeHotkey ?? DEFAULT_WAKE_HOTKEY,
                        wakeHotkeyEnabled: storedDesktop?.wakeHotkeyEnabled ?? true,
                        searchHotkey: storedDesktop?.searchHotkey ?? DEFAULT_SEARCH_HOTKEY,
                        searchHotkeyEnabled: storedDesktop?.searchHotkeyEnabled ?? true,
                    }
                    if (JSON.stringify(state.desktop) !== JSON.stringify(mergedDesktop)) {
                        useSettings.setState({ desktop: mergedDesktop })
                    }
                }
            },
        }
    )
)

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
        case 'night':
            // Tokyo Night
            finalClass = isDark ? 'tokyo-night' : 'github-light-mod' // 'github-light-mod' was mapped to tokyo-day-ish in old map
            break
        case 'nord':
            finalClass = 'nord'
            break
        case 'nord-light':
            finalClass = 'nord-light'
            break
        default:
            finalClass = isDark ? 'github-dark' : 'github-light'
    }

    if (finalClass) {
        root.classList.add(finalClass)
    }
}
