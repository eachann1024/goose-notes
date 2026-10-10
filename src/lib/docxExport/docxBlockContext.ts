import { HeadingLevel, ShadingType } from "docx";
import type { DocxFontConfig } from "./docxStyles";
import { DOCX_BACKGROUND_COLORS, resolveNamedColor } from "./docxTheme";

export type DocxNumberingState = {
  numbered: number;
};

export type DocxExportContext = {
  font: DocxFontConfig;
  pageLocalFilePath?: string | null;
  numbering: DocxNumberingState;
};

export const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function blockProps(block: unknown): Record<string, unknown> {
  return asRecord(asRecord(block)?.props) ?? {};
}

export function paragraphShading(block: unknown) {
  const fill = resolveNamedColor(blockProps(block).backgroundColor, DOCX_BACKGROUND_COLORS);
  if (!fill) return undefined;
  return { type: ShadingType.CLEAR, fill };
}


export function isCheckedProp(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}
