import { Text, View } from "@react-pdf/renderer";
import type { PdfBlockMapping } from "./blockTypes";
import { pdfColor, blockTextStyle, splitPdfWord } from "./pdfTextStyle";

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

export const tablePdfMapping: PdfBlockMapping = (block, context) => {
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
    };
