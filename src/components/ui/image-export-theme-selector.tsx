import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CARD_THEMES,
  normalizeCardThemeId,
  resolveCardTheme,
  shouldShowImageExportLivePreview,
  shouldShowImageExportOptionsCorner,
  type CardThemeId,
  type CardTheme,
  type WatermarkConfig,
  normalizeWatermarkConfig,
} from "@/lib/imageExport";
import {
  buildImageExportPreviewHtml,
  getImageExportPreviewSource,
} from "@/lib/imageExport/livePreview";
import { useSettings } from "@/stores/settings";
import { resolveTheme } from "@/hooks/useResolvedTheme";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { Page } from "@/types";
import { cn } from "@/lib/utils";

interface ImageExportThemeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (themeId: CardThemeId, watermarkConfig: WatermarkConfig) => void;
  mode: "page" | "selection";
  page?: Pick<Page, "content" | "fontFamily" | "localFilePath"> | null;
  blocks?: BlockNoteContent;
}

const PINNED_FIRST: Record<"light" | "dark", string> = {
  light: "github-light",
  dark: "github-dark",
};

const NOTEBOOK_CARD_BLOCKS: BlockNoteContent = [
  {
    type: "heading",
    props: { level: 1 },
    content: [{ type: "text", text: "2026-05-15-手动更新", styles: {} }],
  },
  {
    type: "paragraph",
    content: [
      { type: "text", text: "手动更新流程", styles: { bold: true } },
      { type: "text", text: "（raven / ERP 标准版）", styles: {} },
    ],
  },
  {
    type: "codeBlock",
    props: { language: "bash" },
    content: "cd /opt/jenkins && ./update.sh",
  },
];

function orderThemesForGroup(themes: CardTheme[]): CardTheme[] {
  const pinId = themes.length > 0 ? PINNED_FIRST[themes[0].mode] : undefined;
  if (!pinId) return themes;
  const pinned = themes.find((t) => t.id === pinId);
  if (!pinned) return themes;
  return [pinned, ...themes.filter((t) => t.id !== pinId)];
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return reduced;
}

