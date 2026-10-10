import { useEffect, useMemo, useRef, useState } from "react";
import { type CardTheme, type WatermarkConfig } from "@/lib/imageExport";
import { buildImageExportPreviewHtml, getImageExportPreviewSource } from "@/lib/imageExport/livePreview";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";

import type { ImageExportThemeSelectorProps } from "./theme-model";

export function LivePreviewPane({
  open,
  mode,
  page,
  blocks,
  theme,
  watermarkConfig,
}: {
  open: boolean;
  mode: "page" | "selection";
  page?: ImageExportThemeSelectorProps["page"];
  blocks?: BlockNoteContent;
  theme: CardTheme;
  watermarkConfig: WatermarkConfig;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.42);
  const [frameHeight, setFrameHeight] = useState(900);

  const source = useMemo(
    () => getImageExportPreviewSource({ mode, page, blocks }),
    [mode, page, blocks],
  );
  const html = useMemo(
    () =>
      buildImageExportPreviewHtml({
        title: source.title,
        blocks: source.blocks,
        theme,
        mode,
        watermarkConfig,
      }),
    [source, theme, mode, watermarkConfig],
  );

  useEffect(() => {
    if (!open) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateScale = () => {
      const next =
        viewport.clientWidth > 0 ? Math.min(1, viewport.clientWidth / 680) : 0.42;
      setScale(Number.isFinite(next) && next > 0 ? next : 0.42);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [open, html]);

  useEffect(() => {
    if (!open) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const measure = () => {
      const card = iframe.contentDocument?.querySelector(
        ".gooseshot-container",
      ) as HTMLElement | null;
      if (!card) return;
      const next = Math.ceil(Math.max(card.scrollHeight, card.offsetHeight));
      if (next > 0) setFrameHeight(next);
    };
    iframe.addEventListener("load", measure);
    measure();
    const retry = window.setTimeout(measure, 80);
    return () => {
      iframe.removeEventListener("load", measure);
      window.clearTimeout(retry);
    };
  }, [open, html]);

  return (
    <aside
      aria-label="图片导出预览"
      className="min-h-0 flex flex-col overflow-hidden rounded-[12px] border bg-muted/20"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b shrink-0">
        <span className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground">
          图片导出预览
        </span>
        <span className="text-[10px] text-muted-foreground truncate">
          {theme.name}
        </span>
      </div>
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto p-3">
        <div
          style={{
            width: 680 * scale,
            height: frameHeight * scale,
            position: "relative",
          }}
        >
          <iframe
            ref={iframeRef}
            title="图片导出预览"
            srcDoc={html}
            sandbox="allow-same-origin"
            style={{
              width: 680,
              height: frameHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: 0,
              pointerEvents: "none",
              display: "block",
              background: "transparent",
              colorScheme: theme.mode,
            }}
          />
        </div>
      </div>
    </aside>
  );
}
