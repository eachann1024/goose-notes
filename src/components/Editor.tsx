
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import HighlightExtension from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { all, createLowlight } from 'lowlight'
import { useEffect, useMemo, useRef } from 'react'
import debounce from 'lodash.debounce'
import { usePages } from '@/stores/usePages'
import { cn } from '@/lib/utils'
import { configureSlashCommand } from '@/extensions/SlashCommand'
import { ResizableImage } from '@/extensions/ResizableImage'
import { EditorBubbleMenu } from '@/components/EditorBubbleMenu'
import 'tippy.js/dist/tippy.css'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useSettings } from '@/stores/useSettings'
import { Search, Scissors, Copy, Clipboard } from 'lucide-react'

// Initialize lowlight for code syntax highlighting
const lowlight = createLowlight(all)

interface EditorProps {
  editable?: boolean
}

export function Editor({ editable = true }: EditorProps) {
  const { activePageId, getPage, updatePage } = usePages()
  const page = activePageId ? getPage(activePageId) : undefined
  const { searchProviders } = useSettings()

  // 记录上次的页面 ID，用于判断是否真正切换了页面
  const prevPageIdRef = useRef<string | null>(null)

  // Create a debounced update function
  const debouncedUpdate = useMemo(
    () =>
      debounce((id: string, content: any) => {
        updatePage(id, { content })
      }, 1000),
    [updatePage]
  )

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 使用 CodeBlockLowlight 替代
      }),
      Placeholder.configure({
        placeholder: '输入 / 以使用命令...',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      ResizableImage,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      HighlightExtension,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      configureSlashCommand(),
    ],
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)]',
          // Font styles will be applied via dynamic classes or style prop on wrapper
        ),
      },
    },
    onUpdate: ({ editor }) => {
      if (activePageId) {
        debouncedUpdate(activePageId, editor.getJSON())
      }
    },
  }, [activePageId]) // Re-create editor when activePageId changes (simplest strategy suitable for this structure)

  // Sync content when page changes (only when activePageId actually changes)
  useEffect(() => {
    // 只在页面 ID 真正切换时才同步内容
    if (activePageId !== prevPageIdRef.current) {
      prevPageIdRef.current = activePageId

      if (editor && page && activePageId) {
        // 先让 editor 失焦，避免加载内容时触发 Slash Command
        editor.commands.blur()

        // 设置内容，不触发更新事件（避免触发 Suggestion 插件）
        editor.commands.setContent(page.content, false)

        // 将光标移到文档开头，避免停留在 / 附近触发菜单
        editor.commands.setTextSelection(0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, page, editor])

  useEffect(() => {
     if (editor) {
        editor.setEditable(editable)
     }
  }, [editor, editable])

  // Apply font family
  const fontFamilyClass = useMemo(() => {
     if (!page) return ''
     switch (page.fontFamily) {
        case 'serif': return 'font-serif'
        case 'mono': return 'font-mono'
        default: return 'font-sans'
     }
  }, [page?.fontFamily])
  
  const fontSizeClass = useMemo(() => {
      if (!page) return ''
      return page.fontSize === 'small' ? 'text-sm' : 'text-base'
  }, [page?.fontSize])
  
  const widthClass = useMemo(() => {
     if (!page) return 'max-w-3xl mx-auto'
     return page.isFullWidth ? 'max-w-full px-4' : 'max-w-3xl mx-auto'
  }, [page?.isFullWidth])

  if (!editor || !page) {
    return null
  }

  return (
    <div className={cn("transition-all duration-300", fontFamilyClass, fontSizeClass, widthClass)}>
       <EditorBubbleMenu editor={editor} />
       <ContextMenu>
        <ContextMenuTrigger>
          <EditorContent editor={editor} />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
           {editor && !editor.state.selection.empty && (
             <>
               <ContextMenuItem disabled className="text-xs text-muted-foreground">
                 {(() => {
                    const { from, to } = editor.state.selection
                    const text = editor.state.doc.textBetween(from, to, ' ')
                    return text.length > 20 ? text.slice(0, 20) + '...' : text
                 })()}
               </ContextMenuItem>
               <ContextMenuSeparator />
               {searchProviders.filter(p => p.isEnabled).map(provider => (
                 <ContextMenuItem
                   key={provider.id}
                   onSelect={() => {
                     const { from, to } = editor.state.selection
                     const text = editor.state.doc.textBetween(from, to, ' ')
                     const url = provider.urlTemplate.replace('%s', encodeURIComponent(text))
                     window.open(url, '_blank')
                   }}
                 >
                   <Search className="mr-2 h-4 w-4" />
                   用 {provider.name} 搜索
                 </ContextMenuItem>
               ))}
               <ContextMenuSeparator />
             </>
           )}
           <ContextMenuItem onSelect={() => {
               const { from, to } = editor.state.selection
               const text = editor.state.doc.textBetween(from, to, ' ')
               navigator.clipboard.writeText(text)
               editor?.commands.deleteSelection()
           }}>
             <Scissors className="mr-2 h-4 w-4" />
             剪切
             <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘X</span>
           </ContextMenuItem>
           <ContextMenuItem onSelect={() => {
              const { from, to } = editor.state.selection
              const text = editor.state.doc.textBetween(from, to, ' ')
              navigator.clipboard.writeText(text)
           }}>
             <Copy className="mr-2 h-4 w-4" />
             拷贝
             <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘C</span>
           </ContextMenuItem>
           <ContextMenuItem onSelect={async () => {
              try {
                const text = await navigator.clipboard.readText()
                editor?.commands.insertContent(text)
              } catch (err) {
                console.error('Failed to read clipboard contents: ', err)
              }
           }}>
             <Clipboard className="mr-2 h-4 w-4" />
             粘贴
             <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘V</span>
           </ContextMenuItem>
        </ContextMenuContent>
       </ContextMenu>
    </div>
  )
}
