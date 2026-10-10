import type { JSONContent } from "@/types";
import {
  createEmptyBlockNoteContent,
  clonePageContent as cloneBlockNotePageContent,
  normalizePageContent,
  createEmptyLocalPageContent,
} from "@/components/editor/utils/blocknote-content";
import { UNTITLED_PAGE_TITLE } from "@/components/editor/utils/page-title";
import { requestPageTitleFocus } from "@/lib/page-title-focus";
import { effectiveSingleTabMode } from "@/lib/tabMode";

export const initialContent: JSONContent =
  createEmptyBlockNoteContent(UNTITLED_PAGE_TITLE);

/**
 * 新建页聚焦策略：
 * - 单标签 / 本地文件：页头或标签 pill 上的 SingleTabTitle 响应 requestPageTitleFocus
 * - 多个文档标签 + 内部页：focus-editor-start 把光标放到首块 H1 标题末尾
 */
export function focusNewPage(pageId: string, focusEditorStart = false) {
  requestPageTitleFocus(pageId);
  if (!focusEditorStart || effectiveSingleTabMode()) {
    return;
  }
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("goose-note:focus-editor-start"));
    }, 100);
  }
}

export function createDefaultPageContent(
  title = UNTITLED_PAGE_TITLE,
): JSONContent {
  return createEmptyBlockNoteContent(title);
}

export function clonePageContent(content?: JSONContent | null) {
  if (!content) {
    return cloneBlockNotePageContent(initialContent);
  }
  return cloneBlockNotePageContent(normalizePageContent(content));
}

// local-folder 页面标题由标签栏中的文件名承担，内容不存在
// 「首块必须是 H1」的约束，克隆时禁止 ensureFirstTitleHeading 注入空标题块。
export function cloneLocalPageContent(content?: JSONContent | null) {
  if (!content) {
    return cloneBlockNotePageContent(createEmptyLocalPageContent());
  }
  return cloneBlockNotePageContent(
    normalizePageContent(content, { ensureFirstTitle: false }),
  );
}
