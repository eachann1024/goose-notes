
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
import { useEffect, useMemo } from 'react'
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

  // Sync content when page changes
  useEffect(() => {
    if (editor && page && activePageId) {
      // Check if content is actually different to avoid cursor jumping?
      // For simple page switching, re-setting content is fine.
      // But if we use external updates (e.g. sync), we need to be careful.
      // For now, assume single user single active session.
      
      // Only set content if it's different or editor is empty (initial load)
      // JSON comparison is expensive, but for page switch it's okay.
      // A better way is relying on the key change of the editor component or dependencies.
      
      // Since we listed activePageId in dependency array of useEditor, 
      // the editor instance is recreated when switching pages.
      // So we just set the initial content.
      editor.commands.setContent(page.content)
    }
  }, [editor, page, activePageId])

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
               <ContextMenuItem inset disabled className="text-xs text-muted-foreground">
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
                   inset 
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
           <ContextMenuItem inset onSelect={() => {
               const { from, to } = editor.state.selection
               const text = editor.state.doc.textBetween(from, to, ' ')
               navigator.clipboard.writeText(text)
               editor?.commands.deleteSelection()
           }}>
             <Scissors className="mr-2 h-4 w-4" />
             剪切
             <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘X</span>
           </ContextMenuItem>
           <ContextMenuItem inset onSelect={() => {
              const { from, to } = editor.state.selection
              const text = editor.state.doc.textBetween(from, to, ' ')
              navigator.clipboard.writeText(text)
           }}>
             <Copy className="mr-2 h-4 w-4" />
             拷贝
             <span className="ml-auto text-xs tracking-widest text-muted-foreground">⌘C</span>
           </ContextMenuItem>
           <ContextMenuItem inset onSelect={async () => {
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
