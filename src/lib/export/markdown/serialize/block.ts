import { resolveCalloutIcon } from "@/components/editor/blocks/callout/calloutIcons";
import { wrapLocalBlockPropsMarkdown } from "../localBlockPropsWrappers";
import { blockNoteInlineToText, escapePipeInCell, escapeHtmlAttribute } from "./inline";
import { serializeCodeFenceInfo } from "./codeFence";
import { CHILDREN_CONSUMED_TYPES } from "./lists";
import { legacyItemInline, serializeLegacyListItem } from "./legacyLists";

export function blockNoteBlockToMarkdown(
  block: any, indent: string,
  serializeBlocks: (blocks: any[], indent: string) => string,
): string {
  const text = blockNoteInlineToText(block.content);
  let result: string;

  switch (block.type) {
    case "heading":
      result = `${"#".repeat(block.props?.level || block.attrs?.level || 1)} ${text}`;
      break;

    case "quote": {
      // 多行引用：文本内 \n（hardBreak）逐行加 > 前缀
      result = text
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
      break;
    }

    case "codeBlock": {
      // 编辑器/新 parse 用 props，极旧存量数据用 attrs
      const codeProps = block.props ?? block.attrs ?? {};
      const lang = (codeProps.language || "").trim();
      if (lang === "yaml-frontmatter") {
        const trimmed = text.trim();
        result = trimmed ? `---\n${trimmed}\n---` : "---\n---";
      } else if (lang === "math" || lang === "latex") {
        result = `$$\n${text}\n$$`;
      } else {
        result = `\`\`\`${serializeCodeFenceInfo(lang, codeProps)}\n${text}\n\`\`\``;
      }
      break;
    }

    case "image": {
      // BlockNote image：props { url, caption, previewWidth, textAlignment }
      // previewWidth → {width=N}，textAlignment(≠left) → {align=X}
      const p = block.props ?? block.attrs ?? {};
      const url = p.url || p.src || "";
      // name 是 BlockNote 图片的替代文本。无 caption 时也写入 Markdown alt，
      // 才能让复制后的 data 图片在下一次解析时保留该字段。
      const caption = p.caption || p.alt || p.name || "";
      const meta: string[] = [];
      const width = p.previewWidth ?? p.width;
      if (width != null && Number.isFinite(Number(width))) {
        meta.push(`width=${width}`);
      }
      const align = p.textAlignment;
      if (typeof align === "string" && align && align !== "left") {
        meta.push(`align=${align}`);
      }
      result = `![${caption}](${url})${meta.length ? `{${meta.join(" ")}}` : ""}`;
      break;
    }

    case "imageResize": {
      // 极旧存量格式：attrs { src, alt, width, height, containerStyle }
      const attrs = block.attrs ?? block.props ?? {};
      const src = attrs.src || attrs.url || "";
      const alt = attrs.alt || attrs.caption || "";
      const meta: string[] = [];
      if (attrs.width != null && Number.isFinite(Number(attrs.width))) {
        meta.push(`width=${attrs.width}`);
      }
      if (attrs.height != null && Number.isFinite(Number(attrs.height))) {
        meta.push(`height=${attrs.height}`);
      }
      const containerStyle: string = attrs.containerStyle ?? "";
      let align: string | undefined;
      if (containerStyle.includes("margin: 0 auto 0 0")) align = "left";
      else if (containerStyle.includes("margin: 0 auto;")) align = "center";
      else if (containerStyle.includes("margin: 0 0 0 auto")) align = "right";
      if (align) meta.push(`align=${align}`);
      result = `![${alt}](${src})${meta.length ? `{${meta.join(" ")}}` : ""}`;
      break;
    }

    case "table": {
      // BlockNote 格式：content = { type:"tableContent", rows:[{cells:[…]}] }
      // 极旧 parse 格式：content = [tableRow, …]
      let tableRows: any[][];
      const rawContent = block.content;
      if (
        rawContent &&
        typeof rawContent === "object" &&
        !Array.isArray(rawContent) &&
        Array.isArray(rawContent.rows)
      ) {
        tableRows = rawContent.rows.map((row: any) =>
          Array.isArray(row?.cells) ? row.cells : [],
        );
      } else if (Array.isArray(rawContent)) {
        tableRows = rawContent.map((row: any) =>
          Array.isArray(row?.content) ? row.content : [],
        );
      } else {
        return "";
      }
      if (!tableRows.length) return "";
      const colCount = Math.max(...tableRows.map((r) => r.length), 1);
      const padRow = (cells: any[]) => {
        const out = cells.map((cell) =>
          escapePipeInCell(blockNoteInlineToText(cell)),
        );
        while (out.length < colCount) out.push("");
        return out;
      };
      const header = padRow(tableRows[0]);
      const separator = new Array(colCount).fill("---");
      const body = tableRows.slice(1).map(padRow);
      result = [
        `| ${header.join(" | ")} |`,
        `| ${separator.join(" | ")} |`,
        ...body.map((row: string[]) => `| ${row.join(" | ")} |`),
      ].join("\n");
      break;
    }

    case "callout": {
      const icon = block.props?.icon ?? block.attrs?.emoji;
      result = text
        .split("\n")
        .map((line, index) => (
          index === 0
            ? `> [!INFO] ${resolveCalloutIcon(icon)} ${line}`
            : `> ${line}`
        ))
        .join("\n");
      break;
    }

    case "divider":
    case "horizontalRule":
      result = "---";
      break;

    case "file": {
      const p = block.props ?? block.attrs ?? {};
      result = `[📎 ${p.name || "文件"}](${p.url || ""})`;
      break;
    }

    case "video": {
      const p = block.props ?? block.attrs ?? {};
      const src = p.url || p.src || "";
      result = `<video src="${escapeHtmlAttribute(src)}" controls preload="metadata"></video>`;
      break;
    }

    case "audio": {
      const p = block.props ?? block.attrs ?? {};
      result = `[📎 ${p.name || "音频"}](${p.url || ""})`;
      break;
    }

    case "toggleListItem": {
      // BlockNote 折叠块 ↔ <details><summary>…</summary>…</details>
      const children: any[] = Array.isArray(block.children)
        ? block.children
        : [];
      const innerMd = children.length ? serializeBlocks(children, "") : "";
      result = innerMd
        ? `<details>\n<summary>${text}</summary>\n\n${innerMd}\n\n</details>`
        : `<details>\n<summary>${text}</summary>\n\n</details>`;
      break;
    }

    case "details": {
      // 极旧 parse 三件套格式：content = [detailsSummary, detailsContent]
      const contentArr: any[] = Array.isArray(block.content)
        ? block.content
        : [];
      const summaryBlock = contentArr.find(
        (c: any) => c?.type === "detailsSummary",
      );
      const contentBlock = contentArr.find(
        (c: any) => c?.type === "detailsContent",
      );
      const summaryText = summaryBlock
        ? blockNoteInlineToText(summaryBlock.content)
        : "详情";
      const innerBlocks: any[] = Array.isArray(contentBlock?.content)
        ? contentBlock.content
        : [];
      const innerMd = serializeBlocks(innerBlocks, "");
      result = `<details>\n<summary>${summaryText}</summary>\n\n${innerMd}\n\n</details>`;
      break;
    }

    case "detailsSummary":
    case "detailsContent":
      result = text;
      break;

    // ── 极旧 jsonContent 容器格式（TipTap 风格存量数据）────────────────────────
    case "bulletList":
    case "taskList": {
      const items: any[] = Array.isArray(block.content) ? block.content : [];
      result = items
        .map((item: any) => serializeLegacyListItem(item, indent))
        .filter(Boolean)
        .join("\n");
      break;
    }

    case "orderedList": {
      const items: any[] = Array.isArray(block.content) ? block.content : [];
      const startNum = block.attrs?.start ?? block.props?.start ?? 1;
      result = items
        .map((item: any, idx: number) => {
          const explicit = item?.attrs?.start;
          const num = explicit != null ? explicit : startNum + idx;
          const line = `${indent}${num}. ${legacyItemInline(item)}`;
          if (Array.isArray(item?.children) && item.children.length > 0) {
            const childMd = item.children
              .map((c: any) => serializeLegacyListItem(c, indent + "  "))
              .filter(Boolean)
              .join("\n");
            return childMd ? `${line}\n${childMd}` : line;
          }
          return line;
        })
        .join("\n");
      break;
    }

    case "blockquote": {
      const innerContent: any[] = Array.isArray(block.content)
        ? block.content
        : [];
      const quoteText = innerContent
        .map((b: any) => blockNoteInlineToText(b?.content ?? b))
        .join("\n");
      result = quoteText
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
      break;
    }

    default:
      result = text;
  }

  result = wrapLocalBlockPropsMarkdown(block, result);

  // 通用 children 追加（如 isToggleable 折叠标题的子块）：
  // 用空行分隔保证 md → blocks → md 二轮收敛（子块重读后成为兄弟块，输出不再变化）
  if (
    !CHILDREN_CONSUMED_TYPES.has(block.type) &&
    Array.isArray(block.children) &&
    block.children.length > 0
  ) {
    const childMd = serializeBlocks(block.children, indent);
    if (childMd) {
      result += (result ? "\n\n" : "") + childMd;
    }
  }

  return result;
}
