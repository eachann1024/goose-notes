import type { Page } from "@/types";
import type { CustomFonts } from "@/stores/useSettings";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { prepareExportBlocks } from "@/lib/export/prepareExportBlocks";
import { stripFirstH1 } from "@/lib/export/pageMarkdown";
import { processBlockChildren, type DocxExportContext } from "./docxBlocks";
import { emptyRun, resolveDocxFonts, runFont } from "./docxStyles";
import {
  DOCX_BODY_SIZE,
  DOCX_COLORS,
  DOCX_HEADING_SIZES,
  DOCX_LINE_SPACING,
  DOCX_PAGE_MARGIN_TWIP,
} from "./docxTheme";

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

const EMPTY_CUSTOM_FONTS: CustomFonts = {
  default: { label: null, font: null },
  serif: { label: null, font: null },
  mono: { label: null, font: null },
};

async function readExportCustomFonts(): Promise<CustomFonts> {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return EMPTY_CUSTOM_FONTS;
  }
  try {
    const { useSettings } = await import("@/stores/useSettings");
    return useSettings.getState().customFonts ?? EMPTY_CUSTOM_FONTS;
  } catch {
    return EMPTY_CUSTOM_FONTS;
  }
}

function numberingLevels(
  format: (typeof LevelFormat)[keyof typeof LevelFormat],
  textFor: (level: number) => string,
) {
  return [0, 1, 2, 3, 4, 5].map((level) => ({
    level,
    format,
    text: textFor(level),
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: {
        indent: {
          left: convertInchesToTwip(0.28 * (level + 1)),
          hanging: convertInchesToTwip(0.22),
        },
      },
    },
  }));
}

async function buildDocxDocument(page: Page): Promise<Document> {
  const customFonts = await readExportCustomFonts();
  const font = resolveDocxFonts(page.fontFamily, customFonts);
  const blocks = await prepareExportBlocks(page);
  const bodyBlocks = page.localFilePath ? blocks : stripFirstH1(blocks);
  const title = getPageTitle(page);

  const ctx: DocxExportContext = {
    font,
    pageLocalFilePath: page.localFilePath ?? null,
    numbering: { numbered: 0 },
  };
  const children = await processBlockChildren(bodyBlocks, 0, ctx);

  const titleParagraph = page.localFilePath
    ? null
    : new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 0, after: 200 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: DOCX_HEADING_SIZES[1],
            font: runFont(font.body),
            color: DOCX_COLORS.text,
          }),
        ],
      });

  return new Document({
    creator: "Goose Notes",
    title,
    styles: {
      default: {
        document: {
          run: {
            font: runFont(font.body),
            size: DOCX_BODY_SIZE,
            color: DOCX_COLORS.text,
          },
          paragraph: {
            spacing: { line: DOCX_LINE_SPACING, lineRule: "auto" },
          },
        },
      },
      paragraphStyles: [1, 2, 3, 4, 5, 6].map((level) => ({
        id: `Heading${level}`,
        name: `Heading ${level}`,
        basedOn: "Normal",
        next: "Normal",
        quickStyle: true,
        paragraph: {
          spacing: { before: 0, after: 0 },
          outlineLevel: level - 1,
        },
        run: {
          font: runFont(font.body),
          size: DOCX_HEADING_SIZES[level],
          bold: true,
          color: DOCX_COLORS.text,
        },
      })),
    },
    numbering: {
      config: [
        {
          reference: "goose-numbered-list",
          levels: numberingLevels(LevelFormat.DECIMAL, (level) => `%${level + 1}.`),
        },
        {
          reference: "goose-bullet-list",
          levels: numberingLevels(LevelFormat.BULLET, () => "•"),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: DOCX_PAGE_MARGIN_TWIP,
              right: DOCX_PAGE_MARGIN_TWIP,
              bottom: DOCX_PAGE_MARGIN_TWIP,
              left: DOCX_PAGE_MARGIN_TWIP,
            },
          },
        },
        children: [
          ...(titleParagraph ? [titleParagraph] : []),
          ...(children.length ? children : [new Paragraph({ children: [emptyRun(font)] })]),
        ],
      },
    ],
  });
}

export async function renderPageToDocxBlob(page: Page): Promise<Blob> {
  const doc = await buildDocxDocument(page);
  const blob = await Packer.toBlob(doc);
  if (!blob || blob.size < 80) {
    throw new Error("生成了空的 Word 文档");
  }
  return blob;
}

export async function generateDocxBuffer(page: Page): Promise<ArrayBuffer> {
  const blob = await renderPageToDocxBlob(page);
  return blob.arrayBuffer();
}

export async function exportToWord(page: Page) {
  const blob = await renderPageToDocxBlob(page);
  const filename = `${sanitizeFileName(getPageTitle(page) || "untitled")}.docx`;
  const { saveBlobAndReveal } = await import("@/lib/export/fileSave");
  await saveBlobAndReveal(blob, filename);
}
