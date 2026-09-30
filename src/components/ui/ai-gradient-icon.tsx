import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import type { AiActivityPhase } from "@/stores/useAiStatus";

interface AiGradientIconProps extends SVGProps<SVGSVGElement> {
  state?: AiActivityPhase;
}

export function AiGradientIcon({
  className,
  state = "idle",
  ...props
}: AiGradientIconProps) {
  const done = state === "done";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 ai-icon", className)}
      data-ai-state={state}
      aria-hidden="true"
      {...props}
    >
      {done && (
        <circle
          className="ai-icon-flash"
          cx="12"
          cy="12"
          r="11"
          fill="currentColor"
          fillOpacity="0.22"
        />
      )}

      <g className="ai-icon-glyph">
        <path
          d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1 -1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 2v4"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M22 4h-4"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <circle
          cx="4"
          cy="20"
          r="1.9"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </g>
    </svg>
  );
}
