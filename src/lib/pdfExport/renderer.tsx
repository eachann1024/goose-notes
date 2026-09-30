import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import { PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY } from "./fontConfig";

// Structural input accepts saved documents without depending on an editor instance.
export type PdfBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: PdfBlock[];
};
export type PdfContext = {
  transformInlineContent: (content: unknown) => ReactNode;
};
export type PdfBlockMapping = (
  block: PdfBlock,
  context: PdfContext,
  depth: number,
  ordinal?: number,
) => ReactNode | Promise<ReactNode>;

const colors: Record<string, [string, string]> = {
  gray: ["#6b7280", "#f3f4f6"],
  brown: ["#92400e", "#f5ebe0"],
  red: ["#dc2626", "#fee2e2"],
  orange: ["#ea580c", "#ffedd5"],
  yellow: ["#a16207", "#fef9c3"],
  green: ["#15803d", "#dcfce7"],
  blue: ["#2563eb", "#dbeafe"],
  purple: ["#9333ea", "#f3e8ff"],
  pink: ["#db2777", "#fce7f3"],
};
export function pdfColor(
  value: unknown,
  background = false,
): string | undefined {
  if (typeof value !== "string" || value === "default") return undefined;
  if (colors[value]) return colors[value][background ? 1 : 0];
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
export function renderPdfInline(content: unknown): ReactNode {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  return content.map((item, index) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return null;
    if (item.type === "hardBreak") return "\n";
    if (item.type === "pageMention") {
      const title =
        typeof item.props?.title === "string" && item.props.title.trim()
          ? item.props.title.trim()
          : "未命名";
      return (
        <Text key={index}>{title.startsWith("@") ? title : `@${title}`}</Text>
      );
    }
    if (item.type === "link") {
      const label = renderPdfInline(item.content);
      return typeof item.href === "string" &&
        /^(https?:|mailto:|tel:|#)/i.test(item.href) ? (
        <Link key={index} src={item.href}>
          {label}
        </Link>
      ) : (
        <Text key={index}>{label}</Text>
      );
    }
    const styles = item.styles ?? {};
    const style: Style = {
      fontWeight: styles.bold ? 700 : undefined,
      fontStyle: styles.italic ? "italic" : undefined,
      textDecoration:
        styles.underline && styles.strike
          ? "underline line-through"
          : styles.underline
            ? "underline"
            : styles.strike
              ? "line-through"
              : undefined,
      color: pdfColor(styles.textColor),
      backgroundColor:
        pdfColor(styles.backgroundColor, true) ??
        (styles.code ? "#f3f4f6" : undefined),
      fontFamily: styles.code
        ? [PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY]
        : undefined,
    };
    return (
      <Text key={index} style={style}>
        {typeof item.text === "string"
          ? item.text
          : renderPdfInline(item.content)}
      </Text>
    );
  });
}

// Break long tokens in narrow cells while retaining the original saved text.
export const splitPdfWord = (word: string): string[] => Array.from(word);

export function tableColumnPercentages(
  widths: unknown[],
  count: number,
): number[] {
  const valid = widths.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0,
  );
  const fallback = valid.length
    ? valid.reduce((sum, n) => sum + n, 0) / valid.length
    : 1;
  const weights = Array.from({ length: count }, (_, i) => {
    const n = widths[i];
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;
  });
  const total = weights.reduce((sum, n) => sum + n, 0);
  return weights.map((n) => (n / total) * 100);
}

export function createDefaultPdfBlockMappings(): Record<
  string,
  PdfBlockMapping
