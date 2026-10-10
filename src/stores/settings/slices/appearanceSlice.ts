import type {
  AccentColor,
  Theme,
  CustomFonts,
  UIFontSize,
} from "../types";
import {
  DEFAULT_ACCENT_COLOR,
  EDITOR_FONT_SIZE_DEFAULT,
  EDITOR_LINE_HEIGHT_DEFAULT,
  normalizeEditorLineHeight,
  DEFAULT_UI_FONT_SIZE,
  SIDEBAR_FONT_SIZE_DEFAULT,
  normalizeEditorFontSize,
  normalizeSidebarFontSize,
  normalizeUIFontSize,
} from "../types";
import type { CardThemeId } from "@/lib/imageExport/themes";
import { normalizeLocalFontName } from "@/lib/fontLoader";
import type { WatermarkConfig } from "@/lib/imageExport/watermark";
import {
  DEFAULT_WATERMARK_CONFIG,
  normalizeWatermarkConfig,
} from "@/lib/imageExport/watermark";

export interface AppearanceSliceState {
  theme: Theme;
  accentColor: AccentColor;
  defaultCodeBlockWrap: boolean;
  customFonts: CustomFonts;
  uiFontFamily: string | null;
  sidebarFontFamily: string | null;
  uiFontSize: UIFontSize;
  editorFontSize: number;
  editorLineHeight: number;
  /** 旧版侧栏字号，仅保留存储兼容；当前侧栏跟随界面缩放。 */
  sidebarFontSize: number;
  /** AI 聊天界面字号缩放比。可选值：0.8 / 0.9 / 1.0 / 1.1 / 1.2。副作用：影响 AI 聊天面板所有文字大小。 */
  aiChatScale: number;
  /** 导出图片的水印/生成选项，跨会话记忆用户选择 */
  imageExportWatermark: WatermarkConfig;
  /** 导出图片上次选择的卡片主题 */
  imageExportThemeId: CardThemeId;
  /** 新建笔记时自动分配随机图标；本地文件同样生效，文件夹忽略。 */
  randomIconOnCreate: boolean;

  /** 极简工作区：所有页面在当前标签中切换。产品固定开启，设置里不再提供开关。 */
  singleTabMode: boolean;
}

export interface AppearanceSliceActions {
  setTheme: (theme: Theme) => void;
  setAccentColor: (accentColor: AccentColor) => void;
  toggleDarkMode: () => void;
  setDefaultCodeBlockWrap: (enabled: boolean) => void;
  setCustomLabel: (
    type: "default" | "serif" | "mono",
    label: string | null,
  ) => void;
  setCustomFont: (
    type: "default" | "serif" | "mono",
    font: string | null,
  ) => void;
  resetCustomFont: (type: "default" | "serif" | "mono") => void;
  setUIFontFamily: (font: string | null) => void;
  setSidebarFontFamily: (font: string | null) => void;
  setUIFontSize: (size: UIFontSize) => void;
  setEditorFontSize: (size: number) => void;
  setEditorLineHeight: (height: number) => void;
  increaseEditorFontSize: () => void;
  decreaseEditorFontSize: () => void;
  resetEditorFontSize: () => void;
  setSidebarFontSize: (size: number) => void;
  increaseSidebarFontSize: () => void;
  decreaseSidebarFontSize: () => void;
  setAiChatScale: (scale: number) => void;
  increaseAiChatScale: () => void;
  decreaseAiChatScale: () => void;
  setImageExportWatermark: (config: Partial<WatermarkConfig>) => void;
  setImageExportThemeId: (id: CardThemeId) => void;
  setRandomIconOnCreate: (enabled: boolean) => void;

  setSingleTabMode: (enabled: boolean) => void;
}

export type AppearanceSlice = AppearanceSliceState & AppearanceSliceActions;

