import { useEffect } from "react";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { usePages } from "./stores/usePages";
import { useTabs } from "./stores/useTabs";
import { StickyNotePage } from "./pages/sticky-note";
import {
  useSettings,
  EDITOR_FONT_SIZE_DEFAULT,
} from "@/stores/useSettings";
import { useAppHotkeys } from "./hooks/useAppHotkeys";
import { usePluginEvents } from "./hooks/usePluginEvents";

const UI_FONT_SIZE_MAP = {
  small: 14,
  normal: 16,
} as const;

function App() {
  const {
    uiFontSize,
    editorFontSize,
    customFonts,
    privacy,
  } = useSettings();
  const { hydrated, onboardingCompleted, activePageId } = usePages();

  // 绑定全局快捷键
  useAppHotkeys();

  // 订阅插件/本地关联事件
  const { restoreLastNoteIfNeeded, clearActivePageForBlankEntry } = usePluginEvents();

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__gooseNoteAutoOpenLastNote = privacy.autoOpenLastNote;
  }, [privacy.autoOpenLastNote]);

  // 首次打开应用时创建新手引导页面
  useEffect(() => {
    if (hydrated && !onboardingCompleted) {
      usePages.getState().createOnboardingPages();
    }
  }, [hydrated, onboardingCompleted]);

  // 同步 tab 状态：旧数据迁移 & 清理已删除页面的 tab
  useEffect(() => {
    if (!hydrated) return;
    const { activePageId, pages } = usePages.getState();
    const { openTabs, openTab } = useTabs.getState();

    // 清理 openTabs 中已不存在 of 页面
    const validTabs = openTabs.filter(
      (tab) => pages[tab.pageId] && !pages[tab.pageId].trashedAt,
    );
    if (validTabs.length !== openTabs.length) {
      useTabs.setState({ openTabs: validTabs });
      if (
        useTabs.getState().activeTabId &&
        !validTabs.some((tab) => tab.id === useTabs.getState().activeTabId)
      ) {
        useTabs.setState({ activeTabId: validTabs[0]?.id ?? null });
      }
    }

    // 仅在没有标签时，用当前页面初始化第一个标签
    if (
      activePageId &&
      useTabs.getState().openTabs.length === 0 &&
      pages[activePageId]
    ) {
      openTab(activePageId);
    }
  }, [hydrated, activePageId]);

  // 根据隐私设置决定是否自动打开上次笔记
  useEffect(() => {
    if (!hydrated) return;

    const { privacy } = useSettings.getState();
    if (!privacy.autoOpenLastNote) {
      clearActivePageForBlankEntry();
      return;
    }

    restoreLastNoteIfNeeded();
  }, [hydrated, privacy.autoOpenLastNote, restoreLastNoteIfNeeded, clearActivePageForBlankEntry]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const targetSize = UI_FONT_SIZE_MAP[uiFontSize] ?? UI_FONT_SIZE_MAP.small;
    root.style.setProperty("font-size", `${targetSize}px`);
  }, [uiFontSize]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--editor-font-size", `${editorFontSize}px`);
    root.style.setProperty(
      "--editor-scale",
      (editorFontSize / EDITOR_FONT_SIZE_DEFAULT).toFixed(4),
    );
  }, [editorFontSize]);

  useEffect(() => {
    applyFontVariables(customFonts);
  }, [customFonts]);

  return (
    <>
      <WorkspacePage />
      <StickyNotePage />
      <Toaster />
    </>
  );
}

export default App;
