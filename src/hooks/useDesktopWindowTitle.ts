/**
 * 订阅 activePage + getPageTitle，防抖 300ms 同步 Electron 系统窗口标题。
 * 仅 Electron 构建有效（uTools 构建 effect 内部直接 return）。
 */
import { useEffect } from "react";
import { usePages } from "@/stores/usePages";
import { useTabs } from "@/stores/useTabs";
import { getPageTitle } from "@/components/editor/utils/page-title";
import {
  DEFAULT_WINDOW_TITLE,
  TITLE_SYNC_DEBOUNCE_MS,
  WELCOME_WINDOW_TITLE,
  syncDesktopWindowTitle,
} from "@/lib/electron/windowTitle";

export function useDesktopWindowTitleSync(): void {
  const activePageId = usePages((s) => s.activePageId);
  // 选择器只取标题字符串：内容保存产生的新 page 对象不会触发重渲染。
  const pageTitle = usePages((s) => {
    const page = activePageId ? s.pages[activePageId] : undefined;
    return page ? getPageTitle(page) : null;
  });
  const isWelcomeTab = useTabs(
    (s) =>
      s.openTabs.find((tab) => tab.id === s.activeTabId)?.type === "welcome",
  );

  useEffect(() => {
    if (__HOST_TARGET__ !== "electron") return;
    const title =
      pageTitle ?? (isWelcomeTab ? WELCOME_WINDOW_TITLE : DEFAULT_WINDOW_TITLE);
    const timer = window.setTimeout(() => {
      void syncDesktopWindowTitle(title);
    }, TITLE_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pageTitle, isWelcomeTab]);
}
