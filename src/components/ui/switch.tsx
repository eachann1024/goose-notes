import * as React from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  onCheckedChange?: (checked: boolean) => void;
};
// 原生 checkbox 保留 label/htmlFor、表单提交、Space 和受控 checked 契约。
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      role="switch"
      className={cn(
        "peer relative inline-block h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-transparent bg-input transition-colors checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 before:pointer-events-none before:block before:h-5 before:w-5 before:rounded-full before:bg-background before:shadow-lg before:transition-transform checked:before:translate-x-5 motion-reduce:transition-none motion-reduce:before:transition-none",
        className,
      )}
      onChange={(event) => {
        onChange?.(event);
        onCheckedChange?.(event.currentTarget.checked);
      }}
    />
  ),
);
Switch.displayName = "Switch";
export { Switch };
