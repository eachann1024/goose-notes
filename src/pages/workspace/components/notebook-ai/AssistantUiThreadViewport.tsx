import type { ReactNode } from "react";
import { ThreadPrimitive } from "@assistant-ui/react";

interface AssistantUiThreadViewportProps {
  className?: string;
  children: ReactNode;
}
export function AssistantUiThreadViewport({
  className,
  children,
}: AssistantUiThreadViewportProps) {
  return (
    <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
      <ThreadPrimitive.Viewport
        autoScroll
        turnAnchor="bottom"
        scrollToBottomOnRunStart
        scrollToBottomOnInitialize
        scrollToBottomOnThreadSwitch
        className={className}
      >
        {children}
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
