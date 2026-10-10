import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeArtifactFitScale,
  getArtifactScaleRange,
  shouldSnapToFitOnResize,
} from "../artifactPanZoomScale";
import {
  clampPreviewZoomPercent,
  PREVIEW_ZOOM_STEP_PERCENT,
} from "@/lib/preview/previewAction";
import { roundTransform, measureArtifactContentSize } from "./artifactMeasure";
export function useArtifactTransform(contentKey?: string) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const fitScaleRef = useRef(1);
  const contentSizeRef = useRef({ width: 1, height: 1 });
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const isZoomedIn = scale > fitScale + 0.001;

  const applyTransform = useCallback(
    (next: { scale: number; x: number; y: number }) => {
      const { minScale, maxScale } = getArtifactScaleRange(fitScaleRef.current);
      const normalized = {
        scale: Math.min(maxScale, Math.max(minScale, next.scale)),
        x: roundTransform(next.x),
        y: roundTransform(next.y),
      };
      transformRef.current = normalized;
      setScale(normalized.scale);
      setOffset({ x: normalized.x, y: normalized.y });
    },
    [],
  );

  const centerAtScale = useCallback(
    (nextScale: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        applyTransform({ scale: nextScale, x: 0, y: 0 });
        return;
      }
      const { width: contentWidth, height: contentHeight } =
        contentSizeRef.current;
      const scaledW = contentWidth * nextScale;
      const scaledH = contentHeight * nextScale;

      const targetX =
        scaledW <= viewport.clientWidth
          ? (viewport.clientWidth - scaledW) / 2
          : 0;

      const targetY =
        scaledH <= viewport.clientHeight
          ? (viewport.clientHeight - scaledH) / 2
          : 0;

      applyTransform({
        scale: nextScale,
        x: targetX,
        y: targetY,
      });
    },
    [applyTransform],
  );

  const fitToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return false;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) return false;

    const measured = measureArtifactContentSize(content);
    if (measured.width < 8 || measured.height < 8) return false;

    contentSizeRef.current = measured;

    // 把内容盒钉成固有尺寸，避免 flex 子项把 SVG 压窄后 scrollWidth 失真
    content.style.width = `${measured.width}px`;
    content.style.height = `${measured.height}px`;

    // 优先按宽度适应视口，保障横向完整展示与居中；
    // 当高度巨大时设置下限阈值（0.55），防止长图/复杂架构图被过度微缩成不可读的细线条
    const safeFit = computeArtifactFitScale({
      viewportWidth,
      viewportHeight,
      contentWidth: measured.width,
      contentHeight: measured.height,
    });
    fitScaleRef.current = safeFit;
    setFitScale(safeFit);
    centerAtScale(safeFit);
    setReady(true);
    return true;
  }, [centerAtScale]);

  useEffect(() => {
    setReady(false);
    let frame = 0;
    let attempts = 0;
    let cancelled = false;

    const tryFit = () => {
      if (cancelled) return;
      attempts += 1;
      if (fitToViewport()) return;
      if (attempts < 30) {
        frame = window.requestAnimationFrame(tryFit);
        return;
      }
      // 最后一搏：用当前盒子尺寸，避免一直透明
      const content = contentRef.current;
      if (content) {
        contentSizeRef.current = {
          width: Math.max(content.scrollWidth, 1),
          height: Math.max(content.scrollHeight, 1),
        };
      }
      fitScaleRef.current = 1;
      setFitScale(1);
      applyTransform({ scale: 1, x: 0, y: 0 });
      setReady(true);
    };

    frame = window.requestAnimationFrame(tryFit);

    const viewport = viewportRef.current;
    const content = contentRef.current;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && viewport) {
      ro = new ResizeObserver(() => {
        const box = viewportRef.current;
        const node = contentRef.current;
        if (!box || !node) return;
        const measured = measureArtifactContentSize(node);
        const nextFit = computeArtifactFitScale({
          viewportWidth: box.clientWidth,
          viewportHeight: box.clientHeight,
          contentWidth: measured.width,
          contentHeight: measured.height,
        });
        const previousFit = fitScaleRef.current;
        if (
          shouldSnapToFitOnResize({
            currentScale: transformRef.current.scale,
            previousFit,
            nextFit,
          })
        ) {
          fitToViewport();
          return;
        }
        fitScaleRef.current = nextFit;
        setFitScale(nextFit);
      });
      ro.observe(viewport);
      if (content) ro.observe(content);
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [applyTransform, contentKey, fitToViewport]);

  const zoomAtCenter = useCallback(
    (nextScale: number) => {
      const viewport = viewportRef.current;
      const prev = transformRef.current;
      const fitScale = fitScaleRef.current;
      const { minScale, maxScale } = getArtifactScaleRange(fitScale);
      const clamped = Math.min(maxScale, Math.max(minScale, nextScale));
      if (Math.abs(clamped - prev.scale) < 0.0001) return;

      // 适配比例及以下重新居中，避免缩小后偏移残留
      if (clamped <= fitScale + 0.0001) {
        centerAtScale(clamped);
        return;
      }

      if (!viewport) {
        applyTransform({ scale: clamped, x: prev.x, y: prev.y });
        return;
      }

      const pivotX = viewport.clientWidth / 2;
      const pivotY = viewport.clientHeight / 2;
      const contentX = (pivotX - prev.x) / prev.scale;
      const contentY = (pivotY - prev.y) / prev.scale;

      applyTransform({
        scale: clamped,
        x: pivotX - contentX * clamped,
        y: pivotY - contentY * clamped,
      });
    },
    [applyTransform, centerAtScale],
  );

  const zoomByStep = useCallback(
    (direction: 1 | -1) => {
      const fit = fitScaleRef.current;
      const currentPercent = Math.round(
        (transformRef.current.scale / Math.max(fit, 0.0001)) * 100,
      );
      const nextPercent = clampPreviewZoomPercent(
        currentPercent + direction * PREVIEW_ZOOM_STEP_PERCENT,
      );
      zoomAtCenter(fit * (nextPercent / 100));
    },
    [zoomAtCenter],
  );

  return {
    viewportRef,
    contentRef,
    transformRef,
    fitScaleRef,
    contentSizeRef,
    scale,
    fitScale,
    offset,
    ready,
    isZoomedIn,
    applyTransform,
    fitToViewport,
    zoomByStep,
  };
}
export type ArtifactTransformState = ReturnType<typeof useArtifactTransform>;
