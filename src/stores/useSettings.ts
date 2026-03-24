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

export interface AISettings {
    enabled: boolean
    selectedModelId: string | null
}

export type DesktopHotkeyStatusState = 'idle' | 'active' | 'occupied' | 'invalid' | 'disabled' | 'error'

export interface DesktopHotkeyStatus {
    state: DesktopHotkeyStatusState
    message?: string
    rawError?: string
}

export interface DesktopSettings {
    wakeHotkey: string
    wakeHotkeyEnabled: boolean
    searchHotkey: string
    searchHotkeyEnabled: boolean
    wakeHotkeyStatus: DesktopHotkeyStatus
    searchHotkeyStatus: DesktopHotkeyStatus
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

// 界面字体大小选项：small 对应“标准”，normal 对应“放大”
export type UIFontSize = 'small' | 'normal'

// 编辑器字体大小边界
export const EDITOR_FONT_SIZE_MIN = 12
export const EDITOR_FONT_SIZE_MAX = 24
export const EDITOR_FONT_SIZE_DEFAULT = 16
export const DEFAULT_WAKE_HOTKEY = "CmdOrCtrl+Alt+N"
export const DEFAULT_SEARCH_HOTKEY = "CmdOrCtrl+Shift+K"
export const DEFAULT_CLOSE_TAB_SHORTCUT = "Alt+W"
export const DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT = ""
export const UTOOLS_WINDOW_HEIGHT_MIN = 600
export const UTOOLS_WINDOW_HEIGHT_MAX = 1200
const DEFAULT_UI_FONT_SIZE: UIFontSize = 'small'
const LEGACY_DEFAULT_CUSTOM_ACTION_ID = 'default-translate'

interface SettingsState {
    theme: Theme
    codeStyle: CodeStyle
    defaultCodeBlockWrap: boolean
    globalEditorFullWidth: boolean
    searchProviders: SearchProvider[]
    utools: UToolsSettings
    ai: AISettings
    desktop: DesktopSettings
    privacy: PrivacySettings
    searchAllNotebooks: boolean
    showRecentInSearch: boolean
    closeTabShortcut: string
    searchPanelCloseShortcut: string
    customFonts: CustomFonts
    uiFontSize: UIFontSize
    editorFontSize: number
    customActions: CustomAction[]
    setTheme: (theme: Theme) => void
    setCodeStyle: (style: CodeStyle) => void
    setDefaultCodeBlockWrap: (enabled: boolean) => void
    setGlobalEditorFullWidth: (enabled: boolean) => void
    toggleSearchProvider: (id: string) => void
    reorderSearchProviders: (nextIds: string[]) => void
    setUToolsGlobalSearchEnabled: (enabled: boolean) => void
    setOpenSearchInUtools: (enabled: boolean) => void
    setAIEnabled: (enabled: boolean) => void
    setAISelectedModelId: (modelId: string | null) => void

