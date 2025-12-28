import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageResizer } from '@/components/extensions/ImageResizer'

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: attributes => {
            if(!attributes.width) return {}
            return {
                style: `width: ${attributes.width}px`
            }
        }
      },
      height: {
        default: null,
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageResizer)
  },
})
