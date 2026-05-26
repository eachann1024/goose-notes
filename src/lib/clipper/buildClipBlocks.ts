import type { PartialBlock } from "@blocknote/core";

export type ClipMetaKind = "text" | "image" | "files";

export interface ClipFileEntry {
  /** 已落盘的引用（图片走 imageStorage save 后得到的 ref，或 data URL；文件走 attachment ref 或本地路径）。*/
  url: string;
  /** 展示文件名 */
  name: string;
  /** MIME 类型（可选） */
  mimeType?: string;
  /** 文件大小（字节）（可选） */
  size?: number;
}

export interface ClipMeta {
  kind: ClipMetaKind;
  /** 文本剪藏内容（kind === "text"） */
  text?: string;
  /** 图片资源（kind === "image"） */
  image?: ClipFileEntry;
  /** 多个附件（kind === "files"） */
  files?: ClipFileEntry[];
  /** 来源 URL（浏览器剪藏时由 readCurrentBrowserUrl 提供） */
  sourceUrl?: string;
  /** 来源应用（可选，目前 preload 暂不提供） */
  sourceApp?: string;
  /** 剪藏时间戳（毫秒） */
  capturedAt: number;
}

const formatCapturedAt = (timestamp: number): string => {
  const safeDate = Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return (
    `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())} ` +
    `${pad(safeDate.getHours())}:${pad(safeDate.getMinutes())}`
  );
};

const buildSourceMetaBlocks = (meta: ClipMeta, insertMeta: boolean): PartialBlock[] => {
  if (!insertMeta) return [];
  const blocks: PartialBlock[] = [];

  if (meta.sourceUrl) {
    blocks.push({
      type: "quote",
      content: [
        { type: "text", text: "来源：", styles: {} },
        {
          type: "link",
          href: meta.sourceUrl,
          content: [{ type: "text", text: meta.sourceUrl, styles: {} }],
        },
      ],
    } as unknown as PartialBlock);
  }

  const timeText = `剪藏时间：${formatCapturedAt(meta.capturedAt)}` +
    (meta.sourceApp ? `  · 来自 ${meta.sourceApp}` : "");
  blocks.push({
    type: "paragraph",
    content: [{ type: "text", text: timeText, styles: { italic: true } }],
  } as unknown as PartialBlock);

  return blocks;
};

const buildTextBlocks = (meta: ClipMeta): PartialBlock[] => {
  const raw = (meta.text ?? "").replace(/\r\n/g, "\n");
  if (!raw.trim()) return [];

  // 按段拆分，保留多段落
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [
      {
        type: "paragraph",
        content: [{ type: "text", text: raw, styles: {} }],
      } as unknown as PartialBlock,
    ];
  }

  return paragraphs.map(
    (segment) =>
      ({
        type: "paragraph",
        content: [{ type: "text", text: segment, styles: {} }],
      }) as unknown as PartialBlock,
  );
};

const buildImageBlocks = (meta: ClipMeta): PartialBlock[] => {
  if (!meta.image?.url) return [];
  const caption = meta.image.name || "";
  return [
    {
      type: "image",
      props: { url: meta.image.url, caption },
    } as unknown as PartialBlock,
  ];
};

const buildFileBlocks = (meta: ClipMeta): PartialBlock[] => {
  const entries = meta.files ?? [];
  return entries
    .filter((entry) => entry && entry.url)
    .map(
      (entry) =>
        ({
          type: "file",
          props: {
            url: entry.url,
            name: entry.name || "未命名文件",
            caption: "",
          },
        }) as unknown as PartialBlock,
    );
};

/**
 * 把 ClipMeta 渲染成可追加到收件箱页面的 BlockNote PartialBlock[]。
 * 调用方传入 insertSourceMeta 控制是否带来源 / 时间元信息。
 */
export function buildClipBlocks(
  meta: ClipMeta,
  options: { insertSourceMeta?: boolean } = {},
): PartialBlock[] {
  const insertMeta = options.insertSourceMeta !== false;

  const headerLabelMap: Record<ClipMetaKind, string> = {
    text: "剪藏内容",
    image: "剪藏图片",
    files: "剪藏附件",
  };
  const headerLabel = headerLabelMap[meta.kind] ?? "剪藏内容";

  const contentBlocks: PartialBlock[] =
    meta.kind === "text"
      ? buildTextBlocks(meta)
      : meta.kind === "image"
        ? buildImageBlocks(meta)
        : meta.kind === "files"
          ? buildFileBlocks(meta)
          : [];

  if (contentBlocks.length === 0) return [];

  const headerBlock: PartialBlock = {
    type: "paragraph",
    content: [{ type: "text", text: headerLabel, styles: { bold: true } }],
  } as unknown as PartialBlock;

  return [headerBlock, ...contentBlocks, ...buildSourceMetaBlocks(meta, insertMeta)];
}
