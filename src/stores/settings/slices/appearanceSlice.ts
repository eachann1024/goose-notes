import type { Theme, CodeStyle, CustomFonts, UIFontSize } from '../types'
import { EDITOR_FONT_SIZE_MIN, EDITOR_FONT_SIZE_MAX, EDITOR_FONT_SIZE_DEFAULT, DEFAULT_UI_FONT_SIZE } from '../types'

export interface AppearanceSliceState {
    theme: Theme
    codeStyle: CodeStyle
    defaultCodeBlockWrap: boolean
    globalEditorFullWidth: boolean
    customFonts: CustomFonts
    uiFontSize: UIFontSize
    editorFontSize: number
    /** AI 聊天界面字号缩放比。可选值：0.8 / 0.9 / 1.0 / 1.1 / 1.2。副作用：影响 AI 聊天面板所有文字大小。 */
    aiChatScale: number
}

export interface AppearanceSliceActions {
    setTheme: (theme: Theme) => void
    setCodeStyle: (style: CodeStyle) => void
    setDefaultCodeBlockWrap: (enabled: boolean) => void
    setGlobalEditorFullWidth: (enabled: boolean) => void
    setCustomLabel: (type: 'default' | 'serif' | 'mono', label: string | null) => void
    setCustomFont: (type: 'default' | 'serif' | 'mono', font: string | null) => void
    resetCustomFont: (type: 'default' | 'serif' | 'mono') => void
    setUIFontSize: (size: UIFontSize) => void
    setEditorFontSize: (size: number) => void
    increaseEditorFontSize: () => void
    decreaseEditorFontSize: () => void
    resetEditorFontSize: () => void
    setAiChatScale: (scale: number) => void
    increaseAiChatScale: () => void
    decreaseAiChatScale: () => void
}

export type AppearanceSlice = AppearanceSliceState & AppearanceSliceActions

export const APPEARANCE_INITIAL_STATE: AppearanceSliceState = {
    theme: 'system',
    codeStyle: 'default',
    defaultCodeBlockWrap: false,
    globalEditorFullWidth: false,
    customFonts: {
        default: { label: null, font: null },
        serif: { label: null, font: null },
        mono: { label: null, font: null },
    },
    uiFontSize: DEFAULT_UI_FONT_SIZE,
    editorFontSize: EDITOR_FONT_SIZE_DEFAULT,
    aiChatScale: 1.0,
}

type SetFn = (updater: Partial<AppearanceSlice> | ((state: AppearanceSlice) => Partial<AppearanceSlice>)) => void
type GetApplyFns = () => { applyTheme: (theme: Theme) => void; applyCodeStyle: (codeStyle: CodeStyle) => void }

export function createAppearanceSlice(set: SetFn, getApply: GetApplyFns): AppearanceSlice {
    return {
        ...APPEARANCE_INITIAL_STATE,
        setTheme: (theme) => {
            set({ theme })
            getApply().applyTheme(theme)
        },
        setCodeStyle: (codeStyle) => {
            set({ codeStyle })
            getApply().applyCodeStyle(codeStyle)
        },
        setDefaultCodeBlockWrap: (defaultCodeBlockWrap) => set({ defaultCodeBlockWrap }),
        setGlobalEditorFullWidth: (globalEditorFullWidth) => set({ globalEditorFullWidth }),
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
        setAiChatScale: (scale) => set({ aiChatScale: Math.max(0.7, Math.min(1.5, scale)) }),
        increaseAiChatScale: () =>
            set((state) => ({ aiChatScale: Math.min(1.5, Math.round((state.aiChatScale + 0.1) * 10) / 10) })),
        decreaseAiChatScale: () =>
            set((state) => ({ aiChatScale: Math.max(0.7, Math.round((state.aiChatScale - 0.1) * 10) / 10) })),
    }
}
