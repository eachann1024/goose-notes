import { cn } from "@/lib/utils"
import type { Page } from "@/types"

interface FontSelectorProps {
  value: Page['fontFamily']
  onChange: (value: Page['fontFamily']) => void
}

const fonts = [
  { value: 'default' as const, label: '默认', className: 'font-sans' },
  { value: 'serif' as const, label: '衬线体', className: 'font-serif' },
  { value: 'mono' as const, label: '等宽体', className: 'font-mono' },
]

export function FontSelector({ value, onChange }: FontSelectorProps) {
  return (
    <div className="flex gap-1 p-1">
      {fonts.map((font) => (
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
          <span className={cn("text-2xl leading-none mb-1", font.className)}>
            Ag
          </span>
          <span className={cn("text-xs", font.className)}>
            {font.label}
          </span>
        </button>
      ))}
    </div>
  )
}
