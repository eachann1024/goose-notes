
import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Text,
  TextQuote,
  Image as ImageIcon,
  CheckSquare,
  Code,
  Table2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandListProps {
  items: any[]
  command: any
  editor: any
}

export const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectItem = useCallback(
    (index: number) => {
      const item = props.items[index]
      if (item) {
        props.command(item)
      }
    },
    [props]
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  // 滚动到选中项
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const selectedEl = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev - 1 + props.items.length) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }), [props.items.length, selectItem, selectedIndex])

  return (
    <div
      ref={containerRef}
      className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-all animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
    >
      <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1">基础块</div>
      {props.items.map((item, index) => {
        const Icon = item.icon
        return (
          <button
            key={index}
            data-index={index}
            className={cn(
              "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none w-full text-left gap-2",
              index === selectedIndex ? "bg-accent text-accent-foreground" : ""
            )}
            onClick={() => selectItem(index)}
          >
            <div className="flex items-center justify-center p-1 rounded-sm border bg-background shrink-0 text-muted-foreground">
               <Icon className="h-4 w-4" />
            </div>
            <div>
                <p className="font-medium">{item.title}</p>
                 {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                 )}
            </div>
          </button>
        )
      })}
    </div>
  )
})

export const getSuggestionItems = ({ query }: { query: string }) => {
  return [
    {
      title: '文本',
      description: '开始输入纯文本',
      searchTerms: ['p', 'paragraph'],
      icon: Text,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode('paragraph', 'paragraph')
          .run()
      },
    },
    {
      title: '待办列表',
      description: '使用待办事项跟踪任务',
      searchTerms: ['todo', 'task', 'list', 'check', 'checkbox'],
      icon: CheckSquare,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleTaskList()
          .run()
      },
    },
    {
      title: '一级标题',
      description: '大标题',
      searchTerms: ['h1', 'heading1', 'title'],
      icon: Heading1,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 1 })
          .run()
      },
    },
    {
      title: '二级标题',
      description: '中等标题',
      searchTerms: ['h2', 'heading2', 'subtitle'],
      icon: Heading2,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 2 })
          .run()
      },
    },
    {
      title: '三级标题',
      description: '小标题',
      searchTerms: ['h3', 'heading3', 'subtitle'],
      icon: Heading3,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode('heading', { level: 3 })
          .run()
      },
    },
    {
      title: '项目列表',
      description: '创建一个简单的项目列表',
      searchTerms: ['ul', 'unordered'],
      icon: List,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleBulletList()
          .run()
      },
    },
    {
      title: '有序列表',
      description: '创建一个有序列表',
      searchTerms: ['ol', 'ordered'],
      icon: ListOrdered,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleOrderedList()
          .run()
      },
    },
    {
      title: '引用',
      description: '引用一段文本',
      searchTerms: ['quote', 'blockquote'],
      icon: TextQuote,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleBlockquote()
          .run()
      },
    },
    {
      title: '代码块',
      description: '插入代码片段',
      searchTerms: ['codeblock'],
      icon: Code,
      command: ({ editor, range }: any) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleCodeBlock()
          .run()
      },
    },
    {
       title: '图片',
       description: '上传或嵌入图片',
       searchTerms: ['image', 'picture', 'file'],
       icon: ImageIcon,
       command: ({ editor, range }: any) => {
           editor.chain().focus().deleteRange(range).run()
           const url = window.prompt("Image URL:")
           if (url) {
               editor.chain().focus().setImage({ src: url }).run()
           }
       }
    },
    {
       title: '表格',
       description: '插入一个表格',
       searchTerms: ['table', 'grid', 'biaoge'],
       icon: Table2,
       command: ({ editor, range }: any) => {
           editor
             .chain()
             .focus()
             .deleteRange(range)
             .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
             .run()
       }
    }
  ].filter((item) => {
    if (typeof query === 'string' && query.length > 0) {
      const search = query.toLowerCase()
      return (
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        (item.searchTerms && item.searchTerms.some((term: string) => term.includes(search)))
      )
    }
    return true
  })
}
