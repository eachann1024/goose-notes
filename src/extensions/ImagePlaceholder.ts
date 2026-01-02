import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageUploadPanel } from '@/pages/workspace/components/editor/extensions/ImageUploadPanel'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imagePlaceholder: {
      setImagePlaceholder: () => ReturnType
    }
  }
}

export const ImagePlaceholder = Node.create({
  name: 'imagePlaceholder',

  group: 'block',

  atom: true,

  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="image-placeholder"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'image-placeholder' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageUploadPanel)
  },

  addCommands() {
    return {
      setImagePlaceholder:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          })
        },
    }
  },
})
