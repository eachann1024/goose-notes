import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

const selectableCardVariants = cva(
  "w-full rounded-lg border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      selected: {
        true: "border-[hsl(var(--foreground)/0.28)] bg-[var(--goose-interactive-selected)] shadow-[inset_0_0_0_1px_var(--goose-interactive-selected-border)]",
        false: "border-border hover:bg-[var(--goose-interactive-hover)] hover:border-[hsl(var(--foreground)/0.2)]",
      },
      tone: {
        default: "",
        danger: "hover:bg-destructive/10 hover:border-destructive/35",
      },
    },
    defaultVariants: {
      selected: false,
      tone: "default",
    },
  }
)

export interface SelectableCardProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof selectableCardVariants> {
  asChild?: boolean
}

const SelectableCard = React.forwardRef<HTMLButtonElement, SelectableCardProps>(
  ({ className, selected, tone, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        className={cn(selectableCardVariants({ selected, tone, className }))}
        {...props}
      />
    )
  }
)

SelectableCard.displayName = "SelectableCard"

export { SelectableCard }
