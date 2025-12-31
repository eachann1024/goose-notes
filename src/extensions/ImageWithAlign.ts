import ImageResize from 'tiptap-extension-resize-image'

export const ImageWithAlign = ImageResize.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'left',
        parseHTML: element => element.getAttribute('align') || 'left',
        renderHTML: attributes => {
          return {
            align: attributes.align,
          }
        },
      },
    }
  },
})
