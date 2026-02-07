interface ResolveScrollBehaviorOptions {
  distance: number;
  smoothThreshold?: number;
}

const DEFAULT_SMOOTH_THRESHOLD = 200;

export function resolveEditorScrollBehavior({
  distance,
  smoothThreshold = DEFAULT_SMOOTH_THRESHOLD,
}: ResolveScrollBehaviorOptions): ScrollBehavior {
  if (!Number.isFinite(distance)) return "auto";

  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return "auto";
  }

  return Math.abs(distance) <= smoothThreshold ? "smooth" : "auto";
}
