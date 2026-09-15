const GENERATED_IMAGE_NAME_RE =
  /^image(?:[-_ ]?\d+| \(\d+\))?\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/i;

/**
 * 浏览器复制位图时通常把文件名写成 image.png / image.webp / image (1).png。
 * 这不是用户填写的说明。url 仅保留兼容旧调用，判断只看文件名本身：
 * 上传后的 att: 图在 Markdown 往返里同样会带上这个默认名。
 */
export function isGeneratedDataImageName(
  value: unknown,
  _url?: unknown,
): boolean {
  if (typeof value !== "string") return false;
  return GENERATED_IMAGE_NAME_RE.test(value.trim());
}

/**
 * BlockNote 会把 figure 的 figcaption 直接写回 props.caption。剪贴板默认
 * 文件名不能当作用户说明；文件名仍存在 name，供 img alt 使用。
 */
export function normalizeParsedImageProps(
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  if (!isGeneratedDataImageName(parsed.caption, parsed.url)) return parsed;
  const caption = String(parsed.caption).trim();
  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  return { ...parsed, name: name || caption, caption: "" };
}

/** 渲染/导出时去掉可见的剪贴板默认 caption，不改动原始 block 引用（无 caption 时）。 */
export function imageBlockWithoutGeneratedCaption<T extends { props?: unknown }>(
  block: T,
): T {
  const props = block.props;
  if (!props || typeof props !== "object" || Array.isArray(props)) return block;
  const next = normalizeParsedImageProps(props as Record<string, unknown>);
  if (next === props) return block;
  return { ...block, props: next };
}
