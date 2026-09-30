import type { CardTheme } from "../themes";
import {
  escapeHtml,
  BLOCKNOTE_TEXT_COLORS,
  BLOCKNOTE_BACKGROUND_COLORS,
  resolveExportColor,
} from "./utils";

const LUCIDE_ICON_TO_EMOJI: Record<string, string> = {
  Lightbulb: "💡",
  AlertTriangle: "⚠️",
  CircleAlert: "❗",
  CircleCheck: "✅",
  Flame: "🔥",
  Pin: "📌",
  MessageSquare: "💬",
  Target: "🎯",
  Rocket: "🚀",
  Star: "⭐",
  Bell: "🔔",
  Bug: "🐛",
};

function resolveCalloutIcon(raw: string | undefined): string {
  if (!raw) return "💡";
  return LUCIDE_ICON_TO_EMOJI[raw] ?? raw;
}

// 渲染块的嵌套子块（block.children）。BlockNote 中任意块都可经 Tab 缩进容纳
// 子块（折叠块的展开内容也存在 children），但导出渲染此前只处理了列表项的
// children，导致折叠块/段落/勾选项等下方嵌套的图片在导出时被丢弃。
// 仅当确有子块时才输出容器，避免空 div 撑乱间距。
function renderChildren(block: any, theme: CardTheme, className = "nested-children"): string {
  const children = block?.children;
  if (!Array.isArray(children) || children.length === 0) return "";
  const inner = children.map((c: any) => renderBlock(c, theme)).join("");
  if (!inner) return "";
  return `<div class="${className}">${inner}</div>`;
}

export function renderBlock(block: any, theme: CardTheme): string {
  if (!block || typeof block !== "object") return "";

  const inlineHtml = renderInline(block.content);
  const alignStyle = block.props?.textAlignment === "center"
    ? ' style="text-align:center"'
    : block.props?.textAlignment === "right"
      ? ' style="text-align:right"'
      : block.props?.textAlignment === "justify"
        ? ' style="text-align:justify"'
        : "";

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.props?.level || 1, 1), 3);
      return `<h${level}${alignStyle}>${inlineHtml}</h${level}>${renderChildren(block, theme)}`;
    }

    case "bulletListItem": {
      const children = block.children?.length
        ? `<ul>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ul>`
        : "";
      return `<li${alignStyle}>${inlineHtml}${children}</li>`;
    }

    case "numberedListItem": {
      const children = block.children?.length
        ? `<ol>${block.children.map((c: any) => renderBlock(c, theme)).join("")}</ol>`
        : "";
      return `<li${alignStyle}>${inlineHtml}${children}</li>`;
    }

    case "checkListItem": {
      const checked = block.props?.checked;
      const checkboxClass = checked ? "task-checkbox checked" : "task-checkbox";
      const item = `<div class="task-item"${alignStyle}><div class="${checkboxClass}"></div><span>${inlineHtml}</span></div>`;
      // children 容器放在 task-item 之外，避免被 flex 布局拉成横排
      return `${item}${renderChildren(block, theme)}`;
    }

    case "codeBlock": {
      const lang = block.props?.language || "";
      const code = block.content || "";
      const codeStr = typeof code === "string"
        ? escapeHtml(code)
        : Array.isArray(code)
          ? code.map((c: any) => escapeHtml(typeof c === "string" ? c : c?.text || "")).join("")
          : escapeHtml(String(code));
      return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${codeStr}</code></pre>`;
    }

    case "quote": {
      return `<blockquote${alignStyle}>${inlineHtml}</blockquote>${renderChildren(block, theme)}`;
    }

    case "paragraph": {
      const p = inlineHtml ? `<p${alignStyle}>${inlineHtml}</p>` : `<p${alignStyle}></p>`;
      return `${p}${renderChildren(block, theme)}`;
    }

    case "image":
    case "imageResize":
    case "file": {
      const src = block.props?.url || block.props?.src || "";
      const alt = block.props?.caption || block.props?.alt || block.props?.name || "";
      if (!src) return "";
      const alignment = block.props?.textAlignment || block.props?.alignment;
      const imgAlignStyle = alignment === "center" ? "display:block;margin-left:auto;margin-right:auto;"
        : alignment === "right" ? "display:block;margin-left:auto;"
        : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${imgAlignStyle}" />`;
    }

    case "table": {
      const rows = block.content?.rows || [];
      if (!rows.length) return "";
      const htmlRows = rows.map((row: any, i: number) => {
        const cells = row.cells || [];
        const tag = i === 0 ? "th" : "td";
        return `<tr>${cells.map((cell: any) => {
          const text = typeof cell === "string" ? cell : extractCellTextForHtml(cell);
          return `<${tag}>${escapeHtml(text)}</${tag}>`;
        }).join("")}</tr>`;
      });
      return `<table><tbody>${htmlRows.join("")}</tbody></table>`;
    }

    case "divider": {
      return `<hr />`;
    }

    case "toggleListItem": {
      // 折叠块：导出为静态图时始终展开。标题行 + 展开内容(children)。
      // 标题为空也要渲染 children，否则折叠块里的图片会整体丢失。
      const summary = `<div class="toggle-summary"><span class="toggle-marker">▾</span><span>${inlineHtml}</span></div>`;
      const childrenHtml = renderChildren(block, theme, "toggle-children");
      return `<div class="toggle-block">${summary}${childrenHtml}</div>`;
    }

    case "callout": {
      const icon = resolveCalloutIcon(block.props?.icon || block.props?.emoji);
      // children 渲染在 callout-text 内，使嵌套内容随 callout 缩进对齐
      const childrenHtml = renderChildren(block, theme);
      return `<div class="callout"><div class="callout-icon">${escapeHtml(icon)}</div><div class="callout-text">${inlineHtml}${childrenHtml}</div></div>`;
    }

    case "bulletList": {
      const items = block.content || [];
      return `<ul>${items.map((item: any) => renderBlock(item, theme)).join("")}</ul>`;
    }

    case "orderedList": {
      const items = block.content || [];
      return `<ol>${items.map((item: any) => renderBlock(item, theme)).join("")}</ol>`;
    }

    default: {
      // 兜底未知/自定义块：渲染内联内容，并递归 children，
      // 避免未识别的可嵌套块吞掉子块（含图片）。
      const body = inlineHtml ? `<p${alignStyle}>${inlineHtml}</p>` : "";
      return `${body}${renderChildren(block, theme)}`;
    }
  }
}

