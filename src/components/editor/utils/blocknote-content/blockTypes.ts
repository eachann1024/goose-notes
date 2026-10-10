export const VALID_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "table",
  "image",
  "video",
  "file",
  "audio",
  "codeBlock",
  "quote",
  "callout",
  "alert",
  "link",
  "embed",
  "toggleListItem",
  "divider",
]);

export const LEGACY_BLOCK_TYPES = new Set([
  "blockquote",
  "paragraph",
  "heading",
  "codeBlock",
  "bulletList",
  "orderedList",
  "taskList",
  "table",
  "image",
  "imageResize",
  "horizontalRule",
]);

export const INLINE_CONTENT_TYPES = new Set(["text", "link", "pageMention"]);
