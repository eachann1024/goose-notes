import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  PROMPT_BAR_EXPANDED_RADIUS,
  promptBarBeamRadius,
} from "./promptBarBeamRadius";

import { usePromptBarLayoutMotion } from "./usePromptBarLayoutMotion";

const BEAM_INSET = 1;

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
  const barRef = useRef<HTMLDivElement>(null);
  usePromptBarLayoutMotion(barRef);
  const [beamRadius, setBeamRadius] = useState(
    expanded ? PROMPT_BAR_EXPANDED_RADIUS - BEAM_INSET : 21,
  );

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || !streaming) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setBeamRadius(
        promptBarBeamRadius({
          width,
          height,
          expanded: Boolean(expanded),
          inset: BEAM_INSET,
        }),
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, streaming]);

  return (
    <div
      ref={barRef}
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
