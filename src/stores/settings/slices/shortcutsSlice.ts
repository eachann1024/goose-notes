import type { DesktopSettings, DesktopHotkeyStatus } from '../types'
import {
    DEFAULT_WAKE_HOTKEY,
    DEFAULT_SEARCH_HOTKEY,
    DEFAULT_QUICKNOTE_HOTKEY,
    DEFAULT_CLOSE_TAB_SHORTCUT,
    DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT,
    DEFAULT_HOTKEY_STATUS,
    normalizeDesktopHotkeyStatus,
} from '../types'
import { FIXED_SPLIT_SHORTCUTS, isReservedCloseOrSplitShortcut, NON_CUSTOMIZABLE_APP_SHORTCUT_IDS } from '@/lib/fixed-app-shortcuts'

export const DEFAULT_APP_SHORTCUTS: Record<string, string> = {
    toggleSidebar: 'Alt+B',
    toggleAIPanel: 'Mod+J',
    openSearch: 'Mod+K',
    toggleTheme: 'Mod+Shift+L',
    navBack: 'Mod+[',
    navForward: 'Mod+]',
    newTab: 'Mod+T',
    ...FIXED_SPLIT_SHORTCUTS,
}

/** 同版本恢复/导入也执行：固定值覆盖旧值，迁走占用固定键的自定义动作。 */
export function normalizeAppShortcuts(stored: unknown): Record<string, string> {
    const result = { ...DEFAULT_APP_SHORTCUTS }
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return result
    for (const [id, value] of Object.entries(stored)) {
        if (NON_CUSTOMIZABLE_APP_SHORTCUT_IDS.has(id) || typeof value !== 'string') continue
        result[id] = isReservedCloseOrSplitShortcut(value)
            ? (DEFAULT_APP_SHORTCUTS[id] ?? '')
            : value.trim()
    }
    return result
}

export function normalizeFixedShortcutSettings<T extends {
    appShortcuts?: unknown
    closeTabShortcut?: unknown
    searchPanelCloseShortcut?: unknown
    desktop?: unknown
}>(state: T) {
    const desktop = state.desktop && typeof state.desktop === 'object'
        ? { ...state.desktop } as Record<string, unknown> : undefined
    if (desktop) {
        for (const [key, fallback] of [
            ['wakeHotkey', DEFAULT_WAKE_HOTKEY],
            ['searchHotkey', DEFAULT_SEARCH_HOTKEY],
            ['quicknoteHotkey', DEFAULT_QUICKNOTE_HOTKEY],
        ]) {
            if (typeof desktop[key] === 'string' && isReservedCloseOrSplitShortcut(desktop[key])) {
                desktop[key] = fallback
            }
        }
    }
    return {
        ...state,
        closeTabShortcut: DEFAULT_CLOSE_TAB_SHORTCUT,
        searchPanelCloseShortcut: DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT,
        appShortcuts: normalizeAppShortcuts(state.appShortcuts),
        ...(desktop ? { desktop } : {}),
    }
}

export interface ShortcutsSliceState {
    desktop: DesktopSettings
    closeTabShortcut: string
    searchPanelCloseShortcut: string
    appShortcuts: Record<string, string>
}

export interface ShortcutsSliceActions {
    setWakeHotkey: (hotkey: string) => void
    setWakeHotkeyEnabled: (enabled: boolean) => void
    setSearchHotkey: (hotkey: string) => void
    setSearchHotkeyEnabled: (enabled: boolean) => void
    setQuicknoteHotkey: (hotkey: string) => void
    setQuicknoteHotkeyEnabled: (enabled: boolean) => void
    setWakeHotkeyStatus: (status: DesktopHotkeyStatus) => void
    setSearchHotkeyStatus: (status: DesktopHotkeyStatus) => void
    setQuicknoteHotkeyStatus: (status: DesktopHotkeyStatus) => void
    setCloseTabShortcut: (shortcut: string) => void
    setSearchPanelCloseShortcut: (shortcut: string) => void
    setAppShortcut: (id: string, shortcut: string) => void
    resetAppShortcuts: () => void
}

export type ShortcutsSlice = ShortcutsSliceState & ShortcutsSliceActions

export const SHORTCUTS_INITIAL_STATE: ShortcutsSliceState = {
    desktop: {
        wakeHotkey: DEFAULT_WAKE_HOTKEY,
        wakeHotkeyEnabled: true,
        searchHotkey: DEFAULT_SEARCH_HOTKEY,
        searchHotkeyEnabled: true,
        quicknoteHotkey: DEFAULT_QUICKNOTE_HOTKEY,
        quicknoteHotkeyEnabled: true,
        wakeHotkeyStatus: DEFAULT_HOTKEY_STATUS,
        searchHotkeyStatus: DEFAULT_HOTKEY_STATUS,
        quicknoteHotkeyStatus: DEFAULT_HOTKEY_STATUS,
    },
    closeTabShortcut: DEFAULT_CLOSE_TAB_SHORTCUT,
    searchPanelCloseShortcut: DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT,
    appShortcuts: { ...DEFAULT_APP_SHORTCUTS },
}

type SetFn = (updater: Partial<ShortcutsSlice> | ((state: ShortcutsSlice) => Partial<ShortcutsSlice>)) => void

export function createShortcutsSlice(set: SetFn): ShortcutsSlice {
    return {
        ...SHORTCUTS_INITIAL_STATE,
        setWakeHotkey: (hotkey) =>
            set((state) => ({
                desktop: {
                    ...state.desktop,
                    wakeHotkey: isReservedCloseOrSplitShortcut(hotkey) ? state.desktop.wakeHotkey : hotkey,
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
                    searchHotkey: isReservedCloseOrSplitShortcut(hotkey) ? state.desktop.searchHotkey : hotkey,
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
        setQuicknoteHotkey: (hotkey) =>
            set((state) => ({
                desktop: {
                    ...state.desktop,
                    quicknoteHotkey: isReservedCloseOrSplitShortcut(hotkey) ? state.desktop.quicknoteHotkey : hotkey,
                    quicknoteHotkeyStatus: DEFAULT_HOTKEY_STATUS,
                },
            })),
        setQuicknoteHotkeyEnabled: (enabled) =>
            set((state) => ({
                desktop: {
                    ...state.desktop,
                    quicknoteHotkeyEnabled: enabled,
                    quicknoteHotkeyStatus: enabled ? DEFAULT_HOTKEY_STATUS : {
                        state: 'disabled',
                        message: '已关闭速记小窗全局快捷键',
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
        setQuicknoteHotkeyStatus: (status) =>
            set((state) => ({
                desktop: {
                    ...state.desktop,
                    quicknoteHotkeyStatus: normalizeDesktopHotkeyStatus(status),
                },
            })),
        setCloseTabShortcut: () => set({ closeTabShortcut: DEFAULT_CLOSE_TAB_SHORTCUT }),
        setSearchPanelCloseShortcut: () => set({ searchPanelCloseShortcut: DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT }),
        setAppShortcut: (id, shortcut) => {
            if (NON_CUSTOMIZABLE_APP_SHORTCUT_IDS.has(id) || isReservedCloseOrSplitShortcut(shortcut)) return
            set((state) => ({
                appShortcuts: { ...state.appShortcuts, [id]: shortcut },
            }))
        },
        resetAppShortcuts: () => set({ appShortcuts: { ...DEFAULT_APP_SHORTCUTS } }),
    }
}
