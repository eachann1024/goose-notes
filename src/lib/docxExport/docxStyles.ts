import {
  AlignmentType,
  ExternalHyperlink,
  ShadingType,
  TextRun,
  UnderlineType,
  type IRunOptions,
} from "docx";
import { pageMentionLabel } from "@/components/editor/inline/pageMention";
import { stripEditorObjectReplacementCharacters } from "@/lib/imageExport/serializer/utils";
import type { CustomFonts } from "@/stores/useSettings";
import { getEditorFontFamilies } from "@/lib/fontLoader";
import {
  DOCX_BACKGROUND_COLORS,
  DOCX_BODY_SIZE,
  DOCX_CODE_SIZE,
  DOCX_COLORS,
  DOCX_TEXT_COLORS,
  hexNoHash,
  resolveNamedColor,
} from "./docxTheme";

export type DocxFontConfig = {
  body: string;
  eastAsia: string;
  mono: string;
};

const GENERIC_FONTS = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
]);

function firstNamedFont(families: string[], fallback: string): string {
  for (const family of families) {
    const name = family.replace(/^["']+|["']+$/g, "").trim();
    if (name && !GENERIC_FONTS.has(name)) return name;
  }
  return fallback;
}

function platformEastAsiaFallback(
  kind: "default" | "serif" | "mono",
): string {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform || "" : "";
  const isMac = /Mac|iPod|iPhone|iPad/.test(platform);
  if (kind === "serif") return isMac ? "Songti SC" : "SimSun";
  if (kind === "mono") return isMac ? "Menlo" : "Consolas";
  return isMac ? "PingFang SC" : "Microsoft YaHei";
}

export function resolveDocxFonts(
  fontFamily: "default" | "serif" | "mono" | undefined,
  customFonts: CustomFonts,
): DocxFontConfig {
  const kind = fontFamily ?? "default";
  const families = getEditorFontFamilies(kind, customFonts);
  const eastAsia = firstNamedFont(families, platformEastAsiaFallback(kind));
  const monoFamilies = getEditorFontFamilies("mono", customFonts);
  return {
    body: eastAsia,
    eastAsia,
    mono: firstNamedFont(monoFamilies, "Courier New"),
  };
}

export function runFont(name: string): IRunOptions["font"] {
  return {
    ascii: name,
    hAnsi: name,
    eastAsia: name,
    cs: name,
  };
}

export function alignmentFromBlock(
  value: unknown,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (value === "center") return AlignmentType.CENTER;
  if (value === "right") return AlignmentType.RIGHT;
  if (value === "justify") return AlignmentType.BOTH;
  if (value === "left") return AlignmentType.LEFT;
  return undefined;
}

function shadingFill(hex: string) {
  return { type: ShadingType.CLEAR, fill: hexNoHash(hex) };
}

export type InlineRunDefaults = {
  size?: number;
  bold?: boolean;
  italics?: boolean;
  color?: string;
  underline?: boolean;
  strike?: boolean;
};

function runFromText(
  text: string,
  styles: Record<string, unknown> | undefined,
  font: DocxFontConfig,
  defaults?: InlineRunDefaults,
): TextRun | null {
  const cleaned = stripEditorObjectReplacementCharacters(text);
  if (!cleaned) return null;
  const isCode = Boolean(styles?.code);
  const color =
    resolveNamedColor(styles?.textColor, DOCX_TEXT_COLORS) ||
    (isCode ? DOCX_COLORS.inlineCodeFg : defaults?.color);
  const background =
    resolveNamedColor(styles?.backgroundColor, DOCX_BACKGROUND_COLORS) ||
    (isCode ? DOCX_COLORS.inlineCodeBg : undefined);

  return new TextRun({
    text: cleaned,
    font: runFont(isCode ? font.mono : font.body),
    size: isCode ? DOCX_CODE_SIZE : defaults?.size ?? DOCX_BODY_SIZE,
    bold: Boolean(styles?.bold) || Boolean(defaults?.bold),
    italics: Boolean(styles?.italic) || Boolean(defaults?.italics),
    strike: Boolean(styles?.strike) || Boolean(defaults?.strike),
    ...(styles?.underline || defaults?.underline
      ? { underline: { type: UnderlineType.SINGLE } }
      : {}),
    ...(color ? { color } : {}),
    ...(background ? { shading: shadingFill(background) } : {}),
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function linkHref(item: Record<string, unknown>): string {
  if (typeof item.href === "string" && item.href) return item.href;
  const marks = Array.isArray(item.marks) ? item.marks : [];
  for (const mark of marks) {
    const rec = asRecord(mark);
    if (rec?.type === "link") {
      const attrs = asRecord(rec.attrs);
      if (typeof attrs?.href === "string") return attrs.href;
    }
  }
  return "";
}

export function inlineContentToChildren(
  content: unknown,
  font: DocxFontConfig,
  defaults?: InlineRunDefaults,
): Array<TextRun | ExternalHyperlink> {
  if (typeof content === "string") {
    const run = runFromText(content, undefined, font, defaults);
    return run ? [run] : [];
  }
  if (!Array.isArray(content)) return [];

  const children: Array<TextRun | ExternalHyperlink> = [];
  for (const raw of content) {
    if (typeof raw === "string") {
      const run = runFromText(raw, undefined, font, defaults);
      if (run) children.push(run);
      continue;
    }
    const item = asRecord(raw);
    if (!item) continue;

    if (item.type === "hardBreak") {
      children.push(new TextRun({ break: 1 }));
      continue;
    }

    if (item.type === "pageMention") {
      const label = pageMentionLabel({
        title:
          typeof (item.props as { title?: string } | undefined)?.title ===
          "string"
            ? (item.props as { title: string }).title
            : "",
      });
      children.push(
        new TextRun({
          text: label,
          font: runFont(font.body),
          color: DOCX_COLORS.mention,
          size: defaults?.size ?? DOCX_BODY_SIZE,
        }),
      );
      continue;
    }

    if (item.type === "link" || linkHref(item)) {
      const href = linkHref(item);
      const nested = Array.isArray(item.content)
        ? inlineContentToChildren(item.content, font, {
            ...defaults,
            color: defaults?.color || DOCX_COLORS.text,
            underline: true,
          })
        : inlineContentToChildren(
            [{ type: "text", text: item.text || href, styles: item.styles }],
            font,
            { ...defaults, underline: true },
          );
      if (href) {
        children.push(
          new ExternalHyperlink({
            link: href,
            children:
              nested.length > 0
                ? nested
                : [
                    new TextRun({
                      text: href,
                      underline: { type: UnderlineType.SINGLE },
                      font: runFont(font.body),
                      size: defaults?.size ?? DOCX_BODY_SIZE,
                    }),
                  ],
          }),
        );
      } else {
        children.push(...nested);
      }
      continue;
    }

    const text = typeof item.text === "string" ? item.text : "";
    const styles = {
      ...(asRecord(item.styles) ?? {}),
    };
    const marks = Array.isArray(item.marks) ? item.marks : [];
    for (const mark of marks) {
      const rec = asRecord(mark);
      if (!rec) continue;
      if (rec.type === "bold") styles.bold = true;
      if (rec.type === "italic") styles.italic = true;
      if (rec.type === "strike") styles.strike = true;
      if (rec.type === "underline") styles.underline = true;
      if (rec.type === "code") styles.code = true;
      if (rec.type === "textStyle") {
        const attrs = asRecord(rec.attrs);
        if (typeof attrs?.color === "string") styles.textColor = attrs.color;
      }
      if (rec.type === "highlight") styles.backgroundColor = "yellow";
    }
    const run = runFromText(text, styles, font, defaults);
    if (run) children.push(run);
  }
  return children;
}

export function emptyRun(font: DocxFontConfig): TextRun {
  return new TextRun({ text: "", font: runFont(font.body), size: DOCX_BODY_SIZE });
}

export { UnderlineType };
