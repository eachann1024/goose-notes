
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
        // 只在用户主动输入 / 时触发，而不是在内容中已存在 / 时触发
        allow: ({ state, range }: { state: any; range: any }) => {
          // 检查 / 是否在行首或空格后，避免误触发已有内容中的 /
          const $from = state.doc.resolve(range.from)
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 1),
            $from.parentOffset,
            null,
            '\ufffc'
          )
          // 只有当 / 前面是空格、行首或者没有字符时才允许触发
          return textBefore === '' || textBefore === ' ' || textBefore === '\n'
        },
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
