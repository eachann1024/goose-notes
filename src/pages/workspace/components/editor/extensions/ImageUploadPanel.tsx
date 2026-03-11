import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { processImageForStorageV2 } from '@/lib/imageProcessor'

export function ImageUploadPanel({ editor, deleteNode }: NodeViewProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insertImage = useCallback(
    (src: string) => {
      deleteNode()
      editor.chain().focus().setImage({ src }).run()
    },
    [editor, deleteNode]
  )

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('请选择图片文件')
        return
      }

      setIsUploading(true)
      setError(null)

      try {
        const src = await processImageForStorageV2(file)
        insertImage(src)
      } catch (err) {
        setError('图片处理失败')
        console.error(err)
      } finally {
        setIsUploading(false)
      }
    },
    [insertImage]
  )

  return (
    <NodeViewWrapper>
      <div
        className="my-4 rounded-md border border-border bg-popover p-3 shadow-md"
        contentEditable={false}
      >
        <FileTrigger
          accept="image/*"
          onFileChange={(file) => file && handleFileSelect(file)}
          errorText={error}
          disabledReason={isUploading ? "正在处理图片" : undefined}
        >
          <Button
            type="button"
            variant="ghost"
            disabled={isUploading}
            className={cn(
              'flex h-auto w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-6 text-[length:var(--editor-module-sm-font-size)] transition-all duration-200',
              isUploading
                ? 'cursor-not-allowed opacity-50'
                : 'text-muted-foreground hover:border-primary hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40 hover:text-foreground'
            )}
          >
            <LucideIcons.Image className="h-[var(--editor-control-icon-lg-size)] w-[var(--editor-control-icon-lg-size)]" />
            {isUploading ? '处理中...' : '点击选择图片或直接粘贴'}
          </Button>
        </FileTrigger>
      </div>
    </NodeViewWrapper>
  )
}
