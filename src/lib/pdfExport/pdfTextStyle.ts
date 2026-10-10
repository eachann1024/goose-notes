import { documentTextColors } from "@/lib/textColors";
import type { Style } from "@react-pdf/types";

const textColors = documentTextColors("light");
const backgroundColors: Record<string, string> = {
  gray: "#f3f4f6",
  brown: "#f5ebe0",
  red: "#fee2e2",
  orange: "#ffedd5",
  yellow: "#fef9c3",
  green: "#dcfce7",
  blue: "#dbeafe",
  purple: "#f3e8ff",
  pink: "#fce7f3",
};
export function pdfColor(
  value: unknown,
  background = false,
): string | undefined {
  if (typeof value !== "string" || value === "default") return undefined;
  const palette = background ? backgroundColors : textColors;
  if (palette[value]) return palette[value];
  return /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|black|white|transparent)$/i.test(
    value,
  )
    ? value
    : undefined;
}
export function blockTextStyle(props: Record<string, unknown> = {}): Style {
  const align = props.textAlignment;
  return {
    color: pdfColor(props.textColor),
    backgroundColor: pdfColor(props.backgroundColor, true),
    textAlign:
      align === "center" || align === "right" || align === "justify"
        ? align
        : "left",
  };
}

// Break long tokens in narrow cells while retaining the original saved text.
export const splitPdfWord = (word: string): string[] => Array.from(word);
