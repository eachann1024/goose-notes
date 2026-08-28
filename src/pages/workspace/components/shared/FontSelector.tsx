import type { Page } from "@/types";
import {
  DEFAULT_FONT_NAMES,
  ensureEditorFontAvailable,
  toCssFontFamily,
} from "@/lib/fontLoader";

interface FontSelectorProps {
  value: Page["fontFamily"];
  onChange: (value: Page["fontFamily"]) => void;
  compact?: boolean;
}

const defaultFonts = [
  {
    value: "default" as const,
    label: "默认",
    defaultFont: DEFAULT_FONT_NAMES.default,
  },
  {
    value: "serif" as const,
    label: "衬线体",
    defaultFont: DEFAULT_FONT_NAMES.serif,
  },
  {
    value: "mono" as const,
    label: "等宽体",
    defaultFont: DEFAULT_FONT_NAMES.mono,
  },
];

export function FontSelector({
  value,
  onChange,
  compact = false,
}: FontSelectorProps) {
  const { customFonts } = useSettings();

  const selectFont = (fontFamily: Page["fontFamily"]) => {
    onChange(fontFamily);
    void ensureEditorFontAvailable(fontFamily, customFonts);
  };

  return (
    <div className={cn("flex gap-1", compact ? "p-0.5" : "p-1")}>
      {defaultFonts.map((font) => {
        const customFont = customFonts[font.value];
        const label = customFont.label || font.label;
        const fontName = customFont.font || font.defaultFont;

        return (
          <button
            key={font.value}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              selectFont(font.value);
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            className={cn(
              "flex-1 rounded-md transition-all duration-200",
              compact ? "px-2 py-1.5" : "px-3 py-2",
              "flex flex-col items-center justify-center border border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "hover:bg-[var(--goose-interactive-selected)] hover:text-[var(--goose-interactive-selected-fg)]",
              value === font.value &&
                "bg-background ring-2 ring-primary text-primary shadow-sm",
            )}
          >
            <span
              className={cn(
                "leading-none",
                compact ? "mb-0.5 text-xl" : "mb-1 text-2xl",
              )}
              style={{ fontFamily: toCssFontFamily(fontName) }}
            >
              Ag
            </span>
            <span
              className="text-xs"
              style={{ fontFamily: toCssFontFamily(fontName) }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
