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

// 抽出文件顶部的 YAML frontmatter（含起止 --- 行）。返回剩余 markdown body
// （跳过 frontmatter 之后的多余空行）。frontmatter 不入编辑器，保存时 prepend 回去。
export function extractFrontmatter(markdown: string): {
  frontmatter: string | null;
  body: string;
} {
  const normalized = normalizeMarkdownLineBreaks(markdown);
  const lines = normalized.split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { frontmatter: null, body: normalized };
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return { frontmatter: null, body: normalized };
  const frontmatter = lines.slice(0, endIdx + 1).join("\n");
  let bodyStart = endIdx + 1;
  while (bodyStart < lines.length && lines[bodyStart].trim() === "") {
    bodyStart += 1;
  }
  return { frontmatter, body: lines.slice(bodyStart).join("\n") };
}

// 极简 YAML tags 解析：支持 flow `tags: [a, b]` 和 block `tags:\n  - a\n  - b`
export function parseFrontmatterTags(frontmatter: string | undefined | null): string[] {
  if (!frontmatter) return [];
  const lines = frontmatter.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^tags\s*:\s*(.*)$/);
    if (!m) continue;

    const inline = m[1].trim();

    if (inline.startsWith("[") && inline.endsWith("]")) {
      const inner = inline.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }

    if (!inline) {
      const tags: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const child = lines[j];
        const cm = child.match(/^\s+-\s+(.*)$/);
        if (cm) {
          tags.push(cm[1].trim().replace(/^["']|["']$/g, ""));
          continue;
        }
        if (child.trim() === "") continue;
        if (!/^\s/.test(child)) break; // 下一个 top-level 字段或 ---
      }
      return tags;
    }

    return [inline.replace(/^["']|["']$/g, "")];
  }

  return [];
}

function serializeTag(tag: string): string {
  if (/[,\[\]"':#\s]/.test(tag)) return JSON.stringify(tag);
  return tag;
}

// 更新或插入 frontmatter 里的 tags 字段，输出统一 flow 格式。frontmatter 含 --- 边界。
// frontmatter 为空 + tags 为空 → 返回 undefined（不需要 frontmatter）
// frontmatter 为空 + tags 非空 → 创建完整 frontmatter 块
// frontmatter 存在 + tags 非空 → 替换或插入 tags 行
// frontmatter 存在 + tags 为空 → 移除 tags 行（保留其他字段）
export function setFrontmatterTags(
  frontmatter: string | undefined | null,
  tags: string[],
): string | undefined {
  const normalized = tags.map((t) => t.trim()).filter(Boolean);

  if (!frontmatter) {
    if (!normalized.length) return undefined;
    return `---\ntags: [${normalized.map(serializeTag).join(", ")}]\n---`;
  }

  const lines = frontmatter.split("\n");
  let tagsLineIdx = -1;
  let blockEndIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^tags\s*:/)) {
      tagsLineIdx = i;
      const inline = lines[i].replace(/^tags\s*:\s*/, "").trim();
      if (!inline || inline === "[]") {
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s+-/.test(lines[j]) || lines[j].trim() === "") {
            blockEndIdx = j;
          } else {
            break;
          }
        }
      }
      break;
    }
  }

  const newLine = normalized.length
    ? `tags: [${normalized.map(serializeTag).join(", ")}]`
    : null;

  if (tagsLineIdx >= 0) {
    const start = tagsLineIdx;
    const end = blockEndIdx >= 0 ? blockEndIdx : tagsLineIdx;
    const head = lines.slice(0, start);
    const tail = lines.slice(end + 1);
    const out = newLine ? [...head, newLine, ...tail] : [...head, ...tail];
    return out.join("\n");
  }

  if (!newLine) return frontmatter;

  let closeIdx = -1;
  for (let i = lines.length - 1; i >= 1; i--) {
    if (lines[i].trim() === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx < 0) return frontmatter;

  return [...lines.slice(0, closeIdx), newLine, ...lines.slice(closeIdx)].join("\n");
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
