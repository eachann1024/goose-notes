import { useState } from "react";
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
  type CardThemeId,
  type CardTheme,
  type WatermarkConfig,
  DEFAULT_WATERMARK_CONFIG,
} from "@/lib/imageExport";

interface ImageExportThemeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (themeId: CardThemeId, watermarkConfig: WatermarkConfig) => void;
  mode: "page" | "selection";
}

export function ImageExportThemeSelector({
  open,
  onOpenChange,
  onConfirm,
  mode,
}: ImageExportThemeSelectorProps) {
  const [selectedId, setSelectedId] = useState<CardThemeId>("notion");
  const [configOpen, setConfigOpen] = useState(false);
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>(
    DEFAULT_WATERMARK_CONFIG,
  );

  const handleConfirm = () => {
    onConfirm(selectedId, watermarkConfig);
    onOpenChange(false);
  };

  const modeText = mode === "page" ? "整页" : "选中内容";

  const toggleConfig = (key: keyof WatermarkConfig) => {
    setWatermarkConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] p-0 overflow-hidden gap-0">
        <div className="p-6 pb-4">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-semibold">选择卡片主题</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              为「{modeText}」选择一种视觉风格，共 {CARD_THEMES.length} 种主题可选
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-2 max-h-[380px] overflow-y-auto [scrollbar-width:thin]">
          <div className="grid grid-cols-3 gap-3">
            {CARD_THEMES.map((theme) => (
              <ThemePreviewCard
                key={theme.id}
                theme={theme}
                selected={selectedId === theme.id}
                onClick={() => setSelectedId(theme.id)}
              />
            ))}
          </div>
        </div>

        {/* Watermark Config Panel */}
        <div className="px-6 py-3 border-t border-b bg-muted/20">
          <button
            type="button"
            onClick={() => setConfigOpen((v) => !v)}
            className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <LucideIcons.Settings className="h-3 w-3" />
              生成选项
            </span>
            <LucideIcons.ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${configOpen ? "rotate-180" : ""}`}
            />
          </button>
          {configOpen && (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/80">显示底部信息栏</span>
                <Switch
                  checked={watermarkConfig.showWatermark}
                  onCheckedChange={() => toggleConfig("showWatermark")}
                  className="scale-75 origin-right"
                />
              </div>
              <div className="flex items-center justify-between pl-3">
                <span className="text-xs text-muted-foreground">显示品牌名</span>
                <Switch
                  checked={watermarkConfig.showBrand}
                  onCheckedChange={() => toggleConfig("showBrand")}
                  disabled={!watermarkConfig.showWatermark}
                  className="scale-75 origin-right"
                />
              </div>
              <div className="flex items-center justify-between pl-3">
                <span className="text-xs text-muted-foreground">显示日期</span>
                <Switch
                  checked={watermarkConfig.showDate}
                  onCheckedChange={() => toggleConfig("showDate")}
                  disabled={!watermarkConfig.showWatermark}
                  className="scale-75 origin-right"
                />
              </div>
              <div className="flex items-center justify-between pl-3">
                <span className="text-xs text-muted-foreground">追加时分秒</span>
                <Switch
                  checked={watermarkConfig.showTime}
                  onCheckedChange={() => toggleConfig("showTime")}
                  disabled={!watermarkConfig.showWatermark || !watermarkConfig.showDate}
                  className="scale-75 origin-right"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="h-8 text-xs bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white border-0"
          >
            <LucideIcons.Image className="mr-1.5 h-3.5 w-3.5" />
            生成图片
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThemePreviewCard({
  theme,
  selected,
  onClick,
}: {
  theme: CardTheme;
  selected: boolean;
  onClick: () => void;
}) {
  const previewTitle = "设计即生活";
  const previewBody = "好的排版让阅读成为一种享受，每个细节都藏着设计师的用心。";

  const cardStyle: React.CSSProperties = {
    background: theme.background.includes("gradient")
      ? theme.background
      : theme.background,
    borderRadius: 8,
    padding: 10,
    position: "relative",
    cursor: "pointer",
    transition: "all 0.15s ease",
    border: selected
      ? "2px solid hsl(var(--primary))"
      : "2px solid transparent",
    boxShadow: selected
      ? "0 0 0 3px hsl(var(--primary) / 0.12), 0 4px 12px rgba(0,0,0,0.08)"
      : "0 1px 3px rgba(0,0,0,0.06)",
    transform: selected ? "scale(1.02)" : "scale(1)",
  };

  const innerCardStyle: React.CSSProperties = {
    background: theme.cardBg.includes("rgba")
      ? theme.cardBg
      : theme.cardBg === "transparent"
        ? "transparent"
        : theme.cardBg,
    borderRadius: Math.max(theme.cardRadius * 0.35, 3),
    padding: `${Math.max(theme.cardPaddingY * 0.25, 6)}px ${Math.max(theme.cardPaddingX * 0.25, 8)}px`,
    border: theme.cardBorder === "none" ? "none" : "1px solid rgba(0,0,0,0.06)",
    boxShadow: theme.cardShadow.includes("none") ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
    minHeight: 72,
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
    <div onClick={onClick} style={cardStyle} className="group">
      <div style={innerCardStyle}>
        <div style={titleStyle}>{previewTitle}</div>
        <div style={bodyStyle}>{previewBody}</div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-foreground leading-tight">
            {theme.name}
          </span>
          <span className="text-[9px] text-muted-foreground leading-tight">
            {theme.nameEn}
          </span>
        </div>
        {selected && (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary shrink-0">
            <LucideIcons.Check className="h-2.5 w-2.5 text-primary-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
