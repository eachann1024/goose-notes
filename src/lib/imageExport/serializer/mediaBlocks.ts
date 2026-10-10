import type { CardTheme } from "../themes";
import { isGeneratedDataImageName } from "@/components/editor/blocks/image/imageCaption";
import { escapeHtml } from "./utils";

function looksLikeImageUrl(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:image/")) return true;
  const path = src.split("?")[0].split("#")[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(path);
}

function imageTextProp(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getImageTextForExport(props: Record<string, unknown>, src: string) {
  const rawCaption = imageTextProp(props.caption) || imageTextProp(props.alt);
  const name = imageTextProp(props.name);
  const caption = isGeneratedDataImageName(rawCaption, src) ? "" : rawCaption;
  // BlockNote 的 name 才是图片替代文本来源。即使是剪贴板默认文件名也继续
  // 留在 alt 上；只是不把它升级为用户可见的 figcaption。
  const alt = name || caption;
  return { caption, alt };
}


export function renderMediaBlock(block: any, theme: CardTheme, styleAttr: string): string {
  switch (block.type) {
    case "image":
    case "imageResize": {
      const src = block.props?.url || block.props?.src || "";
      const { caption, alt } = getImageTextForExport(block.props ?? {}, src);
      if (!src) {
        return caption
          ? `<p class="media-fallback"${styleAttr}>${escapeHtml(caption)}</p>`
          : "";
      }
      const alignment = block.props?.textAlignment || block.props?.alignment;
      const imgAlignStyle =
        alignment === "center"
          ? "display:block;margin-left:auto;margin-right:auto;"
          : alignment === "right"
            ? "display:block;margin-left:auto;"
            : "";
      const previewWidth = Number(block.props?.previewWidth ?? block.props?.width);
      const widthStyle =
        Number.isFinite(previewWidth) && previewWidth > 0
          ? `max-width:${previewWidth}px;`
          : "";
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${imgAlignStyle}${widthStyle}" />`;
      if (caption) {
        return `<figure class="export-figure"${styleAttr}>${img}<figcaption>${escapeHtml(caption)}</figcaption></figure>`;
      }
      return img;
    }

    case "file": {
      const src = block.props?.url || block.props?.src || "";
      const name = block.props?.name || block.props?.caption || "附件";
      const caption = block.props?.caption || "";
      if (src && looksLikeImageUrl(src)) {
        const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(caption || name)}" />`;
        if (caption || name) {
          return `<figure class="export-figure"${styleAttr}>${img}<figcaption>${escapeHtml(caption || name)}</figcaption></figure>`;
        }
        return img;
      }
      const nameHtml = src
        ? `<a class="file-name" href="${escapeHtml(src)}">${escapeHtml(name)}</a>`
        : `<span class="file-name">${escapeHtml(name)}</span>`;
      const capHtml =
        caption && caption !== name
          ? `<div class="file-caption">${escapeHtml(caption)}</div>`
          : "";
      return `<div class="file-card"${styleAttr}><span class="file-icon">📎</span><div class="file-body">${nameHtml}${capHtml}</div></div>`;
    }

    case "video": {
      const src = block.props?.url || block.props?.src || "";
      const name = block.props?.name || block.props?.caption || "视频";
      if (!src) {
        return `<p class="media-fallback"${styleAttr}>▶ ${escapeHtml(name)}</p>`;
      }
      return `<p class="media-fallback"${styleAttr}><a href="${escapeHtml(src)}">▶ ${escapeHtml(name)}</a></p>`;
    }

    case "audio": {
      const src = block.props?.url || block.props?.src || "";
      const name = block.props?.name || block.props?.caption || "音频";
      if (!src) {
        return `<p class="media-fallback"${styleAttr}>♪ ${escapeHtml(name)}</p>`;
      }
      return `<p class="media-fallback"${styleAttr}><a href="${escapeHtml(src)}">♪ ${escapeHtml(name)}</a></p>`;
    }

    default: return "";
  }
}
