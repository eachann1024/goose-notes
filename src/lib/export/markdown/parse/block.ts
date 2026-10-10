import { indentLevel, parseNestedList } from "./nestedList";
import { parseHtmlBlock } from "./htmlBlocks";
import { parseCodeBlock } from "./codeBlocks";
import { parseFileBlock, parseImageBlock } from "./mediaBlocks";
import { frontmatterBodyHasUserVisibleKeys } from "@/lib/local-frontmatter";
import { parseInlineMarkdown } from "./inline";
import {
  isLegacyCodeBlockMetaComment,
  isThematicBreakLine,
  parseTableBlock,
} from "./blockHelpers";

/**
 * markdownToJsonContent 输出 **BlockNote PartialBlock[]**（数组，非 {type:"doc"}）。
 *
 * 为什么是 BlockNote 格式而不是 TipTap doc：
 * normalizePageContent 对数组输入走 normalizeBlocks（children 递归、attrs→props、
 * VALID_BLOCK_TYPES 直通），而对 {type:"doc"} 输入走 legacyNodeToBlocks——后者会
 * 丢弃 listItem.children（嵌套拍平）、orderedList start、imageResize 宽高对齐，
 * 并把 details/video/file 压成纯文本或直接丢掉。直接输出 BlockNote 格式可彻底
 * 绕开这条有损路径，保证 scanner 读入的 page.content 与磁盘 md 零损对应。
 */

