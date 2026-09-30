import { BrowserWindow, systemPreferences } from "electron";

/**
 * 桌面窗系统材质：
 * - Windows 11：Mica（backgroundMaterial）
 * - macOS：under-window vibrancy
 * - Linux：无对等 API，保持实心
 *
 * 需配合渲染进程 html.is-electron 下半透明壳层，否则材质被实心底挡住。
 */
export function applySystemMaterial(win: BrowserWindow): void {
  if (win.isDestroyed()) return;

  if (process.platform === "win32") {
    try {
      // Electron 44+；Win10 会静默忽略或回退
      win.setBackgroundMaterial("mica");
    } catch (error) {
      console.warn("[system-material] setBackgroundMaterial failed", error);
    }
    return;
  }

  if (process.platform === "darwin") {
    try {
      // hidden titlebar 下 under-window 能透出桌面壁纸
      win.setVibrancy("under-window");
      if (typeof win.setVisualEffectState === "function") {
        win.setVisualEffectState("active");
      }
      // 降低不透明底，让 vibrancy 可见
      win.setBackgroundColor("#00000000");
    } catch (error) {
      console.warn("[system-material] setVibrancy failed", error);
    }
    // reduce transparency 辅助功能开启时系统会回退为实心，属预期
    void systemPreferences.getAnimationSettings?.();
  }
}

export function workspaceWindowMaterialOptions(): {
  backgroundMaterial?: "mica";
  vibrancy?: "under-window";
  visualEffectState?: "active";
  backgroundColor: string;
} {
  if (process.platform === "win32") {
    return {
      backgroundMaterial: "mica",
      // 与 material 并存时 Electron 会忽略此色，仍给个安全默认
      backgroundColor: "#00000000",
    };
  }
  if (process.platform === "darwin") {
    return {
      vibrancy: "under-window",
      visualEffectState: "active",
      backgroundColor: "#00000000",
    };
  }
  return { backgroundColor: "#ffffff" };
}
