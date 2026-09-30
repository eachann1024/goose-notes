import { useState } from "react";
import { ChevronDown } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const fontModes: { value: DefaultFontMode; label: string }[] = [
  { value: "system", label: "系统默认" },
  { value: "serif", label: "系统衬线" },
  { value: "mono", label: "系统等宽" },
  { value: "custom", label: "自定义本机字体" },
];

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
        <Label id={`${id}-label`} htmlFor={id}>正文默认字体</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-labelledby={`${id}-label ${id}-value`}
              className="w-full min-w-0 justify-between border-input px-3 font-normal text-foreground"
            >
              <span id={`${id}-value`} className="truncate">
                {fontModes.find((option) => option.value === mode)?.label}
              </span>
              <ChevronDown aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" aria-label="正文默认字体" className="min-w-[var(--trigger-width)]">
            <DropdownMenuRadioGroup
              value={mode}
              onValueChange={(nextValue) => {
                const nextMode = fontModes.find((option) => option.value === nextValue)?.value;
                if (!nextMode) return;
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
            >
              {fontModes.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {mode === "custom" && (
        <div className="space-y-2">
          <Label htmlFor={`${id}-custom`}>本机字体名称</Label>
          <LocalFontInput
            id={`${id}-custom`}
            value={inferredMode === "custom" && value !== null ? value : ""}
            onChange={(font) => {
              setModeOverride(font ? null : { value: null, mode: "custom" });
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
