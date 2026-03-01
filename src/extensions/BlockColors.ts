import { Extension } from "@tiptap/core";

/**
 * BlockColors 扩展：为所有块级节点添加 blockTextColor / blockBgColor 属性，
 * 用于块级别的字体颜色和背景颜色，区别于内联 TextStyle/Color。
 */
export const BlockColors = Extension.create({
  name: "blockColors",

  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "bulletList",
          "orderedList",
          "listItem",
          "taskList",
          "taskItem",
          "callout",
          "horizontalRule",
          "codeBlock",
        ],
        attributes: {
          blockTextColor: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-block-text-color") || null,
            renderHTML: (attributes) => {
              if (!attributes.blockTextColor) return {};
              return { "data-block-text-color": attributes.blockTextColor };
            },
          },
          blockBgColor: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-block-bg-color") || null,
            renderHTML: (attributes) => {
              if (!attributes.blockBgColor) return {};
              return { "data-block-bg-color": attributes.blockBgColor };
            },
          },
        },
      },
    ];
  },
});
