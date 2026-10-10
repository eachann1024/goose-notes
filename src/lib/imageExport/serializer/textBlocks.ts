import type { CardTheme } from "../themes";
import { resolveCalloutIcon } from "@/components/editor/blocks/callout/calloutIcons";
import { escapeHtml } from "./utils";
import { renderInline } from "./inline";
import { buildBlockStyleAttr } from "./blockStyles";

function extractCodeText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);
  return content
    .map((item: any) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      if (item.type === "hardBreak") return "\n";
      return typeof item.text === "string" ? item.text : "";
    })
    .join("");
}


export function renderTextBlock(
  block: any, theme: CardTheme,
  renderBlock: (block: any, theme: CardTheme) => string,
  renderBlocks: (blocks: any[], theme: CardTheme) => string,
): string {
  if (!block || typeof block !== "object") return "";

  const inlineHtml = renderInline(block.content, theme);
  const styleAttr = buildBlockStyleAttr(block, theme);

  function renderChildren(block: any, theme: CardTheme, className = "nested-children"): string {
    const children = block?.children;
    if (!Array.isArray(children) || children.length === 0) return "";
    // 子块也可能是连续列表，走 renderBlocks 合并
    const inner = renderBlocks(children, theme);
    if (!inner) return "";
    return `<div class="${className}">${inner}</div>`;
  }

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(block.props?.level) || 1, 1), 3);
      const isToggle = !!block.props?.isToggleable;
      const inner = isToggle
        ? `<span class="toggle-marker">▾</span><span>${inlineHtml}</span>`
        : inlineHtml;
      const heading = isToggle
        ? `<h${level}${styleAttr}><div class="toggle-summary">${inner}</div></h${level}>`
        : `<h${level}${styleAttr}>${inner}</h${level}>`;
      return `${heading}${renderChildren(block, theme)}`;
    }

    case "bulletListItem": {
      // 嵌套子列表：若 children 是列表项，由 renderBlocks 处理
      const children = block.children?.length
        ? renderBlocks(block.children, theme)
        : "";
      // 若 children 已是 ul/ol（renderBlocks 输出），直接挂；否则包一层
      const childHtml = children
        ? children.trimStart().startsWith("<ul") || children.trimStart().startsWith("<ol")
          ? children
          : `<div class="nested-children">${children}</div>`
        : "";
      return `<li${styleAttr}>${inlineHtml || ""}${childHtml}</li>`;
    }

    case "numberedListItem": {
      const children = block.children?.length
        ? renderBlocks(block.children, theme)
        : "";
      const childHtml = children
        ? children.trimStart().startsWith("<ul") || children.trimStart().startsWith("<ol")
          ? children
          : `<div class="nested-children">${children}</div>`
        : "";
      const value = Number(block.props?.start);
      const valueAttr =
        Number.isInteger(value) && value > 0 ? ` value="${value}"` : "";
      return `<li${valueAttr}${styleAttr}>${inlineHtml || ""}${childHtml}</li>`;
    }

    case "checkListItem": {
      const checked = !!block.props?.checked;
      const checkboxClass = checked ? "task-checkbox checked" : "task-checkbox";
      const itemClass = checked ? "task-item checked" : "task-item";
      const item = `<div class="${itemClass}"${styleAttr}><div class="task-checkbox-wrap"><div class="${checkboxClass}"></div></div><span class="task-text">${inlineHtml}</span></div>`;
      return `${item}${renderChildren(block, theme)}`;
    }

    case "codeBlock": {
      const lang = (block.props?.language || "").trim();
      const codeStr = escapeHtml(extractCodeText(block.content));
      const wrap = block.props?.wrap === true;
      const collapsed = block.props?.collapsed === true;
      const summary =
        typeof block.props?.summary === "string" ? block.props.summary.trim() : "";

      // mermaid/math 由上游管线转 image；若仍落到这里则当普通代码
      const showLang = lang && lang !== "text" && lang !== "plain";
      const preClass = wrap ? ' class="code-wrap"' : "";
      const dataAttrs = [
        lang ? ` data-lang="${escapeHtml(lang)}"` : "",
        collapsed ? ' data-collapsed="true"' : "",
      ].join("");
      const summaryHtml =
        collapsed && summary
          ? `<div class="code-summary">${escapeHtml(summary)}</div>`
          : "";
      const langHtml = showLang
        ? `<div class="code-lang">${escapeHtml(lang)}</div>`
        : "";
      return `<div class="code-block"${dataAttrs}>${langHtml}${summaryHtml}<pre${preClass}><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${codeStr}</code></pre></div>`;
    }

    case "quote": {
      return `<blockquote${styleAttr}>${inlineHtml}</blockquote>${renderChildren(block, theme)}`;
    }

    case "paragraph": {
      if (!inlineHtml) {
        return `<p class="empty-block" data-empty="true"${styleAttr}><br></p>${renderChildren(block, theme)}`;
      }
      return `<p${styleAttr}>${inlineHtml}</p>${renderChildren(block, theme)}`;
    }

    case "divider": {
      return `<hr />`;
    }

    case "toggleListItem": {
      const summary = `<div class="toggle-summary"><span class="toggle-marker">▾</span><span>${inlineHtml}</span></div>`;
      const childrenHtml = renderChildren(block, theme, "toggle-children");
      return `<div class="toggle-block"${styleAttr}>${summary}${childrenHtml}</div>`;
    }

    case "callout": {
      const icon = resolveCalloutIcon(block.props?.icon || block.props?.emoji);
      const childrenHtml = renderChildren(block, theme);
      return `<div class="callout"${styleAttr}><div class="callout-icon">${escapeHtml(icon)}</div><div class="callout-text">${inlineHtml}${childrenHtml}</div></div>`;
    }

    case "bulletList": {
      const items = block.content || block.children || [];
      return `<ul class="bn-list">${(items as any[]).map((item: any) => renderBlock(item, theme)).join("")}</ul>`;
    }

    case "orderedList": {
      const items = block.content || block.children || [];
      const start = Number(block.props?.start ?? block.attrs?.start);
      const startAttr =
        Number.isInteger(start) && start > 1 ? ` start="${start}"` : "";
      return `<ol class="bn-list"${startAttr}>${(items as any[]).map((item: any) => renderBlock(item, theme)).join("")}</ol>`;
    }

    default: {
      const body = inlineHtml ? `<p${styleAttr}>${inlineHtml}</p>` : "";
      return `${body}${renderChildren(block, theme)}`;
    }
  }
}
