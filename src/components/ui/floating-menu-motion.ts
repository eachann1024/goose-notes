import type { CSSProperties } from "react";

export const FLOATING_MENU_OPEN_MS = 200;
export const FLOATING_MENU_CLOSE_MS = 150;
export const FLOATING_MENU_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const FLOATING_MENU_EASE_IN = "ease-in";
export const FLOATING_MENU_SCALE = 0.96;
export const FLOATING_MENU_SHIFT_PX = 6;

export type FloatingMotionMode = "instant" | "reduced" | "full";
export type FloatingMotionStatus = "unmounted" | "initial" | "open" | "close";

export function floatingMenuOrigin(placement: string): string {
  const [side, align = "center"] = placement.split("-");
  const fromSide =
    side === "top"
      ? "bottom"
      : side === "left"
        ? "right"
        : side === "right"
          ? "left"
          : "top";
  const fromAlign =
    align === "start"
      ? side === "left" || side === "right"
        ? "top"
        : "left"
      : align === "end"
        ? side === "left" || side === "right"
          ? "bottom"
          : "right"
        : "center";
  return `${fromSide} ${fromAlign}`;
}

export function floatingMenuFromTransform(side: string): string {
  const shift = FLOATING_MENU_SHIFT_PX;
  if (side === "top") return `translateY(${shift}px) scale(${FLOATING_MENU_SCALE})`;
  if (side === "left") return `translateX(${shift}px) scale(${FLOATING_MENU_SCALE})`;
  if (side === "right")
    return `translateX(-${shift}px) scale(${FLOATING_MENU_SCALE})`;
  return `translateY(-${shift}px) scale(${FLOATING_MENU_SCALE})`;
}

export function floatingMenuMotionStyle(
  status: FloatingMotionStatus,
  placement: string,
  motionMode: FloatingMotionMode,
  options?: { shift?: boolean },
): CSSProperties {
  const side = placement.split("-")[0] || "bottom";
  const shift = options?.shift !== false;
  const visuallyOpen =
    status === "open" || (motionMode === "instant" && status === "initial");
  const instant =
    motionMode === "instant" || status === "initial" || status === "unmounted";
  const duration = instant
    ? 0
    : visuallyOpen
      ? FLOATING_MENU_OPEN_MS
      : FLOATING_MENU_CLOSE_MS;
  const reduced = motionMode !== "full";
  const closedTransform = shift
    ? floatingMenuFromTransform(side)
    : `scale(${FLOATING_MENU_SCALE})`;
  return {
    transformOrigin: floatingMenuOrigin(placement),
    opacity: visuallyOpen ? 1 : 0,
    transform: reduced
      ? "none"
      : visuallyOpen
        ? shift
          ? "translate(0px, 0px) scale(1)"
          : "scale(1)"
        : closedTransform,
    transitionProperty: reduced ? "opacity" : "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: visuallyOpen
      ? FLOATING_MENU_EASE_OUT
      : FLOATING_MENU_EASE_IN,
  };
}
