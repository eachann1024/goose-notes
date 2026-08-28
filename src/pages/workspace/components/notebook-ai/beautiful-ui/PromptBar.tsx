import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PromptBar({
  streaming,
  expanded,
  children,
  className,
}: {
  streaming?: boolean;
  /** 多行展开态：beam 圆角从胶囊收到 20px，与外壳一致 */
  expanded?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const beamRadius = expanded ? 20 : 999;
  return (
    <div
      className={cn(
        "bui-prompt-bar",
        streaming && "bui-prompt-bar--streaming",
        className,
      )}
      data-streaming={streaming ? "true" : undefined}
      data-expanded={expanded ? "true" : undefined}
    >
      {streaming ? (
        <svg className="bui-prompt-bar-beam" aria-hidden focusable="false">
          <rect
            className="bui-prompt-bar-beam-glow"
            width="100%"
            height="100%"
            rx={beamRadius}
            ry={beamRadius}
            pathLength="1"
          />
          <rect
            className="bui-prompt-bar-beam-core"
            width="100%"
            height="100%"
            rx={beamRadius}
            ry={beamRadius}
            pathLength="1"
          />
        </svg>
      ) : null}
      {children}
    </div>
  );
}
