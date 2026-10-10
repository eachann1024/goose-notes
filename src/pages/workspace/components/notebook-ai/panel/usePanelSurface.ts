import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePanelWidth } from "../usePanelWidth";
import type { ComposerHandle } from "../Composer";
import { readEditorScale } from "../artifactPanZoomScale";
import { EDITOR_UI_SCALE_CHANGE_EVENT } from "@/lib/appearance";
import {
  clearAiPanelSurface,
  dismissAiFloatingLayers,
  setAiPanelSurface,
} from "../aiPanelSurface";
export function usePanelSurface(
  isFullscreen: boolean,
  isElectronChrome: boolean,
) {
  const { width, isResizing, onDragHandleMouseDown, onDragHandlePointerDown } =
    usePanelWidth();
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const composerDockRef = useRef<HTMLDivElement | null>(null);
  // 展示宽度：随父级 flex 行可用空间收缩，避免 minWidth=stored 把面板裁出视口
  const [effectiveWidth, setEffectiveWidth] = useState(width);
  const composerRef = useRef<ComposerHandle | null>(null);
  const [bodyReady, setBodyReady] = useState(false);

  // 面板挂载=AI 任务面；卸载/切走时清 body 标记并收起残留浮层
  useEffect(() => {
    setAiPanelSurface({ active: true, fullscreen: isFullscreen });
    return () => {
      const root = panelRootRef.current;
      clearAiPanelSurface();
      dismissAiFloatingLayers(root);
    };
  }, [isFullscreen]);

  useEffect(() => {
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        setBodyReady(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, []);

  // 侧栏：观察父级（.workspace-editor-surface）宽度，计算不挤爆编辑区的 effectiveWidth
  useEffect(() => {
    if (isFullscreen) return;
    const root = panelRootRef.current;
    const parent = root?.parentElement;
    if (!parent) return;

    const EDITOR_MIN = 200;
    const recompute = () => {
      const parentW = parent.clientWidth;
      const room = parentW - EDITOR_MIN;
      // room 足够时：不超过 stored，且留给编辑区至少 EDITOR_MIN
      // 极窄时使用父级可用宽度，避免右侧裁切。
      const availableRoom = room > 0 ? room : Math.max(0, parentW);
      const next = Math.min(width, availableRoom);
      setEffectiveWidth(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [isFullscreen, width]);

  // 顶栏 AI 列与正文使用同一展示宽度，拖宽和窗口缩放时不各算一遍。
  useLayoutEffect(() => {
    if (isFullscreen || !isElectronChrome) return;
    const shell =
      panelRootRef.current?.closest<HTMLElement>(".workspace-shell");
    shell?.style.setProperty("--workspace-ai-width", `${effectiveWidth}px`);
    return () => {
      shell?.style.removeProperty("--workspace-ai-width");
    };
  }, [effectiveWidth, isFullscreen, isElectronChrome]);

  // 输入条浮动叠在消息上：把 dock 高度换算进 zoom 坐标系，给消息区垫底。
  useLayoutEffect(() => {
    const dock = composerDockRef.current;
    const panel = panelRootRef.current;
    if (!dock || !panel) return;

    const sync = () => {
      const scale = readEditorScale(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--editor-scale",
        ),
      );
      panel.style.setProperty(
        "--ai-composer-float-pad",
        `${dock.offsetHeight / scale}px`,
      );
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(dock);
    window.addEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, sync);
    return () => {
      ro.disconnect();
      window.removeEventListener(EDITOR_UI_SCALE_CHANGE_EVENT, sync);
      panel.style.removeProperty("--ai-composer-float-pad");
    };
  }, []);
  return {
    width,
    isResizing,
    onDragHandleMouseDown,
    onDragHandlePointerDown,
    panelRootRef,
    composerDockRef,
    effectiveWidth,
    composerRef,
    bodyReady,
  };
}
export type PanelSurfaceState = ReturnType<typeof usePanelSurface>;
