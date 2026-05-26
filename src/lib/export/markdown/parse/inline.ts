export function parseInlineMarkdown(text: string): any[] {
  const result: any[] = [];
  if (!text) return result;

  const regex =
    /(\$((?:\\\$|[^\$])+?)\$|<span\s+style="([^"]+)">(.+?)<\/span>|==(.+?)==|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  function pushPlain(t: string) {
    if (!t) return;
    result.push(t);
  }

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushPlain(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      pushPlain(`$${match[2]}$`);
    } else if (match[3] && match[4]) {
      const style = match[3];
      const innerText = match[4];
      const styles: Record<string, any> = {};

      const colorMatch = style.match(/color:\s*([^;]+)/);
      if (colorMatch) {
        styles.textColor = colorMatch[1].trim();
      }

      const bgMatch = style.match(/background-color:\s*([^;]+)/);
      if (bgMatch) {
        styles.backgroundColor = bgMatch[1].trim();
      }

      result.push({ type: "text", text: innerText, styles });
    } else if (match[5]) {
      result.push({ type: "text", text: match[5], styles: { backgroundColor: "yellow" } });
    } else if (match[6]) {
      result.push({ type: "text", text: match[6], styles: { bold: true } });
    } else if (match[7]) {
      result.push({ type: "text", text: match[7], styles: { italic: true } });
    } else if (match[8]) {
      result.push({ type: "text", text: match[8], styles: { strike: true } });
    } else if (match[9]) {
      result.push({ type: "text", text: match[9], styles: { code: true } });
    } else if (match[10] && match[11]) {
      result.push({
        type: "link",
        href: match[11],
        content: [{ type: "text", text: match[10], styles: {} }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushPlain(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}
