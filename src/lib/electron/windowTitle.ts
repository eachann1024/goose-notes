/**
 * Electron 桌面端窗口标题同步（纯函数部分，保持轻量可被 unit 测试直接 import）。
 *
 * 顶栏标题 = 当前文件名（getPageTitle）；系统窗口 title 与 document.title 同步。
 * 欢迎页用「开始」，无页面时回落「Goose Note」。
 * store 订阅与防抖在 @/hooks/useDesktopWindowTitle。
 */
import type { Page } from "@/types";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { getGooseDesktop } from "./runtime";

export const DEFAULT_WINDOW_TITLE = "Goose Note";
export const WELCOME_WINDOW_TITLE = "开始";
export const TITLE_SYNC_DEBOUNCE_MS = 300;

export function resolveWindowTitle(
  page: Page | null | undefined,
  options?: { isWelcomeTab?: boolean },
): string {
  if (options?.isWelcomeTab) return WELCOME_WINDOW_TITLE;
  if (!page) return DEFAULT_WINDOW_TITLE;
  const title = getPageTitle(page).trim();
  return title || DEFAULT_WINDOW_TITLE;
}

/** 同步 document.title 与系统窗口标题；非 Electron 构建/调用失败时静默。 */
export async function syncDesktopWindowTitle(title: string): Promise<void> {
  if (__HOST_TARGET__ !== "electron") return;
  try {
    document.title = title;
    const api = getGooseDesktop();
    await api?.setTitle(title);
  } catch (error) {
    console.warn("[electron] 同步窗口标题失败", error);
  }
}
