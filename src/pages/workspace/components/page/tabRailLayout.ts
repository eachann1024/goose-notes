export type TabRailLayoutMode = "fill" | "split" | "scroll";

export const TAB_RAIL_TITLE_FIELD_SELECTOR =
  "input, textarea, [data-page-title-field]";

function asClosestHost(
  target: EventTarget | null,
): Pick<Element, "closest"> | null {
  if (typeof target !== "object" || target === null) return null;
  if ("closest" in target && typeof target.closest === "function") {
    return target as Pick<Element, "closest">;
  }
  return null;
}

export function isTabRailTitleFieldTarget(target: EventTarget | null): boolean {
  return Boolean(
    asClosestHost(target)?.closest(TAB_RAIL_TITLE_FIELD_SELECTOR),
  );
}

export function shouldHandleTabActivationKey(
  key: string,
  target: EventTarget | null,
): boolean {
  if (key !== "Enter" && key !== " ") return false;
  return !isTabRailTitleFieldTarget(target);
}

/** 4 个及以上标签开始横向滚动，单个下限 140px。 */
export const TAB_RAIL_SCROLL_MIN_COUNT = 4;

export function getTabRailLayoutMode(tabCount: number): TabRailLayoutMode {
  if (tabCount <= 1) return "fill";
  if (tabCount < TAB_RAIL_SCROLL_MIN_COUNT) return "split";
  return "scroll";
}

export function tabRailSelectionClassName(tabCount: number, isActive: boolean): string {
  if (tabCount <= 1) return "text-foreground";
  return isActive
    ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
    : "text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]";
}

export function tabRailListClassName(tabCount: number): string {
  const mode = getTabRailLayoutMode(tabCount);
  if (mode === "scroll") {
    return "tab-rail flex min-w-0 flex-1 items-center overflow-x-auto";
  }
  return "tab-rail flex min-w-0 flex-1 items-center";
}

/**
 * 1 个：flex-1，固定上限 560px——顶栏右侧始终留空白轨道供拖动窗口、
 *     双击最大化/还原；用固定像素而非百分比，最大化后 pill 不伸长，
 *     不会吞掉用户刚双击过的空白点。
 * 2–3 个：flex: 1 1 0 等分，单个上限 280px，宽屏时右侧留空白。
 * 4+：min-width 140px，超出滚动。
 */
export function tabRailItemClassName(tabCount: number): string {
  const mode = getTabRailLayoutMode(tabCount);
  if (mode === "fill") {
    return "tab-rail-item min-w-0 flex-1 max-w-[560px]";
  }
  if (mode === "split") {
    return "tab-rail-item min-w-0 flex-[1_1_0] max-w-[280px]";
  }
  return "tab-rail-item min-w-[140px] flex-none";
}
