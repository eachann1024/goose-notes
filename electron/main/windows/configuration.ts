import {
  BrowserWindow,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TITLE_BAR_HEIGHT_PX,
  trafficLightPositionForTitleBar,
} from "../../../src/lib/electron/titlebarLayout";
import { gooseWindowAdditionalArguments } from "../../../src/lib/electron/windowContext";
import {
  DEFAULT_WORKSPACE_HEIGHT,
  DEFAULT_WORKSPACE_WIDTH,
  type WindowBounds,
  type WindowTabSnapshot,
} from "../windowLayout";
import { windowState } from "./state";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAIN_WIDTH = DEFAULT_WORKSPACE_WIDTH;

export const MAIN_HEIGHT = DEFAULT_WORKSPACE_HEIGHT;

export const QUICKNOTE_WIDTH = 480;

export const QUICKNOTE_HEIGHT = 350;

/** DesktopTitleBar 为 Tailwind h-11 = 2.75rem，随界面字号（标准 14 / 放大 16）变化。 */
export const TITLE_BAR_HEIGHT = DEFAULT_TITLE_BAR_HEIGHT_PX;

export type CreateWorkspaceWindowOpts = {
  mode: "blank" | "currentTab";
  windowId?: string;
  tab?: WindowTabSnapshot;
  bounds?: WindowBounds;
  maximized?: boolean;
  fullScreen?: boolean;
  restoredTabs?: WindowTabSnapshot[];
  sourceWindow?: BrowserWindow | null;
};

export function preloadPath(): string {
  return path.join(__dirname, "../preload/index.cjs");
}

export function rendererDevUrl(): string | null {
  const url = process.env.ELECTRON_RENDERER_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export function rendererFile(name: "index.html" | "quicknote.html"): string {
  return path.join(__dirname, "../renderer", name);
}

/**
 * Linux/Windows 任务栏图标。打包后 main 位于 <pack>/main/，icon.png 由
 * prepare-electron-pack 复制在 pack 根；开发态 main 位于 dist-electron/main/，
 * 图标在源码 electron/icons/。macOS 走 app/dock 原生图标，不读这里。
 */
export function framelessWindowIcon(): string | undefined {
  if (process.platform === "darwin") return undefined;
  const packaged = path.join(__dirname, "../icon.png");
  const dev = path.join(__dirname, "../../electron/icons/icon.png");
  return existsSync(packaged) ? packaged : existsSync(dev) ? dev : undefined;
}

export function isDevRenderer(): boolean {
  return Boolean(rendererDevUrl());
}

export const sharedWebPrefs =
  (): BrowserWindowConstructorOptions["webPreferences"] => ({
    preload: preloadPath(),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: false,
    zoomFactor: 1,
    // 正式包启用 V8 代码缓存；开发热更新不要 code cache。
    ...(isDevRenderer() ? {} : { v8CacheOptions: "code" as const }),
  });

export function windowWebPrefs(
  windowId: string,
  kind: "workspace" | "quicknote",
): BrowserWindowConstructorOptions["webPreferences"] {
  return {
    ...sharedWebPrefs(),
    additionalArguments: gooseWindowAdditionalArguments(windowId, kind),
  };
}

export function trafficLightPosition(): { x: number; y: number } {
  return trafficLightPositionForTitleBar(windowState.lastTitleBarHeight);
}

export function applyTrafficLightPosition(win: BrowserWindow): void {
  if (process.platform !== "darwin" || win.isDestroyed()) return;
  win.setWindowButtonPosition(trafficLightPosition());
}

/** 渲染进程在界面字号变化后同步顶栏高度，红绿灯按新高度垂直居中。 */
export function setMainWindowTitleBarHeight(
  win: BrowserWindow,
  height: number,
): void {
  if (!Number.isFinite(height) || height < 24 || height > 96) return;
  windowState.lastTitleBarHeight = height;
  applyTrafficLightPosition(win);
}

export function setHiddenThrottle(win: BrowserWindow, hidden: boolean): void {
  if (win.isDestroyed()) return;
  // 隐藏窗节流；可见编辑器保持 Chromium 默认（前台不节流）。
  win.webContents.backgroundThrottling = hidden;
}

export function isExternalHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function denyWindowOpenHandler(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
}
