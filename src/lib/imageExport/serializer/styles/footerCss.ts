import { TEXT_COLORS } from "@/lib/textColors";
import type { CardTheme } from "../../themes";

/** 在深浅两种墨色中选择与背景对比度更高的一种。 */
function getContrastingInk(color: string): "#0a0a0a" | "#ffffff" {
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  let r: number;
  let g: number;
  let b: number;
  if (short) {
    r = parseInt(short[1][0] + short[1][0], 16);
    g = parseInt(short[1][1] + short[1][1], 16);
    b = parseInt(short[1][2] + short[1][2], 16);
  } else if (full) {
    r = parseInt(full[1].slice(0, 2), 16);
    g = parseInt(full[1].slice(2, 4), 16);
    b = parseInt(full[1].slice(4, 6), 16);
  } else if (/^rgba?\(/i.test(hex)) {
    const nums = hex
      .replace(/rgba?\(/i, "")
      .replace(/\)/, "")
      .split(",")
      .map((p) => parseFloat(p.trim()));
    if (nums.length < 3 || nums.some((n) => !Number.isFinite(n))) {
      return "#ffffff";
    }
    r = nums[0];
    g = nums[1];
    b = nums[2];
  } else {
    return "#ffffff";
  }
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  const darkContrast = (luminance + 0.05) / 0.053;
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? "#0a0a0a" : "#ffffff";
}

export function buildFooterCss(t: CardTheme): string {
  const checkMarkColor = getContrastingInk(t.accent);
  return `.gooseshot-watermark {
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid ${t.divider};
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.gooseshot-watermark-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gooseshot-watermark-icon { font-size: 16px; line-height: 1; }
.gooseshot-watermark-brand {
  color: ${t.watermark};
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.gooseshot-watermark-date {
  color: ${t.watermark};
  font-size: 11px;
  font-weight: 400;
}
.gooseshot-content strong { font-weight: 600; }
.gooseshot-content em { font-style: italic; }
.gooseshot-content del { text-decoration: line-through; }
.gooseshot-content a {
  color: ${TEXT_COLORS[t.mode].info};
  text-decoration: none;
}
.gooseshot-content a:hover { text-decoration: underline; }
.gooseshot-content .task-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  margin-bottom: 0.35em;
  line-height: ${t.bodyLineHeight};
  font-size: ${t.bodyFontSize}px;
  color: ${t.textColor};
  break-inside: avoid;
}
.gooseshot-content .task-checkbox-wrap {
  height: ${t.bodyLineHeight}em;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.gooseshot-content .task-checkbox {
  width: 1em;
  height: 1em;
  border: 1.5px solid currentColor;
  background: transparent;
  border-radius: 0.22em;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.gooseshot-content .task-checkbox.checked {
  background: ${t.accent};
  border-color: ${t.accent};
}
.gooseshot-content .task-checkbox.checked::after {
  content: '✓';
  color: ${checkMarkColor};
  font-size: 0.72em;
  line-height: 1;
  font-weight: 700;
}
.gooseshot-content .task-item.checked .task-text {
  color: ${t.secondaryText};
  text-decoration: none;
}
.gooseshot-content .task-text {
  flex: 1;
  min-width: 0;
  line-height: ${t.bodyLineHeight};
}
`;
}
