import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { TOOLTIP_DELAY_MS } from "@/components/ui/tooltip-delay";
/**
 * Dropdown / 溢出容器内 Radix Tooltip 常被 pointer 捕获拦掉。
 * 用 body portal + 固定定位，延迟与全局 Tooltip 一致。
 */
export function PortalHoverTip({
  content,
  children,
}: {
  content: string;
  children: (handlers: {
    onMouseEnter: (event: MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
  }) => ReactNode;
}) {
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);
  const showTimerRef = useRef<number>(0);

  const clearShowTimer = () => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = 0;
    }
  };

  useEffect(() => () => clearShowTimer(), []);

  return (
    <>
      {children({
        onMouseEnter: (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const maxWidth = 288;
          const left = Math.min(
            Math.max(8, rect.left),
            window.innerWidth - maxWidth - 8,
          );
          const nextTip = { top: rect.bottom + 6, left };
          clearShowTimer();
          showTimerRef.current = window.setTimeout(() => {
            setTip(nextTip);
          }, TOOLTIP_DELAY_MS);
        },
        onMouseLeave: () => {
          clearShowTimer();
          setTip(null);
        },
      })}
      {tip && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[30000] max-w-xs select-none whitespace-normal break-words rounded-control border border-border/80 bg-popover px-2.5 py-1.5 text-[12px] font-medium leading-snug text-popover-foreground shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-white/20"
              style={{ top: tip.top, left: tip.left }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
