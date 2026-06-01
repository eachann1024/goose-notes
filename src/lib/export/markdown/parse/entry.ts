import type { BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import type { ImportResult } from "../parse";
import {
  normalizeBlockContent,
  normalizePageContent,
  createEmptyBlockNoteContent,
} from "@/components/editor/utils/blocknote-content";
import { markdownToJsonContent } from "./block";

export function importFromMarkdown(
  markdown: string,
  filename?: string,
): ImportResult {
  try {
    const legacyContent = markdownToJsonContent(markdown);
    const content = normalizePageContent(legacyContent);

    let title = filename || "导入的页面";
    if (!filename) {
      const h1Match = markdown.match(/^#\s+(.+)$/m);
      if (h1Match) {
        title = h1Match[1].trim();
      }
    }

    return { title, content, success: true };
  } catch (e) {
    return {
      title: "",
      content: createEmptyBlockNoteContent(),
      success: false,
      error: "解析 Markdown 失败",
    };
  }
}

export function importMarkdownFragment(markdown: string): BlockNoteContent | null {
  try {
    const parsed = markdownToJsonContent(markdown);
    const content = normalizeBlockContent(
      Array.isArray(parsed) ? parsed : parsed?.content,
    );
    return content.length > 0 ? content : null;
  } catch {
    return null;
  }
}
