import type { WebContents } from "electron";

/**
 * 锁死 Chromium / Electron 的页面级缩放。
 * Cmd/Ctrl +/- 只应由渲染进程改编辑器字号，不能把侧栏、顶栏一起缩小。
 */
export function lockWebContentsPageZoom(contents: WebContents): void {
  if (contents.isDestroyed() || contents.getType() === "devtools") return;

  const pin = () => {
    if (contents.isDestroyed()) return;
    contents.setZoomFactor(1);
    contents.setZoomLevel(0);
    void contents.setVisualZoomLevelLimits(1, 1);
  };

  pin();
  contents.on("did-finish-load", pin);
  contents.on("zoom-changed", pin);
}
