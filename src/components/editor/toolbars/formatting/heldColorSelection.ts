import { MIXED } from "./colorPalette";

export function resolveHeldTextSelection(
  current: { empty: boolean; from: number; to: number },
  held: { from: number; to: number } | null,
): { from: number; to: number } | null {
  if (!current.empty && current.from !== current.to) {
    return {
      from: Math.min(current.from, current.to),
      to: Math.max(current.from, current.to),
    };
  }
  return held;
}

export function resolveHeldColorState<T>(
  live: T,
  held: T | null,
  hasLiveSelection: boolean,
): T {
  return hasLiveSelection || held == null ? live : held;
}

export function resolveOpenColorState<T>(
  live: T,
  held: T | null,
  isOpen: boolean,
): T {
  return isOpen && held != null ? held : live;
}

export function applyHeldColorPatch<
  T extends { textColor: string; backgroundColor: string },
>(held: T, patch: Partial<Pick<T, "textColor" | "backgroundColor">>): T {
  return { ...held, ...patch };
}

export function isColorSwatchSelected(
  current: string,
  swatch: string,
): boolean {
  return current !== MIXED && current === swatch;
}
