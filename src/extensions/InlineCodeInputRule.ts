import { Extension, markInputRule } from "@tiptap/core";

export const InlineCodeInputRule = Extension.create({
  name: "inlineCodeInputRule",

  addInputRules() {
    return [
      markInputRule({
        find: /`([^`]+)`$/,
        type: this.editor.schema.marks.code,
      }),
    ];
  },
});