export function ImageExportThemeSelector({
  open,
  onOpenChange,
  onConfirm,
  mode,
  page,
  blocks,
}: ImageExportThemeSelectorProps) {
  const selectedId = normalizeCardThemeId(
    useSettings((s) => s.imageExportThemeId),
  );
  const setSelectedId = useSettings((s) => s.setImageExportThemeId);
  const storedWatermark = useSettings((s) => s.imageExportWatermark);
  const setWatermarkConfig = useSettings((s) => s.setImageExportWatermark);
  const customFonts = useSettings((s) => s.customFonts);
  const editorFontSize = useSettings((s) => s.editorFontSize);
  const settingsTheme = useSettings((s) => s.theme);
  const resolvedTheme = resolveTheme(settingsTheme);
  const wm = normalizeWatermarkConfig(storedWatermark);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const reducedMotion = usePrefersReducedMotion();
  const showLivePreview = shouldShowImageExportLivePreview(viewportWidth);
  const showOptionsCorner = shouldShowImageExportOptionsCorner(viewportWidth);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleConfirm = () => {
    onConfirm(selectedId, wm);
    onOpenChange(false);
  };

  const modeText = mode === "page" ? "整页" : "选中内容";
  const notebookContext = useMemo(
    () => ({
      fontFamily: page?.fontFamily ?? "default",
      customFonts,
      editorFontSize,
      resolvedTheme,
    }),
    [page?.fontFamily, customFonts, editorFontSize, resolvedTheme],
  );

  const displayThemes = useMemo(
    () =>
      CARD_THEMES.map((theme) =>
        theme.id === "notebook"
          ? resolveCardTheme("notebook", notebookContext)
          : theme,
      ),
    [notebookContext],
  );
  const notebookTheme = displayThemes.find((theme) => theme.id === "notebook");
  const groupedThemes = useMemo(
    () =>
      (["light", "dark"] as const).map((group) => ({
        group,
        themes: orderThemesForGroup(
          displayThemes.filter(
            (theme) => theme.mode === group && theme.id !== "notebook",
          ),
        ),
      })),
    [displayThemes],
  );

  const toggleConfig = (key: keyof WatermarkConfig) => {
    setWatermarkConfig({ ...wm, [key]: !wm[key] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden gap-0 flex flex-col max-h-[88vh]",
          showLivePreview
            ? "max-w-[min(1180px,calc(100vw-24px))] w-[min(1180px,calc(100vw-24px))]"
            : "max-w-[760px]",
        )}
      >
        <div
          className={cn(
            "px-6 pt-6 pb-3 shrink-0",
            showOptionsCorner && "flex items-center justify-between gap-4 pr-12",
          )}
        >
          <DialogHeader className={cn("space-y-1", showOptionsCorner && "min-w-0 flex-1")}>
            <DialogTitle className="text-sm font-semibold tracking-tight">
              选择卡片主题
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              为「{modeText}」选择一种视觉风格，共 {CARD_THEMES.length} 种主题可选
            </DialogDescription>
          </DialogHeader>
          {showOptionsCorner && (
            <GenerationOptionsPanel
              wm={wm}
              onToggle={toggleConfig}
              variant="toolbar"
            />
          )}
        </div>

        <div
          className={cn(
            "flex-1 min-h-0 px-6 pb-3",
            showLivePreview ? "grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-5" : "",
          )}
        >
          {open && showLivePreview && (
            <LivePreviewPane
              open={open}
              mode={mode}
              page={page}
              blocks={blocks}
              theme={resolveCardTheme(selectedId, notebookContext)}
              watermarkConfig={wm}
            />
          )}

          <div className="min-h-0 overflow-y-auto p-1 [scrollbar-width:thin]">
            {notebookTheme && (
              <section className="mb-5">
                <header className="flex items-center gap-2 mb-2.5 px-0.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground">
                    当前
                  </span>
                  <span className="ml-1 flex-1 h-px bg-border/70" />
                </header>
                <div className={showLivePreview ? "grid grid-cols-2 gap-4" : "grid grid-cols-3 gap-4"}>
                  <ThemePreviewCard
                    theme={notebookTheme}
                    selected={selectedId === "notebook"}
                    reducedMotion={reducedMotion}
                    onClick={() => setSelectedId("notebook")}
                    sampleBlocks={NOTEBOOK_CARD_BLOCKS}
                    watermarkConfig={wm}
                  />
                </div>
              </section>
            )}

            {groupedThemes.map(({ group, themes }) => {
              if (themes.length === 0) return null;
              return (
                <section key={group} className="mb-5 last:mb-1">
                  <header className="flex items-center gap-2 mb-2.5 px-0.5">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${group === "light" ? "bg-foreground/40" : "bg-foreground"}`}
                    />
                    <span className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground">
                      {group === "light" ? "浅色" : "深色"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {themes.length}
                    </span>
                    <span className="ml-1 flex-1 h-px bg-border/70" />
                  </header>
                  <div
                    className={
                      showLivePreview
                        ? "grid grid-cols-2 gap-4"
                        : "grid grid-cols-3 gap-4"
                    }
                  >
                    {themes.map((theme) => (
                      <ThemePreviewCard
                        key={theme.id}
                        theme={theme}
                        selected={selectedId === theme.id}
                        reducedMotion={reducedMotion}
                        onClick={() =>
                          setSelectedId(normalizeCardThemeId(theme.id))
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {!showOptionsCorner && (
          <div className="px-6 py-3 border-t bg-muted/20 shrink-0 max-h-[40vh] overflow-y-auto [scrollbar-width:thin]">
            <button
              type="button"
              onClick={() => setConfigOpen((v) => !v)}
              className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-[var(--goose-interactive-selected-fg)] transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <GooseIcons.Settings className="h-3 w-3" />
                生成选项
              </span>
              <GooseIcons.ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${configOpen ? "rotate-180" : ""}`}
              />
            </button>
            {configOpen && (
              <GenerationOptionsPanel wm={wm} onToggle={toggleConfig} variant="drawer" />
            )}
          </div>
        )}

        <DialogFooter className="p-4 pt-3 shrink-0 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            取消
          </Button>
          <Button size="sm" onClick={handleConfirm} className="h-8 text-xs">
            <GooseIcons.Image className="mr-1.5 h-3.5 w-3.5" />
            生成图片
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerationOptionsPanel({
  wm,
  onToggle,
  variant,
}: {
  wm: WatermarkConfig;
  onToggle: (key: keyof WatermarkConfig) => void;
  variant: "toolbar" | "drawer";
}) {
  const rows: Array<{
    key: keyof WatermarkConfig;
    label: string;
    shortLabel?: string;
    disabled?: boolean;
    indent?: boolean;
  }> = [
    { key: "showTitle", label: "显示标题", shortLabel: "标题" },
    { key: "showWatermark", label: "显示底部信息栏", shortLabel: "底部栏" },
    { key: "showBrand", label: "显示品牌名", shortLabel: "品牌", disabled: !wm.showWatermark, indent: true },
    { key: "showDate", label: "显示日期", shortLabel: "日期", disabled: !wm.showWatermark, indent: true },
    {
      key: "showTime",
      label: "追加时分秒",
      shortLabel: "时分秒",
      disabled: !wm.showWatermark || !wm.showDate,
      indent: true,
    },
  ];

  if (variant === "toolbar") {
    return (
      <section
        aria-label="生成选项"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 shrink-0 rounded-lg border bg-muted/20 px-3 py-2"
      >
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <GooseIcons.Settings className="h-3 w-3" />
          生成选项
        </span>
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-center gap-2",
              row.disabled && "opacity-50",
            )}
          >
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {row.shortLabel ?? row.label}
            </span>
            <Switch
              checked={wm[row.key]}
              onCheckedChange={() => onToggle(row.key)}
              disabled={row.disabled}
              className="scale-75 origin-center"
            />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section aria-label="生成选项" className="mt-3">
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "flex items-center justify-between",
              row.indent && "pl-3",
            )}
          >
            <span
              className={cn(
                "text-xs",
                row.indent ? "text-muted-foreground" : "text-foreground/80",
              )}
            >
              {row.label}
            </span>
            <Switch
              checked={wm[row.key]}
              onCheckedChange={() => onToggle(row.key)}
              disabled={row.disabled}
              className="scale-75 origin-right"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function LivePreviewPane({
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
        <span className="text-[10px] text-muted-foreground/80 truncate">
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

function ThemePreviewCard({
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
          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-[0_2px_6px_rgba(15,23,42,0.18)]">
            <GooseIcons.Check
              className="h-3 w-3 text-primary-foreground"
              strokeWidth={3}
            />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2 px-0.5">
        <span
          className={`text-[12px] font-medium leading-tight ${selected ? "text-foreground" : "text-foreground/85"}`}
        >
          {theme.name}
        </span>
        <span className="text-[10px] text-muted-foreground/80 leading-tight tracking-wide">
          {theme.nameEn}
        </span>
      </div>
    </button>
  );
}
