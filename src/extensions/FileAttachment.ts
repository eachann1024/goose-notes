import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileAttachmentCard } from "@/pages/workspace/components/editor/extensions/FileAttachmentCard";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attrs: {
        storageRef: string;
        fileName: string;
        mimeType: string;
        size: number;
        uploadedAt: number;
      }) => ReturnType;
    };
  }
}

export const FileAttachment = Node.create({
  name: "fileAttachment",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      storageRef: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-storage-ref") || "",
        renderHTML: (attributes) =>
          attributes.storageRef
            ? { "data-storage-ref": attributes.storageRef }
            : {},
      },
      fileName: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-file-name") || "",
        renderHTML: (attributes) =>
          attributes.fileName ? { "data-file-name": attributes.fileName } : {},
      },
      mimeType: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mime-type") || "",
        renderHTML: (attributes) =>
          attributes.mimeType ? { "data-mime-type": attributes.mimeType } : {},
      },
      size: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-size") || 0),
        renderHTML: (attributes) =>
          Number.isFinite(attributes.size) ? { "data-size": String(attributes.size) } : {},
      },
      uploadedAt: {
        default: 0,
        parseHTML: (element) =>
          Number(element.getAttribute("data-uploaded-at") || 0),
        renderHTML: (attributes) =>
          Number.isFinite(attributes.uploadedAt)
            ? { "data-uploaded-at": String(attributes.uploadedAt) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-attachment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "file-attachment" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentCard);
  },

  addCommands() {
    return {
      setFileAttachment:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});