    setUToolsWindowHeight: (height: number) => void
    setWakeHotkey: (hotkey: string) => void
    setWakeHotkeyEnabled: (enabled: boolean) => void
    setSearchHotkey: (hotkey: string) => void
    setSearchHotkeyEnabled: (enabled: boolean) => void
    setWakeHotkeyStatus: (status: DesktopHotkeyStatus) => void
    setSearchHotkeyStatus: (status: DesktopHotkeyStatus) => void
    setAutoOpenLastNote: (enabled: boolean) => void
    setSearchAllNotebooks: (searchAll: boolean) => void
    setShowRecentInSearch: (enabled: boolean) => void
    setCloseTabShortcut: (shortcut: string) => void
    setSearchPanelCloseShortcut: (shortcut: string) => void
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
        urlTemplate: 'https://ai.quark.cn/s?q=%s',
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

const DEFAULT_HOTKEY_STATUS: DesktopHotkeyStatus = {
    state: 'idle',
}

function normalizeDesktopHotkeyStatus(
    status: Partial<DesktopHotkeyStatus> | undefined,
): DesktopHotkeyStatus {
    const state = status?.state
    if (
        state !== 'idle' &&
        state !== 'active' &&
        state !== 'occupied' &&
        state !== 'invalid' &&
        state !== 'disabled' &&
        state !== 'error'
    ) {
        return DEFAULT_HOTKEY_STATUS
    }

    return {
        state,
        message: status?.message,
        rawError: status?.rawError,
    }
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

function normalizeUIFontSize(uiFontSize: string | undefined): UIFontSize {
    if (uiFontSize === 'small') return 'small'
    if (uiFontSize === 'normal' || uiFontSize === 'large') return 'normal'
    return DEFAULT_UI_FONT_SIZE
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

function normalizeCustomActions(customActions: CustomAction[] | undefined): CustomAction[] {
    if (!Array.isArray(customActions)) {
        return []
    }

    const normalized = customActions
        .filter((action): action is CustomAction => Boolean(action && typeof action === 'object'))
        .map((action, index) => ({
            id: typeof action.id === 'string' && action.id.trim()
                ? action.id.trim()
                : `custom-action-${Date.now()}-${index}`,
            name: typeof action.name === 'string' ? action.name.trim() : '',
            pluginName:
                typeof action.pluginName === 'string' && action.pluginName.trim()
                    ? action.pluginName.trim()
                    : undefined,
            command: typeof action.command === 'string' ? action.command.trim() : '',
            isEnabled: Boolean(action.isEnabled),
        }))

    if (
        normalized.length === 1 &&
        normalized[0].id === LEGACY_DEFAULT_CUSTOM_ACTION_ID &&
        normalized[0].name === '跳转到翻译' &&
        normalized[0].command === '翻译' &&
        normalized[0].isEnabled &&
        !normalized[0].pluginName
    ) {
        return []
    }

    return normalized
}

export const useSettings = create<SettingsState>()(
    persist(
        (set) => ({
            theme: 'system',
            codeStyle: 'default',
            defaultCodeBlockWrap: false,
            globalEditorFullWidth: false,
            searchProviders: DEFAULT_SEARCH_PROVIDERS,
            utools: {
                globalSearchEnabled: false,
                openSearchInUtools: true,

                windowHeight: UTOOLS_WINDOW_HEIGHT_MIN,
            },
            ai: {
                enabled: false,
                selectedModelId: null,
            },
            desktop: {
                wakeHotkey: DEFAULT_WAKE_HOTKEY,
                wakeHotkeyEnabled: true,
                searchHotkey: DEFAULT_SEARCH_HOTKEY,
                searchHotkeyEnabled: true,
                wakeHotkeyStatus: DEFAULT_HOTKEY_STATUS,
                searchHotkeyStatus: DEFAULT_HOTKEY_STATUS,
            },
            privacy: {
                autoOpenLastNote: true,
            },
            searchAllNotebooks: false,
            showRecentInSearch: true,
            closeTabShortcut: DEFAULT_CLOSE_TAB_SHORTCUT,
            searchPanelCloseShortcut: DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT,
            customFonts: {
                default: { label: null, font: null },
                serif: { label: null, font: null },
                mono: { label: null, font: null },
            },
            uiFontSize: DEFAULT_UI_FONT_SIZE,
            editorFontSize: EDITOR_FONT_SIZE_DEFAULT,
            customActions: [],
            setTheme: (theme) => {
                set({ theme })
                applyTheme(theme)
            },
            setCodeStyle: (codeStyle) => {
                set({ codeStyle })
                applyCodeStyle(codeStyle)
            },
            setDefaultCodeBlockWrap: (defaultCodeBlockWrap) =>
                set({ defaultCodeBlockWrap }),
            setGlobalEditorFullWidth: (globalEditorFullWidth) => set({ globalEditorFullWidth }),
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
            setAIEnabled: (enabled) =>
                set((state) => ({
                    ai: { ...state.ai, enabled },
                })),
            setAISelectedModelId: (selectedModelId) =>
                set((state) => ({
                    ai: { ...state.ai, selectedModelId },
                })),

            setUToolsWindowHeight: (height) =>
                set((state) => ({
                    utools: {
                        ...state.utools,
                        windowHeight: Math.min(
                            UTOOLS_WINDOW_HEIGHT_MAX,
                            Math.max(UTOOLS_WINDOW_HEIGHT_MIN, height),
                        ),
                    },
                })),
            setWakeHotkey: (hotkey) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        wakeHotkey: hotkey,
                        wakeHotkeyStatus: DEFAULT_HOTKEY_STATUS,
                    },
                })),
            setWakeHotkeyEnabled: (enabled) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        wakeHotkeyEnabled: enabled,
                        wakeHotkeyStatus: enabled ? DEFAULT_HOTKEY_STATUS : {
                            state: 'disabled',
                            message: '已关闭全局唤醒快捷键',
                        },
                    },
                })),
            setSearchHotkey: (hotkey) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        searchHotkey: hotkey,
                        searchHotkeyStatus: DEFAULT_HOTKEY_STATUS,
                    },
                })),
            setSearchHotkeyEnabled: (enabled) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        searchHotkeyEnabled: enabled,
                        searchHotkeyStatus: enabled ? DEFAULT_HOTKEY_STATUS : {
                            state: 'disabled',
                            message: '已关闭全局搜索快捷键',
                        },
                    },
                })),
            setWakeHotkeyStatus: (status) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        wakeHotkeyStatus: normalizeDesktopHotkeyStatus(status),
                    },
                })),
            setSearchHotkeyStatus: (status) =>
                set((state) => ({
                    desktop: {
                        ...state.desktop,
                        searchHotkeyStatus: normalizeDesktopHotkeyStatus(status),
                    },
                })),
            setAutoOpenLastNote: (enabled) =>
                set((state) => ({
                    privacy: { ...state.privacy, autoOpenLastNote: enabled },
                })),
            setSearchAllNotebooks: (searchAll) => set({ searchAllNotebooks: searchAll }),
            setShowRecentInSearch: (enabled) => set({ showRecentInSearch: enabled }),
            setCloseTabShortcut: (shortcut) => set({ closeTabShortcut: shortcut }),
            setSearchPanelCloseShortcut: (shortcut) =>
                set({ searchPanelCloseShortcut: shortcut }),
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
            skipHydration: true,
            onRehydrateStorage: () => (state) => {
                const theme = state?.theme || 'system'
                const codeStyle = normalizeCodeStyle(state?.codeStyle as string | undefined)
                applyTheme(theme)
                applyCodeStyle(codeStyle)
                if (state && state.codeStyle !== codeStyle) {
                    useSettings.setState({ codeStyle })
                }
                if (state && typeof state.defaultCodeBlockWrap !== 'boolean') {
                    useSettings.setState({ defaultCodeBlockWrap: false })
                }
                const normalizedUIFontSize = normalizeUIFontSize(state?.uiFontSize as string | undefined)
                if (state && state.uiFontSize !== normalizedUIFontSize) {
                    useSettings.setState({ uiFontSize: normalizedUIFontSize })
                }
                
                const normalizedWindowHeight = Math.min(
                    UTOOLS_WINDOW_HEIGHT_MAX,
                    Math.max(
                        UTOOLS_WINDOW_HEIGHT_MIN,
                        state?.utools?.windowHeight ?? UTOOLS_WINDOW_HEIGHT_MIN,
                    ),
                )
                if (
                    state?.utools &&
                    state.utools.windowHeight !== normalizedWindowHeight
                ) {
                    useSettings.setState({
                        utools: {
                            ...state.utools,
                            windowHeight: normalizedWindowHeight,
                        },
                    })
                }

                const normalizedUTools: UToolsSettings | null = state?.utools
                    ? {
                        globalSearchEnabled: Boolean(state.utools.globalSearchEnabled),
                        openSearchInUtools:
                            typeof state.utools.openSearchInUtools === 'boolean'
                                ? state.utools.openSearchInUtools
                                : true,
                        windowHeight: normalizedWindowHeight,
                    }
                    : null
                if (
                    normalizedUTools &&
                    JSON.stringify(state?.utools ?? null) !== JSON.stringify(normalizedUTools)
                ) {
                    useSettings.setState({ utools: normalizedUTools })
                }

                // Apply window height immediately upon rehydration
                if (normalizedUTools) {
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
                         hostWindow.utools?.setExpendHeight?.(normalizedUTools.windowHeight)
                    } catch (e) {
                        console.error("Failed to apply window height on rehydrate", e)
                    }
                }

                const normalizedAI = state?.ai
                    ? {
                        enabled: Boolean(state.ai.enabled),
                        selectedModelId:
                            typeof state.ai.selectedModelId === 'string' && state.ai.selectedModelId.trim()
                                ? state.ai.selectedModelId.trim()
                                : null,
                    }
                    : {
                        enabled: false,
                        selectedModelId: null,
                    }
                if (JSON.stringify(state?.ai ?? null) !== JSON.stringify(normalizedAI)) {
                    useSettings.setState({ ai: normalizedAI })
                }

                if (state) {
                    if (typeof state.showRecentInSearch !== 'boolean') {
                        useSettings.setState({ showRecentInSearch: true })
                    }

                    const normalizedCloseTabShortcut =
                        typeof state.closeTabShortcut === 'string'
                            ? state.closeTabShortcut.trim()
                            : DEFAULT_CLOSE_TAB_SHORTCUT
                    const normalizedSearchPanelCloseShortcut =
                        typeof state.searchPanelCloseShortcut === 'string'
                            ? state.searchPanelCloseShortcut.trim()
                            : DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT
                    if (
                        state.closeTabShortcut !== normalizedCloseTabShortcut ||
                        state.searchPanelCloseShortcut !== normalizedSearchPanelCloseShortcut
                    ) {
                        useSettings.setState({
                            closeTabShortcut: normalizedCloseTabShortcut,
                            searchPanelCloseShortcut: normalizedSearchPanelCloseShortcut,
                        })
                    }

                    const mergedProviders = mergeSearchProvidersWithDefaults(state.searchProviders)
                    if (JSON.stringify(state.searchProviders) !== JSON.stringify(mergedProviders)) {
                        useSettings.setState({ searchProviders: mergedProviders })
                    }

                    const normalizedCustomActions = normalizeCustomActions(state.customActions)
                    if (JSON.stringify(state.customActions ?? []) !== JSON.stringify(normalizedCustomActions)) {
                        useSettings.setState({ customActions: normalizedCustomActions })
                    }

                    const storedDesktop = state.desktop as Partial<DesktopSettings> | undefined
                    const mergedDesktop: DesktopSettings = {
                        wakeHotkey: storedDesktop?.wakeHotkey ?? DEFAULT_WAKE_HOTKEY,
                        wakeHotkeyEnabled: storedDesktop?.wakeHotkeyEnabled ?? true,
                        searchHotkey: storedDesktop?.searchHotkey ?? DEFAULT_SEARCH_HOTKEY,
                        searchHotkeyEnabled: storedDesktop?.searchHotkeyEnabled ?? true,
                        wakeHotkeyStatus: normalizeDesktopHotkeyStatus(storedDesktop?.wakeHotkeyStatus),
                        searchHotkeyStatus: normalizeDesktopHotkeyStatus(storedDesktop?.searchHotkeyStatus),
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

    void applyNativeWindowTheme(theme, isDark)

    // Re-apply code style when theme changes (because light/dark mode changed)
    const state = useSettings.getState()
    if (state) {
        applyCodeStyle(state.codeStyle)
    }
}

async function applyNativeWindowTheme(theme: Theme, isDark: boolean) {
    void theme
    void isDark
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
