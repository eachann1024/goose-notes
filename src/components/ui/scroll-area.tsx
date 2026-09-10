import * as React from "react";
import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    className={cn("relative overflow-hidden", className)}
  >
    <div
      className="h-full w-full overflow-auto rounded-[inherit] [scrollbar-width:thin]"
      tabIndex={0}
    >
      {children}
    </div>
  </div>
));
ScrollArea.displayName = "ScrollArea";
export { ScrollArea };
