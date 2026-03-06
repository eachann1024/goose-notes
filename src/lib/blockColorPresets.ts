export type BlockBgColorValue =
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red";

export const BLOCK_BG_COLORS = [
  { label: "默认", value: null, css: "transparent", border: true },
  { label: "灰色背景", value: "gray", css: "#F1F1EF" },
  { label: "棕色背景", value: "brown", css: "#F4EEEE" },
  { label: "橙色背景", value: "orange", css: "#FDEECE" },
  { label: "黄色背景", value: "yellow", css: "#FBF3DB" },
  { label: "绿色背景", value: "green", css: "#EDF3EC" },
  { label: "蓝色背景", value: "blue", css: "#E7F3F8" },
  { label: "紫色背景", value: "purple", css: "#F4F0F8" },
  { label: "粉红背景", value: "pink", css: "#FAF0F5" },
  { label: "红色背景", value: "red", css: "#FDEBEC" },
] as const;

const CALLOUT_BG_COLOR_CANDIDATES = BLOCK_BG_COLORS
  .map((item) => item.value)
  .filter((value): value is BlockBgColorValue => value !== null);

let lastPickedBlockBgColor: BlockBgColorValue | null = null;

export function getRandomBlockAccentColor(): BlockBgColorValue {
  const availableColors =
    lastPickedBlockBgColor && CALLOUT_BG_COLOR_CANDIDATES.length > 1
      ? CALLOUT_BG_COLOR_CANDIDATES.filter(
          (color) => color !== lastPickedBlockBgColor,
        )
      : CALLOUT_BG_COLOR_CANDIDATES;

  const index = Math.floor(Math.random() * availableColors.length);
  const nextColor = availableColors[index];
  lastPickedBlockBgColor = nextColor;
  return nextColor;
}

export function getRandomBlockColorPair() {
  const color = getRandomBlockAccentColor();
  return {
    blockTextColor: color,
    blockBgColor: color,
  };
}
