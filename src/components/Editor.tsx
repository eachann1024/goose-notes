
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { all, createLowlight } from 'lowlight'
import { useEffect, useMemo } from 'react'
import debounce from 'lodash.debounce'
import { usePages } from '@/stores/usePages'
import { cn } from '@/lib/utils'
import { configureSlashCommand } from '@/extensions/SlashCommand'
import { EditorBubbleMenu } from '@/components/EditorBubbleMenu'
import 'tippy.js/dist/tippy.css'

// Initialize lowlight for code syntax highlighting
const lowlight = createLowlight(all)

interface EditorProps {
  editable?: boolean
}

export function Editor({ editable = true }: EditorProps) {
  const { activePageId, getPage, updatePage } = usePages()
  const page = activePageId ? getPage(activePageId) : undefined

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
      StarterKit,
      Placeholder.configure({
        placeholder: '输入 / 以使用命令...',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
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
       <EditorContent editor={editor} />
    </div>
  )
}
