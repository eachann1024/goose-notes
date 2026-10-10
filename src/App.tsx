import { SetupGuide } from "@/pages/workspace/components/SetupGuide";
import { useEffect, useState } from "react";
import { isSetupGuideVisible } from "@/lib/setupGuide";
import { useShallow } from "zustand/react/shallow";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { usePages } from "./stores/usePages";
import { useTabs } from "./stores/useTabs";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import { useAppHotkeys } from "./hooks/useAppHotkeys";
import { useDesktopHotkeys } from "./hooks/useDesktopHotkeys";
import { usePluginEvents } from "./hooks/usePluginEvents";
import { useNativeContextMenuGuard } from "./hooks/useNativeContextMenuGuard";
import {
  applyAppearanceScaleVariables,
  releaseStartupSettlingAfterPaint,
} from "@/lib/appearance";
import { shouldPreserveStartupSelection } from "@/lib/workspaceStartup";
import { PencilIconDefinitions } from "@/components/theme/PencilIconDefinitions";

// Appearance changes update CSS without re-rendering the whole workspace.
function AppearanceSync() {
  const {
    uiFontSize, editorFontSize, editorLineHeight,
    customFonts, uiFontFamily, sidebarFontFamily,
  } = useSettings(useShallow((state) => ({
      uiFontSize: state.uiFontSize,
      editorFontSize: state.editorFontSize,
      editorLineHeight: state.editorLineHeight,
      customFonts: state.customFonts,
      uiFontFamily: state.uiFontFamily,
      sidebarFontFamily: state.sidebarFontFamily,
    })));
  useEffect(() => {
    applyAppearanceScaleVariables({ uiFontSize, editorFontSize, editorLineHeight });
  }, [uiFontSize, editorFontSize, editorLineHeight]);

  useEffect(() => {
    applyFontVariables(customFonts, { uiFontFamily, sidebarFontFamily });
  }, [customFonts, uiFontFamily, sidebarFontFamily]);

  return null;
}

function App() {
  const settingsHydrated = useSettings((state) => state._hasHydrated);
  const showSetupGuide = useSettings(isSetupGuideVisible);
  const [workspaceOpened, setWorkspaceOpened] = useState(false);
  const mountWorkspace = workspaceOpened || (settingsHydrated && !showSetupGuide);

  useEffect(() => {
    if (settingsHydrated && !showSetupGuide) setWorkspaceOpened(true);
  }, [settingsHydrated, showSetupGuide]);
  const privacy = useSettings((state) => state.privacy);
  const singleTabModeSetting = useSettings((state) => state.singleTabMode);
  const hydrated = usePages((s) => s.hydrated);
  const activePageId = usePages((s) => s.activePageId);

  // 绑定全局快捷键
  useAppHotkeys();

  // Electron 桌面端：设置水合后注册主窗/速记小窗全局热键（Electron 构建内部 no-op）
  useDesktopHotkeys();

  // 全局兜底：禁止未被 Radix / A1 处理的原生浏览器右键菜单
  useNativeContextMenuGuard();

  // 订阅插件/本地关联事件
  const { restoreLastNoteIfNeeded, clearActivePageForBlankEntry } = usePluginEvents();

  // 首帧稳定后解除启动过渡禁用（bootstrap 在渲染前已打上标记；
  // 若未标记则该调用是无副作用的清理）。
  useEffect(() => {
    releaseStartupSettlingAfterPaint();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__gooseNoteAutoOpenLastNote = privacy.autoOpenLastNote;
  }, [privacy.autoOpenLastNote]);

  // 同步 tab 状态：清理已删除页面的 tab（保留尚未加载的本地文件夹标签）
  useEffect(() => {
    if (!hydrated) return;
    const tabsStore = useTabs.getState();

    // reconcileTabs 会保留属于「尚未加载的本地文件夹笔记本」的标签，
    // 待该文件夹加载后再由 loadLocalFolderPages 末尾的 reconcile 清理。
    tabsStore.reconcileTabs();

    // 仅在没有标签时，用当前页面初始化第一个标签（E2E 测试自行控制标签状态）
    const { activePageId, pages } = usePages.getState();
    if (
      activePageId &&
      useTabs.getState().openTabs.length === 0 &&
      pages[activePageId] &&
      !(typeof window !== "undefined" && (window as Window & { __GOOSE_E2E__?: boolean }).__GOOSE_E2E__)
    ) {
      useTabs.getState().openTab(activePageId);
    }
  }, [hydrated, activePageId]);

  // 根据隐私设置决定是否自动打开上次笔记
  useEffect(() => {
    if (!hydrated) return;

    const { privacy } = useSettings.getState();
    if (shouldPreserveStartupSelection()) return;

    if (!privacy.autoOpenLastNote) {
      clearActivePageForBlankEntry();
      return;
    }

    restoreLastNoteIfNeeded();
  }, [hydrated, restoreLastNoteIfNeeded, clearActivePageForBlankEntry]);

  useEffect(() => {
    if (!hydrated || !privacy.autoCloseInactiveTabs) return;

    const closeExpiredTabs = () => {
      useTabs.getState().closeExpiredTabs();
    };

    closeExpiredTabs();
    const timer = window.setInterval(closeExpiredTabs, 15 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [
    hydrated,
    privacy.autoCloseInactiveTabs,
    privacy.autoCloseInactiveTabsHours,
  ]);

  useEffect(() => {
    if (!hydrated || !effectiveSingleTabMode(singleTabModeSetting)) return;
    useTabs.getState().collapseToActiveTab();
  }, [hydrated, singleTabModeSetting]);

  return (
    <>
      <AppearanceSync />
      <PencilIconDefinitions />
      {mountWorkspace && (
        <div hidden={showSetupGuide} inert={showSetupGuide} className="h-full">
          {/* Keep an existing editor mounted when reopening the guide. */}
          <WorkspacePage />
        </div>
      )}
      <SetupGuide />
      <Toaster />
    </>
  );
}

export default App;