> {
  const paragraph: PdfBlockMapping = (block, context) => (
    <Text style={blockTextStyle(block.props)}>
      {context.transformInlineContent(block.content) || " "}
    </Text>
  );
  const list: PdfBlockMapping = (block, context, _depth, ordinal) => (
    <View style={{ flexDirection: "row" }}>
      <Text style={{ width: 32, flexShrink: 0 }}>
        {block.type === "numberedListItem"
          ? `${ordinal ?? 1}.`
          : block.type === "checkListItem"
            ? block.props?.checked
              ? "[x]"
              : "[ ]"
            : "•"}
      </Text>
      <Text
        style={{
          ...blockTextStyle(block.props),
          flexGrow: 1,
          flexBasis: 0,
          minWidth: 0,
        }}
      >
        {context.transformInlineContent(block.content) || " "}
      </Text>
    </View>
  );
  return {
    paragraph,
    bulletListItem: list,
    numberedListItem: list,
    checkListItem: list,
    toggleListItem: list,
    heading: (block, context) => (
      <Text
        minPresenceAhead={24}
        style={{
          ...blockTextStyle(block.props),
          fontWeight: 700,
          lineHeight: 1.4,
          marginBottom: 4,
          fontSize: [24, 20, 17, 15, 13, 12][
            Math.max(0, Math.min(5, Number(block.props?.level || 1) - 1))
          ],
          marginTop: 8,
        }}
      >
        {block.props?.isToggleable ? "▾ " : ""}
        {context.transformInlineContent(block.content)}
      </Text>
    ),
    codeBlock: (block, context) => (
      <View style={{ padding: 9, backgroundColor: "#f5f5f5", borderRadius: 4 }}>
        <Text
          hyphenationCallback={splitPdfWord}
          style={{
            fontFamily: [PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY],
            fontSize: 11,
          }}
        >
          {context.transformInlineContent(block.content) || " "}
        </Text>
      </View>
    ),
    divider: () => (
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "#d1d5db",
          marginVertical: 6,
        }}
      />
    ),
    quote: (block, context) => (
      <View
        style={{
          borderLeftWidth: 3,
          borderLeftColor: "#9ca3af",
          paddingLeft: 10,
        }}
      >
        {paragraph(block, context, 0) as ReactNode}
      </View>
    ),
    table: (block, context) => {
      const table = block.content as
        | {
            rows?: { cells: unknown[] }[];
            columnWidths?: unknown[];
            headerRows?: number;
            headerCols?: number;
          }
        | undefined;
      const rows = table?.rows ?? [];
      const span = (cell: unknown) =>
        Math.max(
          1,
          Math.floor(
            Number(
              (cell as { props?: { colspan?: number } })?.props?.colspan,
            ) || 1,
          ),
        );
      const count = Math.max(
        0,
        ...rows.map((row) =>
          row.cells.reduce<number>((n, cell) => n + span(cell), 0),
        ),
      );
      const widths = tableColumnPercentages(table?.columnWidths ?? [], count);
      return (
        <View>
          {rows.map((row, rowIndex) => {
            let column = 0;
            return (
              <View key={rowIndex} style={{ flexDirection: "row" }}>
                {row.cells.map((cell, cellIndex) => {
                  const value = cell as {
                    content?: unknown;
                    props?: Record<string, unknown>;
                  };
                  const header =
                    rowIndex < (table?.headerRows ?? 0) ||
                    column < (table?.headerCols ?? 0);
                  const width = widths
                    .slice(column, column + span(cell))
                    .reduce((sum, n) => sum + n, 0);
                  column += span(cell);
                  return (
                    <View
                      key={cellIndex}
                      style={{
                        width: `${width}%`,
                        flexShrink: 0,
                        minWidth: 0,
                        borderWidth: 0.5,
                        borderColor: "#d1d5db",
                        padding: 5,
                        backgroundColor:
                          pdfColor(value?.props?.backgroundColor, true) ??
                          (header ? "#f3f4f6" : undefined),
                      }}
                    >
                      <Text
                        hyphenationCallback={splitPdfWord}
                        style={{
                          ...blockTextStyle(value?.props),
                          fontSize: 10,
                          fontWeight: header ? 700 : 400,
                        }}
                      >
                        {context.transformInlineContent(
                          Array.isArray(cell) ? cell : value?.content,
                        ) || " "}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      );
    },
  };
}

export async function createPdfDocument(
  blocks: readonly PdfBlock[],
  mappings: Record<string, PdfBlockMapping>,
  fontFamily: string | string[],
) {
  const context: PdfContext = { transformInlineContent: renderPdfInline };
  async function renderBlocks(
    items: readonly PdfBlock[],
    depth: number,
  ): Promise<ReactNode[]> {
    const result: ReactNode[] = [];
    let ordinal = 0;
    for (const [index, block] of items.entries()) {
      if (block.type === "numberedListItem") {
        const start = block.props?.start;
        ordinal =
          typeof start === "number" && Number.isFinite(start)
            ? start
            : ordinal + 1;
      } else ordinal = 0;
      const mapping = mappings[block.type ?? "paragraph"] ?? mappings.paragraph;
      result.push(
        <View key={block.id ?? index} style={{ marginBottom: 6 }}>
          {await mapping(block, context, depth, ordinal)}
          {block.children?.length ? (
            <View style={{ marginLeft: 18, marginTop: 4 }}>
              {await renderBlocks(block.children, depth + 1)}
            </View>
          ) : null}
        </View>,
      );
    }
    return result;
  }
  return (
    <Document>
      <Page
        size="A4"
        style={{
          padding: 36,
          fontFamily,
          fontSize: 12,
          lineHeight: 1.5,
          color: "#111827",
        }}
      >
        {await renderBlocks(blocks, 0)}
      </Page>
    </Document>
  );
}
