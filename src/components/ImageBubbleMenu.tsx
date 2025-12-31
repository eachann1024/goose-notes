import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

type ImageBubbleMenuProps = Omit<React.ComponentProps<typeof BubbleMenu>, 'children'>

// 辅助函数：根据当前对齐状态判断 pressed
function getAlignFromStyle(style: string | null | undefined): 'left' | 'center' | 'right' {
  if (!style) return 'left'
  if (style.includes('margin: 0 auto;') || style.includes('margin: 0px auto')) return 'center'
  if (style.includes('margin: 0 0 0 auto') || style.includes('margin: 0px 0px 0px auto')) return 'right'
  return 'left'
}

// 辅助函数：生成新的 containerStyle
function setAlignStyle(currentStyle: string | null | undefined, align: 'left' | 'center' | 'right'): string {
  // 移除已有的 margin 样式
  const baseStyle = (currentStyle || '').replace(/margin:[^;]*;?/g, '').trim()
  const marginMap = {
    left: 'margin: 0 auto 0 0;',
    center: 'margin: 0 auto;',
    right: 'margin: 0 0 0 auto;',
  }
  return `${baseStyle} ${marginMap[align]}`.trim()
}

export function ImageBubbleMenu({ editor, ...props }: ImageBubbleMenuProps) {
  if (!editor) return null

  // 使用 editor.getAttributes 直接获取当前激活节点的属性
  const attrs = editor.getAttributes('imageResize')
  const currentAlign = getAlignFromStyle(attrs?.containerStyle)

  const handleAlign = (align: 'left' | 'center' | 'right') => {
    const { selection } = editor.state
    const nodeSelection = selection as any
    if (nodeSelection.node && nodeSelection.node.type.name === 'imageResize') {
      const newStyle = setAlignStyle(nodeSelection.node.attrs.containerStyle, align)
      editor.chain().focus().updateAttributes('imageResize', { containerStyle: newStyle }).run()
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center space-x-1 rounded-md border border-border bg-popover p-1 shadow-md backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-150"
      shouldShow={({ editor }: { editor: Editor }) => {
        return editor.isActive('imageResize')
      }}
      {...props}
    >
      <Toggle
        size="sm"
        pressed={currentAlign === 'left'}
        onPressedChange={() => handleAlign('left')}
        aria-label="Align left"
        className="text-foreground"
      >
        <AlignLeft className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={currentAlign === 'center'}
        onPressedChange={() => handleAlign('center')}
        aria-label="Align center"
        className="text-foreground"
      >
        <AlignCenter className="h-4 w-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={currentAlign === 'right'}
        onPressedChange={() => handleAlign('right')}
        aria-label="Align right"
        className="text-foreground"
      >
        <AlignRight className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="h-6" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().deleteSelection().run()}
        className="h-8 px-2 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </BubbleMenu>
  )
}
