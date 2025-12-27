
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { CommandList, getSuggestionItems } from '@/components/CommandList'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range })
        },
      },
      chineseTrigger: '、'
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
      // Plugin to handle Chinese '、' -> '/' trigger
      new Plugin({
          key: new PluginKey('chineseSlashTrigger'),
          props: {
              handleTextInput: (view, from, to, text) => {
                  if (text === '、') {
                      const tr = view.state.tr.insertText('/', from, to)
                      view.dispatch(tr)
                      return true
                  }
                  return false
              }
          }
      })
    ]
  },
})

export const configureSlashCommand = () => {
    return SlashCommand.configure({
        suggestion: {
            items: getSuggestionItems,
            render: () => {
                let component: any
                let popup: any
        
                return {
                  onStart: (props: any) => {
                    component = new ReactRenderer(CommandList, {
                      props,
                      editor: props.editor,
                    })
        
                    if (!props.clientRect) {
                      return
                    }
        
                    popup = tippy('body', {
                      getReferenceClientRect: props.clientRect,
                      appendTo: () => document.body,
                      content: component.element,
                      showOnCreate: true,
                      interactive: true,
                      trigger: 'manual',
                      placement: 'bottom-start',
                    })
                  },
        
                  onUpdate(props: any) {
                    component.updateProps(props)
        
                    if (!props.clientRect) {
                      return
                    }
        
                    popup[0].setProps({
                      getReferenceClientRect: props.clientRect,
                    })
                  },
        
                  onKeyDown(props: any) {
                    if (props.event.key === 'Escape') {
                      popup[0].hide()
        
                      return true
                    }
        
                    return component.ref?.onKeyDown(props)
                  },
        
                  onExit() {
                    popup[0].destroy()
                    component.destroy()
                  },
                }
              },
        }
    })
}
