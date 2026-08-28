/** 侧栏 pill 右缘与内容列左缘的间距（px） */
export const SIDE_MENU_CONTENT_GAP = 6;

const EDITOR_SIDE_MENU_HOVER_SELECTOR = ".bn-editor, .bn-side-menu";

/**
 * BlockNote SideMenu 会在编辑器左右约 250px 内夹住 X 并弹出把手。
 * 左右 gutter 不属于编辑器，只有指针落在内容列或已出现的把手上才显示。
 */
function asClosestHost(
  target: EventTarget | null,
): Pick<Element, "closest"> | null {
  if (typeof target !== "object" || target === null) return null;
  if ("closest" in target && typeof target.closest === "function") {
    return target as Pick<Element, "closest">;
  }
  const parent =
    "parentElement" in target
      ? (target.parentElement as Pick<Element, "closest"> | null)
      : null;
  if (parent && typeof parent.closest === "function") return parent;
  return null;
}

export function isEditorSideMenuHoverTarget(
  target: EventTarget | null,
): boolean {
  return Boolean(
    asClosestHost(target)?.closest(EDITOR_SIDE_MENU_HOVER_SELECTOR),
  );
}
