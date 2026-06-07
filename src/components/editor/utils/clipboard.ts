export function normalizeClipboardLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function looksLikeMarkdownFragment(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  return (
    /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*[-*+]\s\[[ xX]\]\s|\s*[•·]\s|\s*\.\s)/m.test(value) ||
    /```/.test(value) ||
    /\|.+\|/.test(value) ||
    /(\*\*|__|~~|`[^`]+`)/.test(value) ||
    /\[([^\]]+)\]\(([^)]+)\)/.test(value)
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

export function parseMarkdownLink(text: string): { text: string; url: string } | null {
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
  if (unwrapMarkdownAutolink(clipboardText) === selectedText.trim()) return true;
  if (!clipboardText.includes("\\\n") && !clipboardText.match(/ {2,}\n/)) return false;
  return stripMarkdownHardBreakArtifacts(clipboardText) === selectedText;
}

/**
 * 判断剪贴板内容是否为「块结构」(非纯单行文本)——用于「标题一隔离」：光标在标题一时，
 * 块结构应落到标题下方而非注入标题。判定为「块结构」的依据(命中任一即是)：
 * - HTML 含块级标签：img/figure/table/pre/code/ul/ol/li/h1-6/blockquote/hr/p×多 等；
 * - 纯文本含块级 Markdown：标题(# )/列表(- 1.)/待办/代码围栏(```)/表格(|...|)/引用(> )/分隔线；
 * - 纯文本含换行(多行)——标题是单行的，多行内容应落正文。
 * 反之：单行纯文本、或仅含 inline 标签(b/i/a/strong/em/span/code-inline)的 HTML → 非块结构，
 * 照常注入标题文字。
 */
export function looksLikeBlockStructure(
  plainText: string,
  htmlText: string,
): boolean {
  const html = (htmlText || "").trim();
  if (html) {
    // 块级标签出现即视为块结构。
    if (
      /<\s*(img|figure|picture|table|thead|tbody|tr|td|th|pre|ul|ol|li|h[1-6]|blockquote|hr|video|audio|iframe)\b/i.test(
        html,
      )
    ) {
      return true;
    }
    // 多个 <p>/<div> 段落 → 多块结构。
    const blockParaCount = (html.match(/<\s*(p|div)\b/gi) || []).length;
    if (blockParaCount >= 2) return true;
  }

  const text = (plainText || "").trim();
  if (!text) return false;
  // 含换行 = 多行 → 落正文。
  if (/\n/.test(text)) return true;
  // 单行但含块级 Markdown 语法。
  if (
    /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\s*[-*+]\s\[[ xX]\]\s|>\s|```|\|.+\||-{3,}$)/.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

export function isValidUrl(text: string): boolean {
  if (!text) return false;
  // 协议 URL
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+/i.test(text)) return true;
  // www. 开头的 URL
  if (/^www\.\S+\.\S{2,}/i.test(text)) return true;
  // 域名格式 of URL (example.com/path)
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\.[a-z]{2,}(\/\S*)?$/i.test(text)) return true;
  return false;
}
