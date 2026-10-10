import { stripMermaidInitDirectives } from "./mermaidTheme";

export type TimelineItem = {
  section: string;
  period: string;
  events: string[];
};

export type TimelineModel = {
  title: string;
  items: TimelineItem[];
};

function isNoiseLine(line: string): boolean {
  return (
    line.length === 0 ||
    line.startsWith("%%") ||
    line.startsWith("#") ||
    /^(accTitle|accDescr)\b/i.test(line)
  );
}

export function isMermaidTimeline(source: string): boolean {
  const text = stripMermaidInitDirectives(source);
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (isNoiseLine(line)) continue;
    return /^timeline\b/i.test(line);
  }
  return false;
}

export function parseMermaidTimeline(source: string): TimelineModel | null {
  const text = stripMermaidInitDirectives(source).replace(/\r\n/g, "\n");
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (isNoiseLine(line)) continue;
    lines.push(line);
  }
  if (lines.length === 0 || !/^timeline\b/i.test(lines[0])) return null;

  let title = "";
  let section = "";
  const items: TimelineItem[] = [];

  for (const line of lines.slice(1)) {
    const titleMatch = line.match(/^title\s+(.*)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    const sectionMatch = line.match(/^section\s+(.*)$/i);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    if (/^:\s*/.test(line)) {
      const event = line.replace(/^:\s*/, "").trim();
      if (event && items.length > 0) items[items.length - 1].events.push(event);
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) {
      items.push({ section, period: line, events: [] });
      continue;
    }
    const period = line.slice(0, colon).trim();
    const events = line
      .slice(colon + 1)
      .split(/\s+:\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    items.push({ section, period, events });
  }

  if (items.length === 0) return null;
  return { title, items };
}
