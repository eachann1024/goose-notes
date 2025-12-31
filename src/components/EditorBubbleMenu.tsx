import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Italic, Strikethrough, Code, Highlighter } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'

type EditorBubbleMenuProps = Omit<React.ComponentProps<typeof BubbleMenu>, 'children'>

export function EditorBubbleMenu({ editor, ...props }: EditorBubbleMenuProps) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center space-x-1 rounded-md border border-border bg-popover p-1 shadow-md backdrop-blur-sm"
      shouldShow={({ editor, state }) => {
        const { selection } = state

        // 如果选中了图片，或者是一个 NodeSelection (选中整个节点)，则不显示文本工具栏
        // 这里的工具栏只有 Bold/Italic 等文本样式，不适用于图片或整个块级元素
        if (editor.isActive('image') || 'node' in selection) {
          return false
        }

        // 必须有选中的文本才显示
        return !selection.empty
      }}
      {...props}
    >
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Toggle bold"
        className="text-foreground"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Toggle italic"
        className="text-foreground"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Toggle strikethrough"
        className="text-foreground"
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="h-6" />

      <Toggle
        size="sm"
        pressed={editor.isActive('code')}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        aria-label="Toggle code"
        className="text-foreground"
      >
        <Code className="h-4 w-4" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={editor.isActive('highlight')}
        onPressedChange={() => editor.chain().focus().toggleHighlight().run()}
        aria-label="Toggle highlight"
        className="text-foreground"
      >
        <Highlighter className="h-4 w-4" />
      </Toggle>
    </BubbleMenu>
  )
}
