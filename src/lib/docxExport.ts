import type { Page } from "@/types";
import type { BlockNoteContent } from "./blocknote-content";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, UnderlineType, convertInchesToTwip } from "docx";
import { extractTitleFromContent } from "./content-text-extractor";
import { blobToBase64 } from "./imageStorage/utils";

let imageStoragePromise: Promise<{
  imageStorage: { load: (ref: string) => Promise<Blob | null> };
}> | null = null;

const getImageStorage = async () => {
  if (!imageStoragePromise) {
    imageStoragePromise = import("./imageStorage");
  }
  return imageStoragePromise;
};

function parseBase64Image(
  src: string,
): { data: string; mimeType: string; extension: string } | null {
  const match = src.match(/^data:(image\/([a-zA-Z+]+));base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    extension: match[2] === "jpeg" ? "jpg" : match[2],
    data: match[3],
  };
}

interface InlineItem {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
  highlight?: boolean;
  color?: string;
}

function extractInlineItems(content: unknown): InlineItem[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }
  if (!Array.isArray(content)) return [];

  const items: InlineItem[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      items.push({ text: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;

    const text = item.text || "";
    const styles = item.styles || {};
    const marks = item.marks || [];

    const inline: InlineItem = { text };

    if (styles.bold) inline.bold = true;
    if (styles.italic) inline.italic = true;
    if (styles.strike) inline.strike = true;
    if (styles.code) inline.code = true;
    if (styles.color) inline.color = styles.color;
    if (styles.backgroundColor) inline.highlight = true;

    for (const mark of marks) {
      if (!mark || typeof mark !== "object") continue;
      switch (mark.type) {
        case "bold":
          inline.bold = true;
          break;
        case "italic":
          inline.italic = true;
          break;
        case "strike":
          inline.strike = true;
          break;
        case "code":
          inline.code = true;
          break;
        case "textStyle":
          if (mark.attrs?.color) inline.color = mark.attrs.color;
          break;
        case "highlight":
          inline.highlight = true;
          break;
        case "link":
          if (mark.attrs?.href) inline.link = mark.attrs.href;
          break;
      }
    }

    if (item.type === "link" && item.href) {
      inline.link = item.href;
    }

    items.push(inline);
  }
  return items;
}

function inlineToTextRuns(items: InlineItem[]): TextRun[] {
  return items.map((item) => {
    const runConfig: Record<string, unknown> = {
      text: item.text,
    };

    if (item.bold) runConfig.bold = true;
    if (item.italic) runConfig.italics = true;
    if (item.strike) runConfig.strike = true;
    if (item.code) {
      runConfig.font = "Courier New";
      runConfig.shading = {
        fill: "F2F3F5",
      };
    }
    if (item.link) {
      runConfig.style = "Hyperlink";
    }
    if (item.color) {
      runConfig.color = item.color.replace("#", "");
    }

    return new TextRun(runConfig);
  });
}

async function processBlockChildren(
  blocks: any[],
  depth: number = 0,
  imageMap: Map<string, string>,
): Promise<(Paragraph | Table)[]> {
  const result: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    const inlineItems = extractInlineItems(block.content);
    const textRuns = inlineToTextRuns(inlineItems);

    switch (block.type) {
      case "heading": {
        const level = block.props?.level || 1;
        const headingMap: Record<number, any> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
        };
        result.push(
          new Paragraph({
            heading: headingMap[level] || HeadingLevel.HEADING_1,
            children: textRuns,
            spacing: { before: 240, after: 120 },
          }),
        );
        break;
      }

      case "bulletListItem": {
        result.push(
          new Paragraph({
            children: textRuns,
            bullet: {
              level: depth,
            },
            spacing: { before: 60, after: 60 },
            indent: { left: convertInchesToTwip(0.25 * (depth + 1)) },
          }),
        );
        break;
      }

      case "numberedListItem": {
        result.push(
          new Paragraph({
            children: textRuns,
            numbering: {
              reference: "numbered-list",
              level: depth,
            },
            spacing: { before: 60, after: 60 },
            indent: { left: convertInchesToTwip(0.25 * (depth + 1)) },
          }),
        );
        break;
      }

      case "checkListItem": {
        const checked = block.props?.checked ? "☑ " : "☐ ";
        result.push(
          new Paragraph({
            children: [
              new TextRun({ text: checked, font: "Segoe UI Symbol" }),
              ...textRuns,
            ],
            spacing: { before: 60, after: 60 },
            indent: { left: convertInchesToTwip(0.25 * (depth + 1)) },
          }),
        );
        break;
      }

      case "codeBlock": {
        const codeText = block.content || "";
        const codeStr = typeof codeText === "string"
          ? codeText
          : Array.isArray(codeText)
            ? codeText.map((c: any) => (typeof c === "string" ? c : c?.text || "")).join("")
            : "";
        result.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeStr,
                font: "Courier New",
                size: 18,
              }),
            ],
            shading: {
              fill: "F5F5F5",
            },
            spacing: { before: 120, after: 120 },
            indent: { left: convertInchesToTwip(0.25) },
          }),
        );
        break;
      }

      case "quote": {
        result.push(
          new Paragraph({
            children: textRuns.map((run) => {
              const config = (run as any).options || {};
              return new TextRun({
                ...config,
                italics: true,
                color: "666666",
              });
            }),
            spacing: { before: 120, after: 120 },
            indent: { left: convertInchesToTwip(0.4) },
            border: {
              left: {
                color: "CCCCCC",
                space: 8,
                style: BorderStyle.SINGLE,
                size: 12,
              },
            },
          }),
        );
        break;
      }

      case "paragraph": {
        if (textRuns.length > 0) {
          result.push(
            new Paragraph({
              children: textRuns,
              spacing: { before: 60, after: 60 },
            }),
          );
        }
        break;
      }

      case "image":
      case "imageResize": {
        const src = block.props?.url || block.props?.src || "";
        if (src) {
          const imageResult = await resolveImageToBuffer(src, imageMap);
          if (imageResult) {
            result.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageResult.buffer.buffer.slice(
                      imageResult.buffer.byteOffset,
                      imageResult.buffer.byteOffset + imageResult.buffer.byteLength,
                    ) as ArrayBuffer,
                    transformation: {
                      width: 400,
                      height: 300,
                    },
                    type: imageResult.type as any,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
              }),
            );
          }
        }
        break;
      }

      case "table": {
        const tableResult = blockToTable(block);
        if (tableResult) result.push(tableResult);
        break;
      }

      case "divider": {
        result.push(
          new Paragraph({
            border: {
              bottom: {
                color: "CCCCCC",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { before: 120, after: 120 },
          }),
        );
        break;
      }

      case "callout": {
        const emoji = block.props?.icon || block.props?.emoji || "💡";
        result.push(
          new Paragraph({
            children: [
              new TextRun({ text: emoji + " " }),
              ...textRuns,
            ],
            shading: {
              fill: "FFF8E1",
            },
            spacing: { before: 120, after: 120 },
            indent: { left: convertInchesToTwip(0.15) },
          }),
        );
        break;
      }

      default: {
        if (textRuns.length > 0) {
          result.push(
            new Paragraph({
              children: textRuns,
              spacing: { before: 60, after: 60 },
            }),
          );
        }
      }
    }

    // Process nested children
    if (block.children?.length) {
      const childrenResult = await processBlockChildren(block.children, depth + 1, imageMap);
      result.push(...childrenResult);
    }
  }

  return result;
}

