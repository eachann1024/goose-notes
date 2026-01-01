import { cn } from "@/lib/utils"
import type { Page } from "@/types"
import { useSettings } from "@/stores/useSettings"

interface FontSelectorProps {
  value: Page['fontFamily']
  onChange: (value: Page['fontFamily']) => void
}

const defaultFonts = [
  { value: 'default' as const, label: '默认', defaultFont: 'Inter' },
  { value: 'serif' as const, label: '衬线体', defaultFont: 'Source Serif 4' },
  { value: 'mono' as const, label: '等宽体', defaultFont: 'JetBrains Mono' },
]

export function FontSelector({ value, onChange }: FontSelectorProps) {
  const { customFonts } = useSettings()

  return (
    <div className="flex gap-1 p-1">
      {defaultFonts.map((font) => {
        const customFont = customFonts[font.value]
        const label = customFont.label || font.label
        const fontName = customFont.font || font.defaultFont

        return (
          <button
            key={font.value}
            onClick={() => onChange(font.value)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-md transition-all",
              "hover:bg-accent/50",
              value === font.value
                ? "bg-background ring-2 ring-primary text-primary shadow-sm"
                : ""
            )}
          >
            <span
              className="text-2xl leading-none mb-1"
              style={{ fontFamily: `"${fontName}"` }}
            >
              Ag
            </span>
            <span
              className="text-xs"
              style={{ fontFamily: `"${fontName}"` }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
