import { TEXT_COLORS, HIGHLIGHT_COLORS } from "./colorPalette";

/**
 * 记忆策略：完整记住最近一次通过颜色面板「应用」的文本色 / 背景色。
 * - 点文本色：只更新 lastTextColor（含 default）
 * - 点背景色：只更新 lastBackgroundColor（含 default / 无背景）
 * - 右键色对：同时更新两者
 * - 点击 / 右键工具栏 Palette：当前不是上次颜色时复现记忆；再次操作清除颜色
 * - 两者都没有记录时 no-op
 * 使用 localStorage，跨笔记 / 重启可复用；读写对 SSR / 无 window 安全。
 */
const LAST_FORMAT_COLORS_KEY = "goose-note:last-format-colors";

const KNOWN_TEXT_COLORS = new Set(TEXT_COLORS.map((item) => item.color));
const KNOWN_BG_COLORS = new Set(HIGHLIGHT_COLORS.map((item) => item.color));

export type LastFormatColors = {
  textColor?: string;
  backgroundColor?: string;
};
export function selectionUsesLastFormatColors(
  selection: { textColor: string; backgroundColor: string },
  last: LastFormatColors,
): boolean {
  const remembered = (["textColor", "backgroundColor"] as const).filter(
    (key) => last[key] !== undefined,
  );
  return (
    remembered.length > 0 &&
    remembered.every((key) => selection[key] === last[key])
  );
}

function isKnownColor(value: unknown, known: Set<string>): value is string {
  return typeof value === "string" && known.has(value);
}

export function readLastFormatColors(): LastFormatColors {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_FORMAT_COLORS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<LastFormatColors>;
    const next: LastFormatColors = {};
    if (isKnownColor(parsed.textColor, KNOWN_TEXT_COLORS)) {
      next.textColor = parsed.textColor;
    }
    if (isKnownColor(parsed.backgroundColor, KNOWN_BG_COLORS)) {
      next.backgroundColor = parsed.backgroundColor;
    }
    return next;
  } catch {
    return {};
  }
}

export function writeLastFormatColors(patch: LastFormatColors) {
  if (typeof window === "undefined") return;
  try {
    const current = readLastFormatColors();
    const next: LastFormatColors = { ...current };
    if (isKnownColor(patch.textColor, KNOWN_TEXT_COLORS)) {
      next.textColor = patch.textColor;
    }
    if (isKnownColor(patch.backgroundColor, KNOWN_BG_COLORS)) {
      next.backgroundColor = patch.backgroundColor;
    }
    // 仅在至少有一个有效字段时写入，避免清掉已有记忆
    if (next.textColor === undefined && next.backgroundColor === undefined) {
      return;
    }
    window.localStorage.setItem(LAST_FORMAT_COLORS_KEY, JSON.stringify(next));
  } catch {
    // localStorage 不可用时静默失败，不影响颜色应用
  }
}
