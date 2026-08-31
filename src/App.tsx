import { useEffect } from "react";
import { WorkspacePage } from "./pages/workspace/WorkspacePage";
import { Toaster } from "@/components/ui/sonner";
import { usePages } from "./stores/usePages";
import { useTabs } from "./stores/useTabs";
import { useSettings } from "@/stores/useSettings";
import { useAppHotkeys } from "./hooks/useAppHotkeys";
import { useDesktopHotkeys } from "./hooks/useDesktopHotkeys";
import { usePluginEvents } from "./hooks/usePluginEvents";
import { useNativeContextMenuGuard } from "./hooks/useNativeContextMenuGuard";
import { useUToolsMcpBridge } from "./hooks/useUToolsMcpBridge";
import {
  applyAppearanceScaleVariables,
  releaseStartupSettlingAfterPaint,
} from "@/lib/appearance";

function App() {
  const {
    uiFontSize,
    editorFontSize,
    customFonts,
    privacy,
    singleTabMode,
  } = useSettings();
  const hydrated = usePages((s) => s.hydrated);
  const onboardingCompleted = usePages((s) => s.onboardingCompleted);
  const activePageId = usePages((s) => s.activePageId);

  // 绑定全局快捷键
  useAppHotkeys();

  // Electron 桌面端：设置水合后注册主窗/速记小窗全局热键（uTools 构建内部 no-op）
  useDesktopHotkeys();

  // 全局兜底：禁止未被 Radix / A1 处理的原生浏览器右键菜单
  useNativeContextMenuGuard();

  // 订阅插件/本地关联事件
  const { restoreLastNoteIfNeeded, clearActivePageForBlankEntry } = usePluginEvents();

  // uTools 原生 MCP 写入桥：preload registerTool -> 渲染层 live store
  // Electron 桌面端无 uTools preload，桥内部也会因 window.utools 缺失而 no-op。
  useUToolsMcpBridge();

  // 首帧稳定后解除启动过渡禁用（bootstrap 在渲染前已打上标记；
  // 若未标记则该调用是无副作用的清理）。
  useEffect(() => {
    releaseStartupSettlingAfterPaint();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__gooseNoteAutoOpenLastNote = privacy.autoOpenLastNote;
  }, [privacy.autoOpenLastNote]);

  // 首次打开应用时创建新手引导页面（Electron 仅本地文件夹模式：无内置本，跳过）
  useEffect(() => {
    if (__HOST_TARGET__ === "electron") return;
    if (hydrated && !onboardingCompleted) {
      usePages.getState().createOnboardingPages();
    }
  }, [hydrated, onboardingCompleted]);

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
    if (!hydrated || !singleTabMode) return;
    useTabs.getState().collapseToActiveTab();
  }, [hydrated, singleTabMode]);

  useEffect(() => {
    applyAppearanceScaleVariables({ uiFontSize, editorFontSize });
  }, [uiFontSize, editorFontSize]);

  useEffect(() => {
    applyFontVariables(customFonts);
  }, [customFonts]);

  return (
    <>
      <WorkspacePage />
      <Toaster />
    </>
  );
}

export default App;
