export const AI_PANEL_LAYOUT_ATTR = "data-ai-panel-layout";

export type AiPanelLayout = "side-panel" | "fullscreen";

type ClosestHost = {
  closest: (selector: string) => ClosestHost | Element | null;
  getAttribute?: (name: string) => string | null;
  parentElement?: ClosestHost | Element | null;
};

function elementFromTarget(target: EventTarget | Element | null): ClosestHost | null {
  if (!target || typeof target !== "object") return null;
  const host = target as ClosestHost;
  if (typeof host.closest === "function") return host;
  if (host.parentElement && typeof host.parentElement.closest === "function") {
    return host.parentElement as ClosestHost;
  }
  return null;
}

/** 焦点是否在指定（或任意）AI 面板根节点内，含 composer / 消息区。 */
export function isFocusInsideAiPanel(
  target: EventTarget | Element | null,
  layout?: AiPanelLayout,
): boolean {
  const el = elementFromTarget(target);
  if (!el) return false;
  const selector = layout
    ? `[${AI_PANEL_LAYOUT_ATTR}="${layout}"]`
    : `[${AI_PANEL_LAYOUT_ATTR}]`;
  return Boolean(el.closest(selector));
}

export function getFocusedAiPanelLayout(
  target: EventTarget | Element | null,
): AiPanelLayout | null {
  const el = elementFromTarget(target);
  if (!el) return null;
  const root = el.closest(`[${AI_PANEL_LAYOUT_ATTR}]`);
  const layout = root?.getAttribute?.(AI_PANEL_LAYOUT_ATTR);
  if (layout === "side-panel" || layout === "fullscreen") return layout;
  return null;
}
