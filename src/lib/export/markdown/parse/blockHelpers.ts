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

export function alignToContainerStyle(align: "left" | "center" | "right"): string {
  const marginMap = {
    left: "margin: 0 auto 0 0;",
    center: "margin: 0 auto;",
    right: "margin: 0 0 0 auto;",
  };
  return marginMap[align];
}

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

    const toCell = (text: string, type: "tableHeader" | "tableCell") => ({
      type: "tableCell",
      attrs: { ...((type === "tableHeader" && { isHeader: true }) || {}) },
      content: [
        {
          type: "paragraph",
          content: parseInline(text.replace(/\\\|/g, "|")),
        },
      ],
    });

    const headerRow = {
      type: "tableRow",
      content: headerCells.map((cell: any) => toCell(cell, "tableHeader")),
    };

    const bodyRowNodes = bodyRows.map((row: any) => ({
      type: "tableRow",
      content: row.map((cell: any) => toCell(cell, "tableCell")),
    }));

    return {
      block: {
        type: "table",
        content: [headerRow, ...bodyRowNodes],
      },
      nextIndex: index,
    };
  }

  return null;
}
