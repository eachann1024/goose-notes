import {
  parseWikiLinkInner,
  serializeWikiLinkMarkdown,
  stripWikiMarkdownExtension,
  wikiLinkDisplayTitle,
} from "@/lib/wikiLink";

export const PAGE_MENTION_TYPE = "pageMention";
export const PAGE_MENTION_HREF_SCHEME = "goose-page:";

export type PageMentionProps = {
  pageId: string;
  workspaceId: string;
  title: string;
  notebookName: string;
  wikiTarget: string;
};

const EMPTY_MENTION: PageMentionProps = {
  pageId: "",
  workspaceId: "",
  title: "未命名",
  notebookName: "",
  wikiTarget: "",
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function sanitizePageMentionProps(value: unknown): PageMentionProps | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const nested =
    source.props && typeof source.props === "object"
      ? (source.props as Record<string, unknown>)
      : source;
  const pageId = readString(nested.pageId).trim();
  const wikiTarget = readString(nested.wikiTarget).trim();
  if (!pageId && !wikiTarget) return null;
  const title = readString(nested.title).trim() || EMPTY_MENTION.title;
  return {
    pageId,
    workspaceId: readString(nested.workspaceId).trim(),
    title,
    notebookName: readString(nested.notebookName).trim(),
    wikiTarget,
  };
}

export function pageMentionLabel(props: Pick<PageMentionProps, "title">): string {
  const title = props.title.trim() || EMPTY_MENTION.title;
  return title.startsWith("@") ? title : `@${title}`;
}

function escapeMarkdownLinkText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
}

export function serializePageMentionHref(props: PageMentionProps): string {
  const pageId = encodeURIComponent(props.pageId);
  const notebook = props.workspaceId
    ? `?nb=${encodeURIComponent(props.workspaceId)}`
    : "";
  return `${PAGE_MENTION_HREF_SCHEME}//${pageId}${notebook}`;
}

export function parsePageMentionHref(href: string): Pick<
  PageMentionProps,
  "pageId" | "workspaceId"
> | null {
  const trimmed = href.trim();
  if (!trimmed.toLowerCase().startsWith(PAGE_MENTION_HREF_SCHEME)) return null;
  const rest = trimmed.slice(PAGE_MENTION_HREF_SCHEME.length).replace(/^\/\//, "");
  const queryIndex = rest.indexOf("?");
  const encodedId = (queryIndex === -1 ? rest : rest.slice(0, queryIndex)).trim();
  if (!encodedId) return null;
  let pageId: string;
  try {
    pageId = decodeURIComponent(encodedId);
  } catch {
    return null;
  }
  if (!pageId) return null;
  let workspaceId = "";
  if (queryIndex !== -1) {
    const params = new URLSearchParams(rest.slice(queryIndex + 1));
    workspaceId = params.get("nb")?.trim() || "";
  }
  return { pageId, workspaceId };
}

export function serializePageMentionMarkdown(props: PageMentionProps): string {
  const title = props.title.trim() || EMPTY_MENTION.title;
  const wikiTarget = (props.wikiTarget ?? "").trim();
  if (wikiTarget) {
    return serializeWikiLinkMarkdown(wikiTarget, title);
  }
  if (!props.pageId.trim()) {
    return serializeWikiLinkMarkdown(title, title);
  }
  const label = pageMentionLabel(props);
  return `[${escapeMarkdownLinkText(label)}](${serializePageMentionHref(props)})`;
}

export function pageMentionFromMarkdownLink(
  text: string,
  href: string,
): PageMentionProps | null {
  const parsed = parsePageMentionHref(href);
  if (!parsed) return null;
  const stripped = text.trim().replace(/^@/, "");
  return {
    pageId: parsed.pageId,
    workspaceId: parsed.workspaceId,
    title: stripped || EMPTY_MENTION.title,
    notebookName: "",
    wikiTarget: "",
  };
}

export function pageMentionFromWikiLink(inner: string): PageMentionProps | null {
  const parsed = parseWikiLinkInner(inner);
  if (!parsed) return null;
  const title = wikiLinkDisplayTitle(parsed);
  return {
    pageId: "",
    workspaceId: "",
    title: title || EMPTY_MENTION.title,
    notebookName: "",
    wikiTarget: parsed.target,
  };
}

export function wikiTargetFromReference(item: {
  title?: string;
  titleSnapshot?: string;
  localFilePath?: string;
  locationSnapshot?: string;
}): string {
  if (item.localFilePath) {
    const location = item.locationSnapshot?.trim() ?? "";
    const relative = location.includes(" · ")
      ? location.slice(location.indexOf(" · ") + 3).trim()
      : location;
    const fromLocation = stripWikiMarkdownExtension(relative.replace(/\\/g, "/"));
    if (fromLocation) return fromLocation;
    const base = item.localFilePath.split(/[\\/]/).pop() || "";
    return stripWikiMarkdownExtension(base);
  }
  return (item.titleSnapshot || item.title || "").trim();
}

export function mentionOpenPayload(
  props: Pick<PageMentionProps, "pageId" | "wikiTarget" | "title">,
): { pageId: string; wikiTarget: string } {
  return {
    pageId: props.pageId.trim(),
    wikiTarget: props.wikiTarget.trim() || props.title.trim(),
  };
}

export function isPageMentionInline(
  item: unknown,
): item is { type: typeof PAGE_MENTION_TYPE; props?: unknown } {
  return (
    Boolean(item) &&
    typeof item === "object" &&
    (item as { type?: unknown }).type === PAGE_MENTION_TYPE
  );
}
