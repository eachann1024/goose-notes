const RAW_BLOCK_LANGUAGE = "goose-raw-block";
const RAW_BLOCK_MARKER = "<!-- goose-note:raw-block -->";

const INLINE_HTML_ALLOWLIST = new Set([
  "details",
  "summary",
  "u",
  "sup",
  "sub",
  "span",
  "a",
  "img",
  "br",
]);

function normalizeMarkdownLineBreaks(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isHtmlCommentLine(trimmedLine: string): boolean {
  return trimmedLine.startsWith("<!--") && trimmedLine.endsWith("-->");
}

function getHtmlTagName(trimmedLine: string): string | null {
  const singleLineMatch = trimmedLine.match(/^<([a-zA-Z][\w-]*)(\s[^>]*)?>.*<\/\1>\s*$/);
  if (singleLineMatch) {
    return singleLineMatch[1].toLowerCase();
  }

  const blockMatch = trimmedLine.match(/^<([a-zA-Z][\w-]*)(\s[^>]*)?>\s*$/);
  if (!blockMatch) return null;
  if (trimmedLine.startsWith("</")) return null;
  if (trimmedLine.endsWith("/>")) return null;

  return blockMatch[1].toLowerCase();
}

function collectHtmlBlock(lines: string[], startIndex: number, tagName: string) {
  const blockLines = [lines[startIndex]];
  let index = startIndex + 1;

  const closeTagPattern = new RegExp(`^</${tagName}>\\s*$`, "i");
  while (index < lines.length) {
    const currentLine = lines[index];
    const trimmed = currentLine.trim();
    blockLines.push(currentLine);
    index += 1;

    if (closeTagPattern.test(trimmed)) break;
    if (trimmed === "") break;
  }

  return {
    nextIndex: index,
    rawBlock: blockLines.join("\n"),
  };
}

function wrapRawBlock(rawBlock: string): string {
  return [
    `\`\`\`${RAW_BLOCK_LANGUAGE}`,
    RAW_BLOCK_MARKER,
    rawBlock,
    "```",
  ].join("\n");
}

export function encodeUnsupportedMarkdownForEditor(markdown: string): string {
  const normalized = normalizeMarkdownLineBreaks(markdown);
  const lines = normalized.split("\n");
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed.startsWith("<") || isHtmlCommentLine(trimmed)) {
      output.push(line);
      index += 1;
      continue;
    }

    const tagName = getHtmlTagName(trimmed);
    if (!tagName || INLINE_HTML_ALLOWLIST.has(tagName)) {
      output.push(line);
      index += 1;
      continue;
    }

    const { rawBlock, nextIndex } = collectHtmlBlock(lines, index, tagName);
    output.push(wrapRawBlock(rawBlock));
    index = nextIndex;
  }

  return output.join("\n");
}

export function decodeUnsupportedMarkdownForDisk(markdown: string): string {
  const normalized = normalizeMarkdownLineBreaks(markdown);
  const pattern = new RegExp(
    "```" +
      RAW_BLOCK_LANGUAGE +
      "[^\\n]*\\n(?:<!--\\s*goose-note:raw-block\\s*-->\\n)?([\\s\\S]*?)\\n```",
    "g",
  );

  return normalized.replace(pattern, (_full, rawBlock: string) => rawBlock);
}
