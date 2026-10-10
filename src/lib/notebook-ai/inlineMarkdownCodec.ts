import { importMarkdownFragment } from "@/lib/export/markdown/parse";
import { jsonContentToMarkdown } from "@/lib/export/markdown/serialize";
import { encodeBlockPropsMarkers } from "@/lib/export/markdown/blockPropsMarker";
import { parseAiMarkdownToBlocks } from "@/lib/notebook-ai/markdown";
import { explodeAiGeneratedBlocks } from "@/lib/ai-write/explodeAiGeneratedBlocks";
import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";

import type { InlineMarkdownEditor } from "./inlineMarkdownApply";

export function serializeBlocksToMarkdown(
  editor: InlineMarkdownEditor,
  blocks: unknown[],
): string {
  try {
    return jsonContentToMarkdown(
      encodeBlockPropsMarkers(blocks as BlockNoteContent),
    );
  } catch {
    // fall through
  }
  if (typeof editor.blocksToMarkdownLossy === "function") {
    try {
      return editor.blocksToMarkdownLossy(blocks as never);
    } catch {
      // fall through
    }
  }
  return jsonContentToMarkdown(blocks as BlockNoteContent);
}

export function parseMarkdownToBlocks(
  editor: InlineMarkdownEditor,
  markdown: string,
): unknown[] {
  const fromAi = parseAiMarkdownToBlocks(markdown);
  if (fromAi.length > 0) return fromAi;

  if (typeof editor.tryParseMarkdownToBlocks === "function") {
    try {
      const parsed = editor.tryParseMarkdownToBlocks(markdown);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const exploded = explodeAiGeneratedBlocks(parsed);
        return exploded.length > 0 ? exploded : parsed;
      }
    } catch {
      // fall through
    }
  }
  const fragment = importMarkdownFragment(markdown);
  if (!fragment || fragment.length === 0) {
    throw new Error("AI 返回的内容无法解析为有效块。");
  }
  const exploded = explodeAiGeneratedBlocks(fragment);
  return exploded.length > 0 ? exploded : fragment;
}
