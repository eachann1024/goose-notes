import * as GooseIcons from "@/components/ui/icons";
import {
  DEFAULT_UI_FONT_SIZE,
  UI_SCALE_MIN,
  UI_SCALE_MAX,
} from "@/stores/settings/types";
import type { useAppearanceSettings } from "./useAppearanceSettings";
import { APPEARANCE_OPTION_ROW_CLASS } from "./shared";

export function renderUIFontSizeSettings(
  context: ReturnType<typeof useAppearanceSettings>,
) {
  const {
    uiFontSize,
    setUIFontSize,
    unlockScaleDragLayout,
    lockScaleDragLayout,
  } = context;
  return (
    <div className={`space-y-4 p-4 ${APPEARANCE_OPTION_ROW_CLASS}`}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="interface-scale" className="flex items-center gap-3">
          <GooseIcons.AppWindow
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
          界面缩放
        </Label>
        <output htmlFor="interface-scale" className="text-sm tabular-nums">
          {uiFontSize}%
        </output>
      </div>
      <p className="text-xs text-muted-foreground">
        等比缩放标题栏、侧栏与设置面板；正文字号保持独立。
      </p>
      <input
        id="interface-scale"
        type="range"
        min={UI_SCALE_MIN}
        max={UI_SCALE_MAX}
        step={1}
        value={uiFontSize}
        aria-valuetext={`${uiFontSize}%`}
        className="block h-6 w-full cursor-pointer accent-primary"
        onPointerDown={lockScaleDragLayout}
        onPointerUp={unlockScaleDragLayout}
        onPointerCancel={unlockScaleDragLayout}
        onLostPointerCapture={unlockScaleDragLayout}
        onChange={(event) => setUIFontSize(Number(event.target.value))}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{UI_SCALE_MIN}%</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={uiFontSize === DEFAULT_UI_FONT_SIZE}
          onClick={() => setUIFontSize(DEFAULT_UI_FONT_SIZE)}
        >
          恢复默认 (100%)
        </Button>
        <span>{UI_SCALE_MAX}%</span>
      </div>
    </div>
  );
}
