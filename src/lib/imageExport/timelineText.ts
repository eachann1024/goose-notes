export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function charWidth(ch: string, fontSize: number): number {
  return /[\u0020-\u007e]/.test(ch) ? fontSize * 0.58 : fontSize;
}

export function measure(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch, fontSize);
  return width;
}

export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  if (measure(trimmed, fontSize) <= maxWidth) return [trimmed];

  const lines: string[] = [];
  let rest = trimmed;
  while (rest.length > 0) {
    if (measure(rest, fontSize) <= maxWidth) {
      lines.push(rest);
      break;
    }
    let lo = 1;
    let hi = rest.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure(rest.slice(0, mid), fontSize) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    let cut = Math.max(1, lo);
    const slice = rest.slice(0, cut);
    const breakAt = Math.max(
      slice.lastIndexOf(" "),
      slice.lastIndexOf("，"),
      slice.lastIndexOf("、"),
      slice.lastIndexOf("："),
      slice.lastIndexOf("（"),
      slice.lastIndexOf("/"),
      slice.lastIndexOf(";"),
      slice.lastIndexOf(","),
    );
    if (breakAt >= Math.floor(cut * 0.4)) cut = breakAt + 1;
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  return lines;
}
