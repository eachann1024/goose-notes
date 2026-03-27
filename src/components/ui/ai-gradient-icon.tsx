import { useId, type SVGProps } from "react";
import { cn } from "@/lib/utils";

type AiGradientIconProps = SVGProps<SVGSVGElement>;

export function AiGradientIcon({
  className,
  ...props
}: AiGradientIconProps) {
  const gradientId = useId();
  const accentGradientId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#95F3D8" />
          <stop offset="48%" stopColor="#63D7FF" />
          <stop offset="100%" stopColor="#FFD66E" />
        </linearGradient>
        <linearGradient
          id={accentGradientId}
          x1="18"
          y1="2"
          x2="6"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFF2B8" />
          <stop offset="100%" stopColor="#6BE8FF" />
        </linearGradient>
      </defs>
      <path
        d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 2v4"
        stroke={`url(#${accentGradientId})`}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M22 4h-4"
        stroke={`url(#${accentGradientId})`}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle
        cx="4"
        cy="20"
        r="1.9"
        stroke={`url(#${accentGradientId})`}
        strokeWidth="1.6"
      />
    </svg>
  );
}
