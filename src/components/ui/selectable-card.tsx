import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const selectableCardVariants = cva(
  "goose-interactive w-full rounded-lg border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      selected: {
        true: "goose-interactive--selected border-transparent",
        false: "border-transparent",
      },
      tone: {
        default: "",
        danger: "goose-interactive-danger",
      },
    },
    defaultVariants: {
      selected: false,
      tone: "default",
    },
  },
);

export interface SelectableCardProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof selectableCardVariants> {}

const SelectableCard = React.forwardRef<HTMLButtonElement, SelectableCardProps>(
  ({ className, selected, tone, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(selectableCardVariants({ selected, tone, className }))}
        {...props}
      />
    );
  },
);

SelectableCard.displayName = "SelectableCard";

export { SelectableCard };
