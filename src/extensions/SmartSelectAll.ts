import { Extension } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export const SmartSelectAll = Extension.create({
  name: 'smartSelectAll',

  addKeyboardShortcuts() {
    return {
      'Mod-a': () => {
        const { state, dispatch } = this.editor.view
        const { selection, doc } = state
        const { $from, $to } = selection

        // If selection spans multiple blocks, fallback to default (Select All Doc)
        // Notion behavior: selecting across blocks -> Cmd+A -> Select All Doc
        if (!$from.sameParent($to)) {
           return false 
        }

        const parent = $from.parent
        
        // If not a text block, let default handle
        if (!parent.isTextblock) {
            return false
        }

        // Calculate the range of the parent content
        const parentPos = $from.start()
        const parentEnd = $from.end()
        
        // Check if current selection covers the entire parent
        const isParentSelected = $from.pos === parentPos && $to.pos === parentEnd

        if (isParentSelected) {
            // Already selected the block content -> Allow default (Select Full Document)
            return false
        }

        // Select the entire parent content
        if (dispatch) {
            const tr = state.tr.setSelection(TextSelection.create(doc, parentPos, parentEnd))
            dispatch(tr)
        }
        return true
      }
    }
  }
})
