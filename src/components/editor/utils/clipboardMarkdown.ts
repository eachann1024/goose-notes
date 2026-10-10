import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root, RootContent } from "mdast";
const clipboardMarkdownParser = unified().use(remarkParse);

export function normalizeClipboardListMarkers(text: string): string {
  const offsets: number[] = [];
  const visit = (node: Root | RootContent) => {
    if (node.type === "list" && !node.ordered) {
      for (const item of node.children) {
        const offset = item.position?.start.offset;
        if (offset != null && (text[offset] === "*" || text[offset] === "+")) {
          offsets.push(offset);
        }
      }
    }
    if ("children" in node) node.children.forEach(visit);
  };
  visit(clipboardMarkdownParser.parse(text));
  for (const offset of offsets.sort((a, b) => b - a)) {
    text = text.slice(0, offset) + "-" + text.slice(offset + 1);
  }
  return text;
}

export function normalizeClipboardLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[\r\u2028\u2029\u0085]/g, "\n");
}

export function looksLikeMarkdownFragment(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  return (
    /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*[-*+]\s\[[ xX]\]\s|\s*[•·]\s|\s*\.\s)/m.test(
      value,
    ) ||
    /```/.test(value) ||
    /\|.+\|/.test(value) ||
    /(\*\*|__|~~|`[^`]+`)/.test(value) ||
    /\[([^\]]+)\]\(([^)]+)\)/.test(value) ||
    /\[\[[^\]\n]+\]\]/.test(value)
  );
}

const MERMAID_START_PATTERNS = [
  /^(?:graph|flowchart)\s+(?:TB|TD|BT|RL|LR)\b/i,
  /^sequenceDiagram\b/i,
  /^classDiagram(?:-v2)?\b/i,
  /^stateDiagram(?:-v2)?\b/i,
  /^erDiagram\b/i,
  /^journey\b/i,
  /^gantt\b/i,
  /^pie(?:\s+title\b|\b)/i,
  /^gitGraph\b/i,
  /^mindmap\b/i,
  /^timeline\b/i,
  /^quadrantChart\b/i,
  /^requirementDiagram\b/i,
  /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/,
  /^sankey-beta\b/i,
  /^xychart-beta\b/i,
  /^block-beta\b/i,
  /^packet-beta\b/i,
  /^architecture-beta\b/i,
];

export function looksLikeMermaidDiagram(text: string): boolean {
  const normalized = normalizeClipboardLineEndings(text).trim();
  if (!normalized || normalized.includes("```")) return false;

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstContentLine = lines.find(
    (line) => !line.startsWith("%%") && !/^---$/.test(line),
  );
  if (!firstContentLine) return false;
  if (
    !MERMAID_START_PATTERNS.some((pattern) => pattern.test(firstContentLine))
  ) {
    return false;
  }

  // 避免用户只粘了一个 Mermaid 声明词时误转。真实图表通常还有一行内容，
  // 或同一行已经包含标题/数据/关系语法。
  return (
    lines.length > 1 ||
    /(-->|---|==>|-.->|:\s|title\s+|accTitle\s*:|accDescr\s*:)/i.test(
      firstContentLine,
    )
  );
}

export function stripMarkdownHardBreaks(text: string): string {
  return normalizeClipboardLineEndings(text)
    .replace(/\\\n/g, "\n")
    .replace(/ {2,}\n/g, "\n")
    .replace(/\\$/g, "");
}

export function normalizeMarkdownPasteText(text: string): string {
  return stripMarkdownHardBreaks(text).replace(
    /^(\s*)(?:[•·]|\.)\s+/gm,
    "$1- ",
  );
}

export function parseMarkdownLink(
  text: string,
): { text: string; url: string } | null {
  const match = text.trim().match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (!match) return null;
  return { text: match[1], url: match[2] };
}

function stripMarkdownHardBreakArtifacts(value: string): string {
  return normalizeClipboardLineEndings(value)
    .replace(/\\\n/g, "\n")
    .replace(/ {2,}\n/g, "\n");
}

function unwrapMarkdownAutolink(value: string): string | null {
  const normalized = normalizeClipboardLineEndings(value).trim();
  const match = normalized.match(/^<([^<>\s]+)>$/);
  return match?.[1] ?? null;
}

export function shouldPreferVisibleSelectionText(
  clipboardText: string,
  selectedText: string,
  withinCodeBlock: boolean,
): boolean {
  if (!selectedText) return false;
  if (withinCodeBlock) return true;
  if (unwrapMarkdownAutolink(clipboardText) === selectedText.trim())
    return true;
  if (!clipboardText.includes("\\\n") && !clipboardText.match(/ {2,}\n/))
    return false;
  return stripMarkdownHardBreakArtifacts(clipboardText) === selectedText;
}
