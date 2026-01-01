
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import HighlightExtension from '@tiptap/extension-highlight'
import AutoJoiner from 'tiptap-extension-auto-joiner'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { CodeBlockWithLanguageExtension } from '@/extensions/CodeBlockWithLanguage'
import { Markdown } from 'tiptap-markdown'
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
import { ImageWithAlign } from '@/extensions/ImageWithAlign'
import { CustomGlobalDragHandle } from '@/extensions/CustomGlobalDragHandle'
import { ImagePlaceholder } from '@/extensions/ImagePlaceholder'
import { EditorBubbleMenu } from '@/components/EditorBubbleMenu'
import { ImageBubbleMenu } from '@/components/ImageBubbleMenu'
import { getImageFromClipboard, processImageForStorage } from '@/lib/imageProcessor'
import 'tippy.js/dist/tippy.css'
import { SmartSelectAll } from '@/extensions/SmartSelectAll'


import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useSettings } from '@/stores/useSettings'
import { Search, Scissors, Copy, Clipboard } from 'lucide-react'






// Initialize lowlight with all languages
const lowlight = createLowlight(all)

interface EditorProps {
  editable?: boolean
}

export function Editor({ editable = true }: EditorProps) {
  const { activePageId, getPage, updatePage } = usePages()
  const page = activePageId ? getPage(activePageId) : undefined
  const { searchProviders } = useSettings()

  const prevPageIdRef = useRef<string | null>(null)
  const debouncedUpdateRef = useRef<any>(null)
  // 追踪哪个页面的内容已经加载完成，只有该页面的更新才会被保存
  // null 表示没有页面内容被加载（编辑器正在重建中）
  const pageIdForUpdateRef = useRef<string | null>(null)

  const debouncedUpdate = useMemo(() => {
    const fn = debounce((id: string, content: any) => {
      updatePage(id, { content })
    }, 1000)
    debouncedUpdateRef.current = fn
    return fn
  }, [updatePage])

   useEffect(() => {
    const flush = () => debouncedUpdateRef.current?.flush()

    window.addEventListener('beforeunload', flush)

    if ((window as any).utools) {
      (window as any).utools.onPluginOut(flush)
    }

    window.addEventListener('goose-note:flush-editor', flush)

    return () => {
      flush()
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('goose-note:flush-editor', flush)
    }
  }, [])

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 使用 CodeBlockLowlight 替代
        link: false, // 单独配置 Link 扩展
        dropcursor: {
          color: 'hsl(221.2, 83.2%, 53.3%)', // primary color
          width: 3,
        },
      }),
      AutoJoiner,
      Placeholder.configure({
        placeholder: '输入 / 以使用命令...',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      ImageWithAlign,
      ImagePlaceholder,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlockWithLanguageExtension.configure({
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
      CustomGlobalDragHandle.configure({
        dragHandleWidth: 24,
        scrollTreshold: 100,
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        linkify: false,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
      SmartSelectAll,
    ],
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] leading-relaxed',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      // 只有当前页面内容已加载后才触发保存
      // 使用 pageIdForUpdateRef 而不是 activePageId，确保只为正确加载的页面保存
      const safePageId = pageIdForUpdateRef.current
      if (safePageId) {
        debouncedUpdate(safePageId, editor.getJSON())
      }
    },
  }) // 不依赖 activePageId，保持编辑器实例不变

  // Sync content when page changes (only when activePageId actually changes)
  useEffect(() => {
    // 只在页面 ID 真正切换时才同步内容
    if (activePageId !== prevPageIdRef.current) {
      // 切换页面前，先 flush 之前的 debounce，确保旧页面内容已保存
      debouncedUpdateRef.current?.flush()

      // 重置页面 ID 标记，防止在加载新内容前触发保存
      pageIdForUpdateRef.current = null

      prevPageIdRef.current = activePageId

      if (editor && page && activePageId) {
        editor.commands.blur()
        editor.commands.setContent(page.content, { emitUpdate: false })

        // 内容加载完成，记录当前页面 ID，允许保存
        pageIdForUpdateRef.current = activePageId

        const firstPos = editor.state.doc.content.size > 0 ? 1 : 0
        if (firstPos > 0) {
          editor.commands.setTextSelection(firstPos)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, page, editor])

  useEffect(() => {
     if (editor) {
        editor.setEditable(editable)
     }
  }, [editor, editable])

  // 剪切板粘贴图片处理
  useEffect(() => {
    if (!editor) return

    const handlePaste = async (event: ClipboardEvent) => {
      const imageFile = getImageFromClipboard(event)
      if (!imageFile) return

      // 阻止默认行为，由我们处理图片
      event.preventDefault()

      try {
        const base64 = await processImageForStorage(imageFile)
        editor.chain().focus().setImage({ src: base64 }).run()
      } catch (err) {
        console.error('Failed to paste image:', err)
      }
    }

    // 监听编辑器 DOM 的 paste 事件
    const editorElement = editor.view.dom
    editorElement.addEventListener('paste', handlePaste)

    return () => {
      editorElement.removeEventListener('paste', handlePaste)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return

    const handleFocusStart = () => {
      editor.chain().focus('start').insertContentAt(0, { type: 'paragraph' }).focus('start').run()
    }

    window.addEventListener('goose-note:focus-editor-start', handleFocusStart)
    return () => {
      window.removeEventListener('goose-note:focus-editor-start', handleFocusStart)
    }
  }, [editor])


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
    <div className={cn(fontFamilyClass, fontSizeClass, widthClass)}>
       <EditorBubbleMenu editor={editor} />
       <ImageBubbleMenu editor={editor} />
       <ContextMenu>
        <ContextMenuTrigger>
          <EditorContent editor={editor} />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-[160px]">
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
