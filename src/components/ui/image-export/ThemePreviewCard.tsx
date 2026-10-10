import * as GooseIcons from "@/components/ui/icons";
import { useMemo } from "react";
import { type CardTheme, type WatermarkConfig } from "@/lib/imageExport";
import { buildImageExportPreviewHtml } from "@/lib/imageExport/livePreview";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import { cn } from "@/lib/utils";

export function ThemePreviewCard({
  theme,
  selected,
  onClick,
  reducedMotion,
  sampleBlocks,
  watermarkConfig,
}: {
  theme: CardTheme;
  selected: boolean;
  onClick: () => void;
  reducedMotion: boolean;
  sampleBlocks?: BlockNoteContent;
  watermarkConfig?: WatermarkConfig;
}) {
  const previewTitle = "设计即生活";
  const previewBody = "好的排版让阅读成为一种享受，每个细节都藏着设计师的用心。";
  const notebookPreview = theme.id === "notebook";
  const sampleHtml = useMemo(() => {
    if (!notebookPreview || !sampleBlocks) return null;
    return buildImageExportPreviewHtml({
      title: "2026-05-15-手动更新",
      blocks: sampleBlocks,
      theme,
      mode: "page",
      watermarkConfig,
    });
  }, [notebookPreview, sampleBlocks, theme, watermarkConfig]);

  const cardStyle: React.CSSProperties = {
    background: theme.background,
    borderRadius: 10,
    padding: 14,
    position: "relative",
    transition: reducedMotion
      ? "box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)",
    boxShadow: selected
      ? "0 0 0 2px hsl(var(--primary)), 0 10px 22px rgba(15,23,42,0.12)"
      : "0 1px 2px rgba(15,23,42,0.04), inset 0 0 0 1px rgba(15,23,42,0.06)",
    minHeight: 152,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  };

  const innerCardStyle: React.CSSProperties = {
    background: theme.cardBg.includes("rgba")
      ? theme.cardBg
      : theme.cardBg === "transparent"
        ? "transparent"
        : theme.cardBg,
    borderRadius: Math.max(theme.cardRadius * 0.35, 4),
    padding: `${Math.max(theme.cardPaddingY * 0.28, 10)}px ${Math.max(theme.cardPaddingX * 0.28, 12)}px`,
    border: theme.cardBorder === "none" ? "none" : "1px solid rgba(0,0,0,0.06)",
    boxShadow: theme.cardShadow.includes("none")
      ? "none"
      : "0 1px 4px rgba(0,0,0,0.04)",
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: theme.titleFont.split(",")[0].replace(/['"]/g, ""),
    fontSize: Math.max(theme.titleFontSize * 0.35, 11),
    fontWeight: theme.titleFontWeight,
    lineHeight: 1.3,
    letterSpacing: theme.titleLetterSpacing,
    color: theme.textColor,
    textAlign: theme.titleAlign,
    marginBottom: 4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const bodyStyle: React.CSSProperties = {
    fontFamily: theme.bodyFont.split(",")[0].replace(/['"]/g, ""),
    fontSize: Math.max(theme.bodyFontSize * 0.35, 9),
    lineHeight: 1.5,
    color: theme.secondaryText,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    letterSpacing: theme.bodyLetterSpacing,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2.5 text-left outline-none "
    >
      <div
        style={cardStyle}
        className={cn(
          "cursor-pointer",
          !reducedMotion && "group-hover:-translate-y-0.5",
        )}
      >
        {sampleHtml ? (
          <div className="relative h-[124px] overflow-hidden rounded-[6px]">
            <iframe
              title={theme.name}
              srcDoc={sampleHtml}
              sandbox="allow-same-origin"
              className="pointer-events-none origin-top-left border-0"
              style={{ width: 680, height: 560, transform: "scale(0.22)" }}
            />
          </div>
        ) : (
          <div style={innerCardStyle}>
            <div style={titleStyle}>{previewTitle}</div>
            <div style={bodyStyle}>{previewBody}</div>
          </div>
        )}
        {selected && (
          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-control bg-primary shadow-[0_2px_6px_rgba(15,23,42,0.18)]">
            <GooseIcons.Check
              className="h-3 w-3 text-primary-foreground"
              strokeWidth={3}
            />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2 px-0.5">
        <span
          className={`text-[12px] font-medium leading-tight ${selected ? "text-foreground" : "text-foreground"}`}
        >
          {theme.name}
        </span>
        <span className="text-[10px] text-muted-foreground leading-tight tracking-wide">
          {theme.nameEn}
        </span>
      </div>
    </button>
  );
}
