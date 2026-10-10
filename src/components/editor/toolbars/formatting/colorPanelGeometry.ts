export interface PositionState {
  top: number;
  left: number;
  showAbove: boolean;
}

export function colorPanelBoxStyle(position: PositionState): {
  top: number | "auto";
  bottom: number | "auto";
  left: number;
} {
  if (position.showAbove) {
    return {
      top: "auto",
      bottom: document.documentElement.clientHeight - position.top,
      left: position.left,
    };
  }
  return {
    top: position.top,
    bottom: "auto",
    left: position.left,
  };
}

const PANEL_BASE_WIDTH = 172;
const PANEL_BASE_HEIGHT = 190;
const PANEL_VIEWPORT_PADDING = 8;

export function getColorPanelPosition({
  trigger,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
  gap,
  forceShowAbove,
}: {
  trigger: Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width">;
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap: number;
  forceShowAbove?: boolean;
}): PositionState {
  const padding = PANEL_VIEWPORT_PADDING;
  const spaceAbove = trigger.top - padding;
  const spaceBelow = viewportHeight - padding - trigger.bottom;
  const needed = panelHeight + gap;
  // 底栏 / 小窗场景：触发器靠近视口下半区时优先向上展开，
  // 避免色板开到窗口外只露出「文本颜色」标题，看起来像坏掉的 tooltip。
  const nearBottom = trigger.bottom > viewportHeight * 0.55;
  const showAbove =
    forceShowAbove ??
    (nearBottom
      ? spaceAbove >= Math.min(needed, spaceBelow + 1) ||
        spaceAbove > spaceBelow
      : spaceAbove >= needed ||
        (spaceBelow < needed && spaceAbove > spaceBelow));
  const halfWidth = panelWidth / 2;
  const preferredLeft = trigger.left + trigger.width / 2;
  const minLeft = padding + halfWidth;
  const maxLeft = viewportWidth - padding - halfWidth;

  return {
    top: showAbove ? trigger.top - gap : trigger.bottom + gap,
    left:
      minLeft <= maxLeft
        ? Math.min(Math.max(preferredLeft, minLeft), maxLeft)
        : viewportWidth / 2,
    showAbove,
  };
}

function readEditorUiScale(): number {
  const scale = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--editor-ui-scale",
    ),
  );
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function measureColorPanelPosition(
  button: HTMLElement,
  panel: HTMLElement | null,
  forceShowAbove?: boolean,
): PositionState {
  const scale = readEditorUiScale();
  return getColorPanelPosition({
    trigger: button.getBoundingClientRect(),
    panelWidth: panel?.offsetWidth ?? PANEL_BASE_WIDTH * scale,
    panelHeight: panel?.offsetHeight ?? PANEL_BASE_HEIGHT * scale,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight,
    gap: 8 * scale,
    forceShowAbove,
  });
}
