import type { OpenPageOptions } from "@/components/editor/platform/hostContext";

type OpenPageMention = (
  pageId: string,
  wikiTarget?: string,
  options?: OpenPageOptions,
) => boolean | void;

let openPageMention: OpenPageMention | null = null;

export function setPageMentionOpenHandler(handler: OpenPageMention | null) {
  openPageMention = handler;
}

export function requestOpenPageMention(
  pageId: string,
  wikiTarget?: string,
  options?: OpenPageOptions,
): boolean {
  if (!openPageMention) return false;
  const id = pageId.trim();
  const wiki = wikiTarget?.trim() ?? "";
  if (!id && !wiki) return false;
  return openPageMention(id, wiki || undefined, options) !== false;
}
