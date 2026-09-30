import type { Page as NotePage } from "../../src/types";
import type { BlockNoteContent } from "../../src/components/editor/utils/blocknote-content";

/** 1x1 透明 PNG，锁定导出走 data:image 而不是 Markdown 附件占位。 */
export const HTML_VISUAL_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const HTML_VISUAL_CHINESE_BODY = "本周要完成导出风格验收。";

/** 风格一致契约用的最小页面：H2 色带、中文、勾选待办、内联图。 */
export function buildHtmlVisualExportPage(): NotePage {
  const content = [
    {
      id: "week-heading",
      type: "heading",
      props: {
        level: 2,
        backgroundColor: "purple",
        textAlignment: "center",
      },
      content: [{ type: "text", text: "第二周", styles: {} }],
      children: [],
    },
    {
      id: "week-body",
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: HTML_VISUAL_CHINESE_BODY, styles: {} }],
      children: [],
    },
    {
      id: "done-item",
      type: "checkListItem",
      props: { checked: true },
      content: [{ type: "text", text: "已完成事项", styles: {} }],
      children: [],
    },
    {
      id: "todo-item",
      type: "checkListItem",
      props: { checked: false },
      content: [{ type: "text", text: "未完成事项", styles: {} }],
      children: [],
    },
    {
      id: "pixel-image",
      type: "image",
      props: { url: HTML_VISUAL_PIXEL_PNG, caption: "像素" },
      content: [],
      children: [],
    },
  ] as BlockNoteContent;

  return {
    id: "page-html-visual",
    workspaceId: "notebook-html-visual",
    isFolder: false,
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    createdAt: 1,
    updatedAt: 1,
    content,
  };
}
