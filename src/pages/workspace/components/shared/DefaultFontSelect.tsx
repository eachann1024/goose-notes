import { useState } from "react";
import {
  getEditorFontFamilies,
  SYSTEM_FONT_STACK,
  toCssFontFamily,
} from "@/lib/fontLoader";
import type { CustomFonts } from "@/stores/useSettings";
import { LocalFontInput } from "./LocalFontInput";

export type DefaultFontMode = "system" | "serif" | "mono" | "custom";

export function getDefaultFontMode(value: string | null): DefaultFontMode {
  if (value === null) return "system";
  if (value === "serif") return "serif";
  if (value === "monospace") return "mono";
  return "custom";
}

export function defaultFontValueForMode(mode: DefaultFontMode): string | null {
  if (mode === "serif") return "serif";
  if (mode === "mono") return "monospace";
  return null;
}

const emptyFonts: CustomFonts = {
  default: { label: null, font: null },
  serif: { label: null, font: null },
  mono: { label: null, font: null },
};

export function DefaultFontSelect({
  id,
  value,
  fontSize,
  lineHeight,
  onChange,
  showPreview = true,
}: {
  id: string;
  value: string | null;
  fontSize: number;
  lineHeight: number;
  onChange: (value: string | null) => void;
  showPreview?: boolean;
}) {
  const [modeOverride, setModeOverride] = useState<{
    value: string | null;
    mode: DefaultFontMode;
  } | null>(null);
  const inferredMode = getDefaultFontMode(value);
  const mode = modeOverride?.value === value ? modeOverride.mode : inferredMode;
  const fontStack = value === null
    ? SYSTEM_FONT_STACK
    : getEditorFontFamilies("default", {
        ...emptyFonts,
        default: { label: null, font: value },
      }).map(toCssFontFamily).join(", ");

  return (
    <div className="default-font-select space-y-3">
      <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-medium">正文默认字体</label>
        <select
          id={id}
          value={mode}
          onChange={(event) => {
            const nextMode = event.currentTarget.value as DefaultFontMode;
            if (nextMode === "custom") {
              if (inferredMode === "custom") {
                setModeOverride(null);
              } else {
                onChange(null);
                setModeOverride({ value: null, mode: "custom" });
              }
              return;
            }
            setModeOverride(null);
            onChange(defaultFontValueForMode(nextMode));
          }}
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="system">系统默认（与 Codex 一致）</option>
          <option value="serif">系统衬线</option>
          <option value="mono">系统等宽</option>
          <option value="custom">自定义本机字体</option>
        </select>
      </div>

      {mode === "custom" && (
        <div className="space-y-2">
          <label htmlFor={`${id}-custom`} className="text-sm font-medium">本机字体名称</label>
          <LocalFontInput
            id={`${id}-custom`}
            value={inferredMode === "custom" && value !== null ? value : ""}
            onChange={(font) => {
              setModeOverride(null);
              onChange(font || null);
            }}
            placeholder="输入已安装的字体名称"
          />
        </div>
      )}

      {showPreview && (
        <section
          aria-label="正文字体预览"
          className="rounded-lg border border-border/70 bg-muted/40 p-3 text-foreground"
          style={{ fontFamily: fontStack, fontSize, lineHeight }}
        >
          <p>你好，世界。 <span lang="en">A little room to think.</span></p>
          <p><strong>重点文字 · <span lang="en">Bold emphasis</span></strong></p>
        </section>
      )}
    </div>
  );
}
