const CODE_BLOCK_META_PREFIX = "goose-note=";

export function isLegacyCodeBlockMetaComment(line: string): boolean {
  return /^<!--\s*goose-note:codeblock\s+.+?\s*-->$/.test(line);
}

function normalizeCodeBlockSummary(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function parseCodeFenceInfo(infoLine: string): {
  language: string;
  summary: string;
  collapsed: boolean;
} {
  const tokens = infoLine.trim().split(/\s+/).filter(Boolean);
  let language = "";
  let summary = "";
  let collapsed = false;

  for (const token of tokens) {
    if (token.startsWith(CODE_BLOCK_META_PREFIX)) {
      const encoded = token.slice(CODE_BLOCK_META_PREFIX.length);
      if (!encoded) continue;

      try {
        const parsed = JSON.parse(decodeURIComponent(encoded));
        if (parsed && typeof parsed === "object") {
          const candidateSummary = normalizeCodeBlockSummary(
            (parsed as Record<string, unknown>).summary,
          );
          if (candidateSummary) {
            summary = candidateSummary;
          }
          if ((parsed as Record<string, unknown>).collapsed === true) {
            collapsed = true;
          }
        }
      } catch {}
      continue;
    }

    if (!language) {
      language = token;
    }
  }

  return {
    language,
    summary,
    collapsed,
  };
}

/**
 * 解析 GFM 表格 → BlockNote table 块格式：
 * { type: "table", content: { type: "tableContent", rows: [{ cells: [InlineContent[]] }] } }
 *
 * 直接输出 BlockNote 运行时格式（而非 TipTap tableRow 节点），使 normalizeBlocks
 * 直通后编辑器可直接加载，序列化侧统一走 rows/cells 读取。首行为表头（GFM 约定）。
 */
export function parseTableBlock(
  lines: string[],
  i: number,
  parseInline: (text: string) => any[],
): { block: any; nextIndex: number } | null {
  const isTableSeparator = (value: string) => {
    const v = value.trim();
    return /^\|?(\s*:?-+:?\s*\|?)+$/.test(v) && v.includes("-");
  };

  const splitTableRow = (value: string) => {
    const trimmed = value.trim();
    const content = trimmed.replace(/^\|/, "").replace(/\|$/, "");
    return content.split("|").map((cell: any) => cell.trim());
  };

  const line = lines[i];
  if (
    line.includes("|") &&
    i + 1 < lines.length &&
    isTableSeparator(lines[i + 1])
  ) {
    const headerCells = splitTableRow(line);
    let index = i + 2;

    const bodyRows: string[][] = [];
    while (index < lines.length && lines[index].trim().includes("|")) {
      if (isTableSeparator(lines[index])) {
        index++;
        continue;
      }
      bodyRows.push(splitTableRow(lines[index]));
      index++;
    }

    const toCellContent = (text: string) => parseInline(text.replace(/\\\|/g, "|"));

    return {
      block: {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            { cells: headerCells.map(toCellContent) },
            ...bodyRows.map((row) => ({ cells: row.map(toCellContent) })),
          ],
        },
      },
      nextIndex: index,
    };
  }

  return null;
}
