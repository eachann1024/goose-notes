import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const iconButtonVariants = cva(
  "goose-interactive inline-flex shrink-0 items-center justify-center rounded-md border border-transparent transition-colors ring-offset-background disabled:pointer-events-none disabled:text-disabled",
  {
    variants: {
      tone: {
        default:
          "text-foreground/90",
        muted:
          "text-muted-foreground/70 dark:text-muted-foreground/55",
        danger:
          "goose-interactive-danger",
        handle:
          "bg-muted/80 text-muted-foreground border-border/50 backdrop-blur-[1px] cursor-grab",
      },
      size: {
        xs: "h-6 w-6",
        sm: "h-7 w-7",
        icon: "h-8 w-8",
      },
      active: {
        true: "goose-interactive--selected",
        false: "",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "sm",
      active: false,
    },
  },
);

export interface IconButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, tone, size, active, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(iconButtonVariants({ tone, size, active, className }))}
        {...props}
      />
    );
  },
);

IconButton.displayName = "IconButton";

export { IconButton };
