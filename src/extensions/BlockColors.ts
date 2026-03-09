import { Extension } from "@tiptap/core";

const BLOCK_COLOR_TYPES = [
  "paragraph",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "callout",
  "horizontalRule",
  "codeBlock",
] as const;

function createBlockColorAttribute(
  dataAttribute: "data-block-text-color" | "data-block-bg-color",
  keepOnSplit = true,
) {
  return {
    default: null,
    keepOnSplit,
    parseHTML: (element: HTMLElement) =>
      element.getAttribute(dataAttribute) || null,
    renderHTML: (attributes: Record<string, string | null>) => {
      const value = dataAttribute === "data-block-text-color"
        ? attributes.blockTextColor
        : attributes.blockBgColor;
      if (!value) return {};
      return { [dataAttribute]: value };
    },
  };
}

/**
 * BlockColors 扩展：为所有块级节点添加 blockTextColor / blockBgColor 属性，
 * 用于块级别的字体颜色和背景颜色，区别于内联 TextStyle/Color。
 */
export const BlockColors = Extension.create({
  name: "blockColors",

  addGlobalAttributes() {
    return [
      {
        // heading 回车通常表示“退出标题并新起正文”，不应把块颜色带到新段落。
        types: ["heading"],
        attributes: {
          blockTextColor: createBlockColorAttribute(
            "data-block-text-color",
            false,
          ),
          blockBgColor: createBlockColorAttribute(
            "data-block-bg-color",
            false,
          ),
        },
      },
      {
        types: [...BLOCK_COLOR_TYPES],
        attributes: {
          blockTextColor: createBlockColorAttribute("data-block-text-color"),
          blockBgColor: createBlockColorAttribute("data-block-bg-color"),
        },
      },
    ];
  },
});
