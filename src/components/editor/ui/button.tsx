import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium ring-offset-background transition-colors disabled:pointer-events-none disabled:text-disabled [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "goose-interactive goose-interactive-primary shadow-[0_6px_14px_rgba(15,23,42,0.12)]",
        destructive:
          "goose-interactive goose-interactive-danger",
        outline:
          "border border-transparent bg-background hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_0_0_1px_hsl(var(--input)/0.55)] hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]",
        ghost:
          "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] data-[state=open]:bg-[var(--goose-interactive-selected)] data-[state=open]:text-[var(--goose-interactive-selected-fg)]",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-control px-3",
        lg: "h-11 rounded-control px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
