/** 侧栏 pill 右缘与内容列左缘的间距（px） */
export const SIDE_MENU_CONTENT_GAP = 6;

/** 标题盒子左右外扩 8px。普通块当前行底也外扩同样距离，
 *  把手统一再左移这么多，和标题把手对齐、避免压住色条。 */
export const HEADING_SIDE_MENU_EXTRA_GAP = 8;

/**
 * 表格 tableWrapper 左侧为行把手留的 padding（BlockNote `--bn-table-handle-size`）。
 * 视觉上表格边框比内容列左缘更靠右，从格子移向侧栏会先经过这段空白。
 */
export const TABLE_SIDE_MENU_INSET = 9;

const EDITOR_SIDE_MENU_HOVER_SELECTOR = [
  ".bn-editor",
  ".bn-side-menu",
  ".bn-table-handle",
  ".bn-table-cell-handle",
  ".goose-table-handle-btn",
  ".goose-table-extend-button",
].join(", ");

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

const TABLE_SIDE_MENU_UI_SELECTOR = [
  ".bn-side-menu",
  ".bn-table-handle",
  ".bn-table-cell-handle",
  ".goose-table-handle-btn",
  ".goose-table-extend-button",
].join(", ");

/** 表格行/列把手是 portal，BlockNote 会把它们当成编辑器外并关掉 SideMenu.show */
export function isTableSideMenuUiTarget(target: EventTarget | null): boolean {
  return Boolean(
    asClosestHost(target)?.closest(TABLE_SIDE_MENU_UI_SELECTOR),
  );
}

type SideMenuCorridorRect = {
  left: number;
  top: number;
  height: number;
};

/**
 * 内容列与侧栏之间的 gutter 不属于 `.bn-editor`。表格又比 pill 高，
 * 现有 `::after` 桥只跟 pill 同高，从某一行横移会先掉 hover。
 * 用块的完整高度做几何走廊，避免侧栏先卸掉。
 */
export function isPointerInSideMenuCorridor(
  clientX: number,
  clientY: number,
  referencePos: SideMenuCorridorRect | undefined,
  gap: number,
  inset = 0,
): boolean {
  if (!referencePos || gap <= 0) return false;
  const right = referencePos.left + inset;
  const left = referencePos.left - gap;
  const top = referencePos.top;
  const bottom = referencePos.top + referencePos.height;
  return (
    clientX >= left &&
    clientX <= right &&
    clientY >= top &&
    clientY <= bottom
  );
}
