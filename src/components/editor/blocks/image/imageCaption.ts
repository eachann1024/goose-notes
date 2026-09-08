export function isGeneratedDataImageName(value: unknown, url: unknown): boolean {
  if (typeof value !== "string" || typeof url !== "string") return false;
  if (!/^data:image\//i.test(url)) return false;
  return /^image(?:[-_ ]?\d+| \(\d+\))?\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(
    value.trim(),
  );
}

/**
 * BlockNote 会把 figure 的 figcaption 直接写回 props.caption。浏览器复制的
 * data URL 若携带 image.png 这类默认名，不能把它当作用户说明；文件名仍存
 * 在 name，供 img alt 使用。此处只归一粘贴解析结果，不改用户既有笔记。
 */
export function normalizeParsedImageProps(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  if (!isGeneratedDataImageName(parsed.caption, parsed.url)) return parsed;
  const caption = String(parsed.caption).trim();
  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  return { ...parsed, name: name || caption, caption: "" };
}
