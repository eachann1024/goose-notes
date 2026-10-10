import { createPortal } from "react-dom";
import { Minus, Plus, RotateCcw, X } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/icon-button";
import { MathView } from "@/components/editor/blocks/math/MathView";
import { clampPreviewZoomPercent, normalizeSvgIntrinsicSize, PREVIEW_ZOOM_STEP_PERCENT, wrapHtmlDocument, type PreviewContent } from "@/lib/preview/previewAction";

import { useFullscreenPreview } from "./useFullscreenPreview";

const PREVIEW_ICON_CLASS =
  "cursor-pointer hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]";

export function FullscreenPreview({
  open,
  content,
  title = "预览",
  onClose,
}: {
  open: boolean;
  content: PreviewContent | null;
  title?: string;
  onClose: () => void;
}) {
  const { imageSrc, zoomPercent, setZoomPercent, vectorFit, bodyRef, vectorRef, isVector, bodyClass } = useFullscreenPreview(open, content, onClose);

  if (!open || !content || typeof document === "undefined") return null;

  const atMinZoom = zoomPercent <= 25;
  const atMaxZoom = zoomPercent >= 400;
  const vectorScale = (vectorFit?.scale ?? 1) * (zoomPercent / 100);

  return createPortal(
    <div
      className="goose-code-preview-lightbox"
      contentEditable={false}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="goose-code-preview-lightbox-panel">
        <div className="goose-code-preview-lightbox-header">
          <div className="goose-code-preview-lightbox-title">{title}</div>
          <div className="goose-code-preview-lightbox-zoom">
            <IconButton
              type="button"
              tone="muted"
              size="sm"
              aria-label="缩小"
              disabled={atMinZoom}
              className={PREVIEW_ICON_CLASS}
              onClick={() =>
                setZoomPercent((current) =>
                  clampPreviewZoomPercent(current - PREVIEW_ZOOM_STEP_PERCENT),
                )
              }
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
            <span className="goose-code-preview-lightbox-zoom-label">
              {zoomPercent}%
            </span>
            <IconButton
              type="button"
              tone="muted"
              size="sm"
              aria-label="放大"
              disabled={atMaxZoom}
              className={PREVIEW_ICON_CLASS}
              onClick={() =>
                setZoomPercent((current) =>
                  clampPreviewZoomPercent(current + PREVIEW_ZOOM_STEP_PERCENT),
                )
              }
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
            <IconButton
              type="button"
              tone="muted"
              size="sm"
              aria-label="重置为 100%"
              disabled={zoomPercent === 100}
              className={PREVIEW_ICON_CLASS}
              onClick={() => setZoomPercent(100)}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
          </div>
          <IconButton
            type="button"
            tone="muted"
            size="sm"
            aria-label="关闭预览"
            className={`goose-code-preview-lightbox-close ${PREVIEW_ICON_CLASS}`}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div
          ref={bodyRef}
          className={`goose-code-preview-lightbox-body ${bodyClass}`}
        >
          {isVector ? (
            <div
              className="goose-preview-vector-sizer"
              style={
                vectorFit
                  ? {
                      width: `${vectorFit.width * vectorScale}px`,
                      height: `${vectorFit.height * vectorScale}px`,
                    }
                  : undefined
              }
            >
              <div
                ref={vectorRef}
                className="goose-preview-vector"
                style={
                  vectorFit ? { transform: `scale(${vectorScale})` } : undefined
                }
              >
                {content.kind === "svg" ? (
                  <div
                    className="goose-preview-svg notebook-ai-artifact-svg"
                    style={
                      content.background
                        ? { background: content.background }
                        : undefined
                    }
                    // SVG comes from local mermaid/export sanitizers, not raw model HTML.
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                      __html: normalizeSvgIntrinsicSize(content.markup),
                    }}
                  />
                ) : null}
                {content.kind === "math" ? (
                  <MathView value={content.source} displayMode={true} />
                ) : null}
              </div>
            </div>
          ) : (
            <div
              className="goose-preview-zoom-surface"
              style={{ zoom: zoomPercent / 100 }}
            >
              {content.kind === "image" ? (
                imageSrc ? <img src={imageSrc} alt={title} /> : null
              ) : null}
              {content.kind === "html" ? (
                <iframe
                  className="goose-preview-html"
                  title={title}
                  sandbox="allow-scripts"
                  srcDoc={wrapHtmlDocument(content.html)}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function FullscreenImagePreview({
  open,
  src,
  title,
  onClose,
}: {
  open: boolean;
  src: string | null;
  title?: string;
  onClose: () => void;
}) {
  return (
    <FullscreenPreview
      open={open}
      content={src ? { kind: "image", data: src } : null}
      title={title}
      onClose={onClose}
    />
  );
}