// 返回类型标 any（运行时恒为 PartialBlock[] 数组）：调用方 entry.ts 仍有
// `Array.isArray(parsed) ? parsed : parsed?.content` 的双形状兼容分支，
// 标 any[] 会让 else 分支被 narrow 成 never 报 TS2339。
export function markdownToJsonContent(markdown: string): any {
  const lines = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const content: any[] = [];
  let i = 0;

  if (lines.length > 0 && lines[0].trim() === "---") {
    const frontmatterLines: string[] = [];
    i++;
    while (i < lines.length && lines[i].trim() !== "---") {
      frontmatterLines.push(lines[i]);
      i++;
    }
    if (i < lines.length && lines[i].trim() === "---") {
      const yamlBody = frontmatterLines.join("\n");
      // 只有用户属性才展示 YAML 块；仅 goose-favorite 等应用设置不进编辑器。
      if (frontmatterBodyHasUserVisibleKeys(yamlBody)) {
        content.push({
          type: "codeBlock",
          props: { language: "yaml-frontmatter" },
          content: yamlBody,
        });
      }
      i++;
    } else {
      i = 0;
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (isLegacyCodeBlockMetaComment(trimmedLine)) {
      i++;
      continue;
    }

    const parseHtmlBlockResult = parseHtmlBlock(lines, i, markdownToJsonContent);
    if (parseHtmlBlockResult) {
      content.push(parseHtmlBlockResult.block);
      i = parseHtmlBlockResult.nextIndex;
      continue;
    }

    const parseCodeBlockResult = parseCodeBlock(lines, i);
    if (parseCodeBlockResult) {
      content.push(parseCodeBlockResult.block);
      i = parseCodeBlockResult.nextIndex;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        props: { level: headingMatch[1].length },
        content: parseInlineMarkdown(headingMatch[2]),
      });
      i++;
      continue;
    }

    // setext 标题：当前行是普通文本，下一行是 ===+（H1）或 ---+（H2）
    if (
      trimmedLine &&
      !trimmedLine.startsWith(">") &&
      !trimmedLine.startsWith("-") &&
      !trimmedLine.startsWith("#") &&
      !trimmedLine.startsWith("<") &&
      !trimmedLine.startsWith("|") &&
      i + 1 < lines.length
    ) {
      const nextTrimmed = lines[i + 1].trim();
      if (/^={2,}$/.test(nextTrimmed)) {
        content.push({
          type: "heading",
          props: { level: 1 },
          content: parseInlineMarkdown(trimmedLine),
        });
        i += 2;
        continue;
      }
      if (/^-{2,}$/.test(nextTrimmed)) {
        content.push({
          type: "heading",
          props: { level: 2 },
          content: parseInlineMarkdown(trimmedLine),
        });
        i += 2;
        continue;
      }
    }

    if (isThematicBreakLine(line)) {
      content.push({ type: "divider" });
      i++;
      continue;
    }

    if (trimmedLine.startsWith(">")) {
      const firstLine = trimmedLine.slice(1).trim();

      const calloutMatch = firstLine.match(
        /^\[!INFO\]\s+(?:([\uD800-\uDBFF][\uDC00-\uDFFF]|\S))\s+(.+)$/i,
      );

      if (calloutMatch) {
        const calloutLines: string[] = [calloutMatch[2]];
        i++;
        // 本地文件夹的块级 wrapper 会让多行 callout 的后续行保持 `> ` 前缀；
        // 与普通多行引用一致地合并，避免第二行被拆成独立 quote 块。
        while (i < lines.length && lines[i].trim().startsWith(">")) {
          calloutLines.push(lines[i].trim().slice(1).trim());
          i++;
        }
        content.push({
          type: "callout",
          props: { icon: calloutMatch[1] },
          content: parseInlineMarkdown(calloutLines.join("\n")),
        });
        continue;
      }

      // 多行引用：连续 > 行用 \n 连接（BlockNote 文本内 \n = hardBreak，编辑器可保真）
      const quoteLines: string[] = [firstLine];
      i++;
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().slice(1).trim());
        i++;
      }
      content.push({
        type: "quote",
        content: parseInlineMarkdown(quoteLines.join("\n")),
      });
      continue;
    }

    // Try parsing table
    const tableResult = parseTableBlock(lines, i, parseInlineMarkdown);
    if (tableResult) {
      content.push(tableResult.block);
      i = tableResult.nextIndex;
      continue;
    }

    const parseFileBlockResult = parseFileBlock(lines, i);
    if (parseFileBlockResult) {
      content.push(parseFileBlockResult.block);
      i = parseFileBlockResult.nextIndex;
      continue;
    }

    // 嵌套列表（task / bullet / ordered）
    const baseIndent = indentLevel(line);
    const stripped = line.slice(baseIndent);
    if (
      stripped.match(/^-\s+\[[ xX]\](?:\s+.*)?$/) ||
      stripped.match(/^[-*+]\s+\S/) ||
      stripped.match(/^\d+\.\s+\S/)
    ) {
      const { items, nextIndex } = parseNestedList(
        lines,
        i,
        baseIndent,
        parseInlineMarkdown,
      );
      if (items.length) {
        content.push(...items);
        i = nextIndex;
        continue;
      }
    }

    const parseImageBlockResult = parseImageBlock(lines, i);
    if (parseImageBlockResult) {
      content.push(parseImageBlockResult.block);
      i = parseImageBlockResult.nextIndex;
      continue;
    }

    if (line.trim()) {
      const paragraphLines: string[] = [];

      while (i < lines.length) {
        const currentLine = lines[i];
        const trimmed = currentLine.trim();

        if (!trimmed) break;

        if (paragraphLines.length > 0) {
          if (
            currentLine.startsWith("#") ||
            currentLine.startsWith(">") ||
            currentLine.startsWith("```") ||
            currentLine.startsWith("~~~") ||
            currentLine.startsWith("$$") ||
            currentLine.match(/^-\s+\[[ xX]\]/) ||
            currentLine.match(/^[-*+]\s+/) ||
            currentLine.match(/^\d+\.\s+/) ||
            isThematicBreakLine(currentLine) ||
            currentLine.match(/^\|/) ||
            currentLine.match(/^\[📎/) ||
            trimmed.match(/^<video\s+src=/) ||
            trimmed.startsWith("<details>")
          ) {
            break;
          }
          // 下一行是 setext 下划线 → 当前行是 setext 标题文本，停止收集
          const nextTrimmed = lines[i + 1]?.trim() ?? "";
          if (/^={2,}$/.test(nextTrimmed) || /^-{2,}$/.test(nextTrimmed)) {
            break;
          }
        }

        paragraphLines.push(currentLine);
        i++;
      }

      if (paragraphLines.length > 0) {
        // 软换行保真：段内换行用 \n 保留（BlockNote 文本内 \n = hardBreak）
        const combinedText = paragraphLines.join("\n");
        const inline = parseInlineMarkdown(combinedText);
        content.push(
          inline.length > 0
            ? { type: "paragraph", content: inline }
            : { type: "paragraph" },
        );
        continue;
      }
    } else if (
      content.length > 0 &&
      ["bulletListItem", "numberedListItem", "checkListItem"].includes(
        content[content.length - 1].type,
      )
    ) {
      content.push({ type: "paragraph" });
    }
    i++;
  }

  return content;
}
