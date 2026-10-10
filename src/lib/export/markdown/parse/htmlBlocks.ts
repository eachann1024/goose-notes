import { parseInlineMarkdown } from "./inline";

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}


export function parseHtmlBlock(lines: string[], startIndex: number, parseMarkdown: (markdown: string) => any[]) {
  const content: any[] = [];
  let i = startIndex;
  const line = lines[i];
  const trimmedLine = line.trim();
    // ── video 块（serialize 写出的 <video src="…" controls ...></video> 单行）
    // video 在 raw-guard allowlist 中不会被包成 goose-raw-block，这里映射回 video 块
    const videoLineMatch = trimmedLine.match(
      /^<video\s+src="([^"]*)"[^>]*>\s*<\/video>$/i,
    );
    if (videoLineMatch) {
      content.push({
        type: "video",
        props: { url: decodeHtmlAttribute(videoLineMatch[1]) },
      });
      i++;
      return { block: content[0], nextIndex: i };
    }

    // ── details 折叠块 → BlockNote toggleListItem（editor schema 没有 details 块，
    // toggleListItem 是「可折叠 + summary 行 + 子块」的对称表示）
    if (trimmedLine.startsWith("<details>")) {
      const detailsLines: string[] = [];
      let summaryText = "详情";
      i++;
      while (i < lines.length && !lines[i].trim().includes("</details>")) {
        const l = lines[i].trim();
        if (l.startsWith("<summary>") && l.endsWith("</summary>")) {
          summaryText = l.replace("<summary>", "").replace("</summary>", "");
        } else {
          detailsLines.push(lines[i]);
        }
        i++;
      }

      const childBlocks = parseMarkdown(detailsLines.join("\n"));
      content.push({
        type: "toggleListItem",
        content: parseInlineMarkdown(summaryText),
        ...(childBlocks.length ? { children: childBlocks } : {}),
      });
      i++;
      return { block: content[0], nextIndex: i };
    }

  return null;
}