interface ImageBufferResult {
  buffer: Uint8Array;
  type: "png" | "jpg" | "gif" | "bmp";
}

function mimeToImageType(mimeType: string): ImageBufferResult["type"] {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("bmp")) return "bmp";
  return "png";
}

async function resolveImageToBuffer(
  src: string,
  imageMap: Map<string, string>,
): Promise<ImageBufferResult | null> {
  if (imageMap.has(src)) {
    const base64 = imageMap.get(src)!;
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return { buffer: bytes, type: "png" };
    } catch {
      return null;
    }
  }

  let finalSrc = src;

  if (src.startsWith("uuid:") || src.startsWith("att:")) {
    const { imageStorage } = await getImageStorage();
    const blob = await imageStorage.load(src);
    if (blob) {
      const base64Full = await blobToBase64(blob);
      finalSrc = base64Full;
    }
  }

  if (finalSrc.startsWith("data:image")) {
    const parsed = parseBase64Image(finalSrc);
    if (parsed) {
      imageMap.set(src, parsed.data);
      try {
        const binary = atob(parsed.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return { buffer: bytes, type: mimeToImageType(parsed.mimeType) };
      } catch {
        return null;
      }
    }
  }

  return null;
}

function blockToTable(block: any): Table | null {
  const rows = block.content?.rows || [];
  if (!rows.length) return null;

  const tableRows: TableRow[] = [];

  for (const row of rows) {
    const cells = row.cells || [];
    const tableCells: TableCell[] = cells.map((cell: any) => {
      const cellText = typeof cell === "string" ? cell : extractCellText(cell);
      return new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: cellText })],
          }),
        ],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
      });
    });

    tableRows.push(
      new TableRow({
        children: tableCells,
      }),
    );
  }

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function extractCellText(cell: any): string {
  if (typeof cell === "string") return cell;
  if (Array.isArray(cell)) {
    return cell.map((c: any) => {
      if (typeof c === "string") return c;
      if (c?.text) return c.text;
      return "";
    }).join("");
  }
  if (cell?.text) return cell.text;
  if (cell?.content) {
    if (typeof cell.content === "string") return cell.content;
    if (Array.isArray(cell.content)) {
      return cell.content.map((c: any) => {
        if (typeof c === "string") return c;
        if (c?.text) return c.text;
        return "";
      }).join("");
    }
  }
  return "";
}

async function buildDocxDocument(page: Page): Promise<Document> {
  const title = extractTitleFromContent(page.content);
  const content = page.content as BlockNoteContent;
  const imageMap = new Map<string, string>();

  const paragraphs = await processBlockChildren(content, 0, imageMap);

  const titleParagraph = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: title || "无标题", bold: true, size: 36 })],
    spacing: { after: 240 },
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: [titleParagraph, ...paragraphs],
      },
    ],
  });
}

export async function generateDocxBuffer(page: Page): Promise<ArrayBuffer> {
  const doc = await buildDocxDocument(page);
  const buffer = await Packer.toBuffer(doc);
  // Convert Node Buffer to ArrayBuffer
  return (buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer);
}

export async function exportToWord(page: Page) {
  const doc = await buildDocxDocument(page);
  const blob = await Packer.toBlob(doc);
  const title = extractTitleFromContent(page.content);
  const filename = `${sanitizeFileName(title || "untitled")}.docx`;
  await downloadBlob(blob, filename);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

async function downloadBlob(blob: Blob, filename: string) {
  const { saveBlobAndReveal } = await import("./export");
  await saveBlobAndReveal(blob, filename);
}