export function renderInline(content: unknown): string {
  if (typeof content === "string") return escapeHtml(content).replace(/\n/g, "<br>");
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return escapeHtml(item).replace(/\n/g, "<br>");
      if (!item || typeof item !== "object") return "";

      // Handle inline image nodes (e.g. pasted/dragged images within text)
      if (item.type === "image" && item.attrs?.src) {
        const src = item.attrs.src;
        const alt = item.attrs.alt || "";
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;border-radius:8px;display:inline-block;vertical-align:middle;" />`;
      }

      let text = escapeHtml(item.text || "").replace(/\n/g, "<br>");
      const styles = item.styles || {};
      const marks = item.marks || [];

      let wrapper = text;

      if (styles.bold || marks.some((m: any) => m?.type === "bold")) {
        wrapper = `<strong>${wrapper}</strong>`;
      }
      if (styles.italic || marks.some((m: any) => m?.type === "italic")) {
        wrapper = `<em>${wrapper}</em>`;
      }
      if (styles.underline || marks.some((m: any) => m?.type === "underline")) {
        wrapper = `<u>${wrapper}</u>`;
      }
      if (styles.strike || marks.some((m: any) => m?.type === "strike")) {
        wrapper = `<del>${wrapper}</del>`;
      }
      if (styles.code || marks.some((m: any) => m?.type === "code")) {
        wrapper = `<code>${wrapper}</code>`;
      }

      if (item.type === "link" && item.href) {
        wrapper = `<a href="${escapeHtml(item.href)}">${wrapper}</a>`;
      }

      const linkMark = marks.find((m: any) => m?.type === "link");
      if (linkMark?.attrs?.href && item.type !== "link") {
        wrapper = `<a href="${escapeHtml(linkMark.attrs.href)}">${wrapper}</a>`;
      }

      const textColor =
        styles.textColor ||
        marks.find((m: any) => m?.type === "textColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "textStyle")?.attrs?.color ||
        styles.color;
      const resolvedTextColor = resolveExportColor(textColor, BLOCKNOTE_TEXT_COLORS);
      if (resolvedTextColor) {
        wrapper = `<span style="color:${escapeHtml(resolvedTextColor)}">${wrapper}</span>`;
      }

      const bgColor =
        styles.backgroundColor ||
        marks.find((m: any) => m?.type === "backgroundColor")?.attrs?.color ||
        marks.find((m: any) => m?.type === "highlight")?.attrs?.color;
      const resolvedBgColor = resolveExportColor(bgColor, BLOCKNOTE_BACKGROUND_COLORS);
      if (resolvedBgColor) {
        wrapper = `<span style="background-color:${escapeHtml(resolvedBgColor)};border-radius:2px;padding:0 2px;">${wrapper}</span>`;
      }

      if (item.type === "inlineMath" && item.attrs?.value) {
        wrapper = `<code>${escapeHtml(item.attrs.value)}</code>`;
      }

      return wrapper;
    })
    .join("");
}

export function extractInlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item: any) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      if (item.type === "inlineMath" && item.attrs?.value) {
        return item.attrs.value;
      }
      return item.text || "";
    })
    .join("");
}

export function extractCellTextForHtml(cell: any): string {
  if (typeof cell === "string") return cell;
  if (Array.isArray(cell)) {
    return cell.map((c: any) => {
      if (typeof c === "string") return c;
      if (c?.text) return c.text;
      return "";
    }).join("");
  }
  if (cell?.text) return cell.text;
  if (cell?.content) {
    if (typeof cell.content === "string") return cell.content;
    if (Array.isArray(cell.content)) {
      return cell.content.map((c: any) => {
        if (typeof c === "string") return c;
        if (c?.text) return c.text;
        return "";
      }).join("");
    }
  }
  return "";
}
