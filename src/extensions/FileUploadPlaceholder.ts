import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileUploadPanel } from "@/pages/workspace/components/editor/extensions/FileUploadPanel";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileUploadPlaceholder: {
      setFileUploadPlaceholder: () => ReturnType;
    };
  }
}

export const FileUploadPlaceholder = Node.create({
  name: "fileUploadPlaceholder",

  group: "block",

  atom: true,

  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="file-upload-placeholder"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-upload-placeholder" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileUploadPanel);
  },

  addCommands() {
    return {
      setFileUploadPlaceholder:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
          }),
    };
  },
});
