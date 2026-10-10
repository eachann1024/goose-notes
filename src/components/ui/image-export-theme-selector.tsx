import * as GooseIcons from "@/components/ui/icons";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CARD_THEMES, normalizeCardThemeId, resolveCardTheme, shouldShowImageExportLivePreview, shouldShowImageExportOptionsCorner, type WatermarkConfig, normalizeWatermarkConfig } from "@/lib/imageExport";
import { useSettings } from "@/stores/settings";
import { resolveTheme } from "@/hooks/useResolvedTheme";
import { cn } from "@/lib/utils";

import { NOTEBOOK_CARD_BLOCKS, orderThemesForGroup, usePrefersReducedMotion, type ImageExportThemeSelectorProps } from "./image-export/theme-model";
import { GenerationOptionsPanel } from "./image-export/GenerationOptionsPanel";
import { LivePreviewPane } from "./image-export/LivePreviewPane";
import { ThemePreviewCard } from "./image-export/ThemePreviewCard";

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
                  <span className="inline-block h-1.5 w-1.5 rounded-marker bg-primary" />
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
                      className={`inline-block h-1.5 w-1.5 rounded-marker ${group === "light" ? "bg-foreground/40" : "bg-foreground"}`}
                    />
                    <span className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground">
                      {group === "light" ? "浅色" : "深色"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
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
