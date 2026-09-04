export type TabRailLayoutMode = "fill" | "split" | "scroll";

/** 4 个及以上标签开始横向滚动，单个下限 140px。 */
export const TAB_RAIL_SCROLL_MIN_COUNT = 4;

export function getTabRailLayoutMode(tabCount: number): TabRailLayoutMode {
  if (tabCount <= 1) return "fill";
  if (tabCount < TAB_RAIL_SCROLL_MIN_COUNT) return "split";
  return "scroll";
}

export function tabRailListClassName(tabCount: number): string {
  const mode = getTabRailLayoutMode(tabCount);
  if (mode === "scroll") {
    return "tab-rail flex min-w-0 flex-1 items-center overflow-x-auto";
  }
  return "tab-rail flex min-w-0 flex-1 items-center";
}

/**
 * 1 个：flex-1 占满，不要 max-w-[120px]。
 * 2–3 个：flex: 1 1 0 等分。
 * 4+：min-width 140px，超出滚动。
 */
export function tabRailItemClassName(tabCount: number): string {
  const mode = getTabRailLayoutMode(tabCount);
  if (mode === "fill") {
    return "tab-rail-item min-w-0 flex-1";
  }
  if (mode === "split") {
    return "tab-rail-item min-w-0 flex-[1_1_0]";
  }
  return "tab-rail-item min-w-[140px] flex-none";
}
