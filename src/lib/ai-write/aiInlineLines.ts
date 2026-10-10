export function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isHardBreak(item: unknown): boolean {
  return (
    !!item &&
    typeof item === "object" &&
    (item as { type?: unknown }).type === "hardBreak"
  );
}

export function inlinePlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const value = item as Record<string, unknown>;
      if (isHardBreak(value)) return "\n";
      if (typeof value.text === "string") return value.text;
      return inlinePlainText(value.content);
    })
    .join("");
}

function splitInlineArray(content: unknown[]): unknown[][] {
  const lines: unknown[][] = [[]];
  const nextLine = () => lines.push([]);

  for (const rawItem of content) {
    if (isHardBreak(rawItem)) {
      nextLine();
      continue;
    }
    if (typeof rawItem === "string") {
      const parts = rawItem.split("\n");
      parts.forEach((text, index) => {
        if (text) lines[lines.length - 1].push(text);
        if (index < parts.length - 1) nextLine();
      });
      continue;
    }
    if (!rawItem || typeof rawItem !== "object") {
      lines[lines.length - 1].push(cloneValue(rawItem));
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    if (item.type === "link" && Array.isArray(item.content)) {
      const linkLines = splitInlineArray(item.content);
      linkLines.forEach((line, index) => {
        if (line.length > 0) {
          lines[lines.length - 1].push({
            ...cloneValue(item),
            content: line,
          });
        }
        if (index < linkLines.length - 1) nextLine();
      });
      continue;
    }

    if (typeof item.text !== "string" || !item.text.includes("\n")) {
      lines[lines.length - 1].push(cloneValue(item));
      continue;
    }

    const parts = item.text.split("\n");
    parts.forEach((text, index) => {
      if (text) lines[lines.length - 1].push({ ...cloneValue(item), text });
      if (index < parts.length - 1) nextLine();
    });
  }

  return lines;
}

export function splitContentLines(content: unknown): unknown[] {
  if (typeof content === "string") return content.split("\n");
  if (!Array.isArray(content)) return content == null ? [""] : [content];
  return splitInlineArray(content);
}

export function stripLeadingChars(content: unknown, count: number): unknown {
  return stripLeadingCharsTracked(content, count).value;
}

export function stripLeadingCharsTracked(
  content: unknown,
  count: number,
): { value: unknown; remaining: number } {
  if (count <= 0) return { value: content, remaining: 0 };
  if (typeof content === "string") {
    if (content.length <= count) {
      return { value: "", remaining: count - content.length };
    }
    return { value: content.slice(count), remaining: 0 };
  }
  if (!Array.isArray(content)) return { value: content, remaining: count };

  let remaining = count;
  const out: unknown[] = [];
  for (const raw of content) {
    if (remaining <= 0) {
      out.push(raw);
      continue;
    }
    if (typeof raw === "string") {
      const next = stripLeadingCharsTracked(raw, remaining);
      remaining = next.remaining;
      if (typeof next.value === "string" && next.value.length > 0) {
        out.push(next.value);
      }
      continue;
    }
    if (raw && typeof raw === "object") {
      const item = raw as Record<string, unknown>;
      if (typeof item.text === "string") {
        const next = stripLeadingCharsTracked(item.text, remaining);
        remaining = next.remaining;
        if (typeof next.value === "string" && next.value.length > 0) {
          out.push({ ...item, text: next.value });
        }
        continue;
      }
      if (Array.isArray(item.content)) {
        const next = stripLeadingCharsTracked(item.content, remaining);
        remaining = next.remaining;
        if (inlinePlainText(next.value).length > 0) {
          out.push({ ...item, content: next.value });
        }
        continue;
      }
    }
    out.push(raw);
  }
  return { value: out, remaining };
}