export const APPEARANCE_INITIAL_STATE: AppearanceSliceState = {
  theme: "system",
  accentColor: DEFAULT_ACCENT_COLOR,
  defaultCodeBlockWrap: false,
  customFonts: {
    default: { label: null, font: null },
    serif: { label: null, font: null },
    mono: { label: null, font: null },
  },
  uiFontFamily: null,
  sidebarFontFamily: null,
  uiFontSize: DEFAULT_UI_FONT_SIZE,
  editorFontSize: EDITOR_FONT_SIZE_DEFAULT,
  editorLineHeight: EDITOR_LINE_HEIGHT_DEFAULT,
  sidebarFontSize: SIDEBAR_FONT_SIZE_DEFAULT,
  aiChatScale: 1.0,
  imageExportWatermark: DEFAULT_WATERMARK_CONFIG,
  imageExportThemeId: "notebook",
  randomIconOnCreate: false,

  singleTabMode: true,
};

type SetFn = (
  updater:
    | Partial<AppearanceSlice>
    | ((state: AppearanceSlice) => Partial<AppearanceSlice>),
) => void;
type GetApplyFns = () => {
  applyTheme: (theme: Theme) => void;
  applyAccentColor: (accentColor: AccentColor) => void;
};

export function createAppearanceSlice(
  set: SetFn,
  getApply: GetApplyFns,
): AppearanceSlice {
  return {
    ...APPEARANCE_INITIAL_STATE,
    setTheme: (theme) => {
      set({ theme });
      getApply().applyTheme(theme);
    },
    setAccentColor: (accentColor) => {
      set({ accentColor });
      getApply().applyAccentColor(accentColor);
    },
    toggleDarkMode: () => {
      set((state) => {
        // 侧栏/快捷键按固定顺序轮转：系统 → 浅色 → 深色 → 系统
        const nextTheme: Theme =
          state.theme === "system"
            ? "light"
            : state.theme === "light"
              ? "dark"
              : "system";
        getApply().applyTheme(nextTheme);
        return { theme: nextTheme };
      });
    },
    setDefaultCodeBlockWrap: (defaultCodeBlockWrap) =>
      set({ defaultCodeBlockWrap }),
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
    setUIFontFamily: (font) =>
      set({ uiFontFamily: normalizeLocalFontName(font) }),
    setSidebarFontFamily: (font) =>
      set({ sidebarFontFamily: normalizeLocalFontName(font) }),
    setUIFontSize: (uiFontSize) => set({ uiFontSize: normalizeUIFontSize(uiFontSize) }),
    setEditorFontSize: (size) =>
      set({
        editorFontSize: normalizeEditorFontSize(size),
      }),
    setEditorLineHeight: (height) =>
      set({ editorLineHeight: normalizeEditorLineHeight(height) }),
    increaseEditorFontSize: () =>
      set((state) => ({
        editorFontSize: normalizeEditorFontSize(state.editorFontSize + 1),
      })),
    decreaseEditorFontSize: () =>
      set((state) => ({
        editorFontSize: normalizeEditorFontSize(state.editorFontSize - 1),
      })),
    resetEditorFontSize: () =>
      set({ editorFontSize: EDITOR_FONT_SIZE_DEFAULT }),
    setSidebarFontSize: (size) =>
      set({
        sidebarFontSize: normalizeSidebarFontSize(size),
      }),
    increaseSidebarFontSize: () =>
      set((state) => ({
        sidebarFontSize: normalizeSidebarFontSize(state.sidebarFontSize + 1),
      })),
    decreaseSidebarFontSize: () =>
      set((state) => ({
        sidebarFontSize: normalizeSidebarFontSize(state.sidebarFontSize - 1),
      })),
    setAiChatScale: (scale) =>
      set({ aiChatScale: Math.max(0.7, Math.min(1.5, scale)) }),
    increaseAiChatScale: () =>
      set((state) => ({
        aiChatScale: Math.min(
          1.5,
          Math.round((state.aiChatScale + 0.1) * 10) / 10,
        ),
      })),
    decreaseAiChatScale: () =>
      set((state) => ({
        aiChatScale: Math.max(
          0.7,
          Math.round((state.aiChatScale - 0.1) * 10) / 10,
        ),
      })),
    setImageExportWatermark: (config) =>
      set({ imageExportWatermark: normalizeWatermarkConfig(config) }),
    setImageExportThemeId: (imageExportThemeId) => set({ imageExportThemeId }),
    setRandomIconOnCreate: (randomIconOnCreate) => set({ randomIconOnCreate }),

    setSingleTabMode: (singleTabMode) => set({ singleTabMode }),
  };
}
