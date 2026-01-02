import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageResizer } from "@/components/extensions/ImageResizer";

export const ResizableImage = Image.extend({
  name: "imageResize",
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width") || null,
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            width: attributes.width,
          };
        },
      },
      height: {
        default: null,
      },
      containerStyle: {
        default: null,
        parseHTML: (element) => element.getAttribute("containerstyle") || null,
        renderHTML: (attributes) => {
          if (!attributes.containerStyle) return {};
          return {
            containerstyle: attributes.containerStyle,
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageResizer);
  },
});
