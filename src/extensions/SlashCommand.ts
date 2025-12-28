
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { CommandList, getSuggestionItems } from '@/components/CommandList'
import { InputRule } from '@tiptap/core'

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
    }
  },

  addInputRules() {
    // 中文顿号 '、' 自动转换为 '/' 触发斜杠命令
    return [
      new InputRule({
        find: /、$/,
        handler: ({ state, range }) => {
          const { tr } = state
          tr.insertText('/', range.from, range.to)
        },
      }),
    ]
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
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
                      arrow: false,
                      theme: 'notion-slash',
                      offset: [0, 8],
                    })
                  },
        
                  onUpdate(props: any) {
                    component.updateProps(props)
        
                    if (!props.clientRect) {
                      return
                    }
        
                    popup?.[0]?.setProps({
                      getReferenceClientRect: props.clientRect,
                    })
                  },
        
                  onKeyDown(props: any) {
                    if (props.event.key === 'Escape') {
                      popup?.[0]?.hide()
        
                      return true
                    }
        
                    return component.ref?.onKeyDown(props)
                  },
        
                  onExit() {
                    popup?.[0]?.destroy()
                    component?.destroy()
                  },
                }
              },
        }
    })
}
