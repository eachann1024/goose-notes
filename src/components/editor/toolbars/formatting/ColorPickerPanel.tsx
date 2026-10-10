import { Button } from "@/components/editor/ui/button";
import { cn } from "@/components/editor/utils/cn";
import { colorPanelBoxStyle } from "./colorPanelGeometry";
import {
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  COLOR_PREVIEW,
  BG_PREVIEW,
} from "./colorPalette";
import { isColorSwatchSelected } from "./heldColorSelection";
import type { useColorPanelState } from "./useColorPanelState";
import type { useColorActions } from "./useColorActions";

export function ColorPickerPanel({
  panel,
  actions,
}: {
  panel: ReturnType<typeof useColorPanelState>;
  actions: ReturnType<typeof useColorActions>;
}) {
  const {
    isMounted,
    position,
    panelRef,
    isOpen,
    handleMouseEnter,
    handleMouseLeave,
    currentTextColor,
    currentBgColor,
  } = panel;
  const { applyTextColor, applyBackgroundColor, applyColorPair } = actions;
  return isMounted && position ? (
    <div
      ref={panelRef}
      className="goose-color-picker-float"
      data-open={isOpen ? "true" : "false"}
      data-side={position.showAbove ? "above" : "below"}
      onMouseDown={(e) => e.preventDefault()}
      style={colorPanelBoxStyle(position)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="goose-color-picker-panel flex flex-col border border-border bg-popover shadow-md">
        <div className="goose-color-picker-title font-semibold text-muted-foreground">
          文本颜色
        </div>
        <div className="goose-color-picker-grid grid">
          {TEXT_COLORS.map((item, index) => (
            <Button
              key={item.color}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "goose-color-picker-swatch h-7 w-7 min-h-7 min-w-7 shrink-0 border border-transparent p-0 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                isColorSwatchSelected(currentTextColor, item.color)
                  ? "bg-accent border-primary/20 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]"
                  : "",
              )}
              onClick={() => {
                applyTextColor(item.color);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyColorPair(index);
              }}
            >
              <div
                className="goose-color-picker-letter font-serif leading-none"
                style={{
                  color:
                    item.color === "default"
                      ? undefined
                      : COLOR_PREVIEW[item.color],
                }}
              >
                A
              </div>
            </Button>
          ))}
        </div>

        <div className="goose-color-picker-divider border-t border-border/60" />

        <div className="goose-color-picker-title font-semibold text-muted-foreground">
          背景颜色
        </div>
        <div className="goose-color-picker-grid goose-color-picker-grid-last grid">
          {HIGHLIGHT_COLORS.map((item, index) => (
            <Button
              key={item.color}
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "goose-color-picker-swatch h-7 w-7 min-h-7 min-w-7 shrink-0 border border-transparent p-0 hover:border-border/80 hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
                isColorSwatchSelected(currentBgColor, item.color)
                  ? "border-primary"
                  : "",
              )}
              onClick={() => {
                applyBackgroundColor(item.color);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyColorPair(index);
              }}
            >
              <div
                className="goose-color-picker-background-swatch border border-border/20"
                style={{
                  backgroundColor:
                    item.color === "default"
                      ? "transparent"
                      : BG_PREVIEW[item.color],
                }}
              />
            </Button>
          ))}
        </div>
      </div>
    </div>
  ) : null;
}
