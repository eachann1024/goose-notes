import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { processImageForStorageV2 } from '@/lib/imageProcessor'

export function ImageUploadPanel({ editor, deleteNode }: NodeViewProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  return (
    <NodeViewWrapper>
      <div
        className="my-4 rounded-md border border-border bg-popover p-3 shadow-md"
        contentEditable={false}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-6 text-sm transition-all duration-200',
            isUploading
              ? 'cursor-not-allowed opacity-50'
              : 'text-muted-foreground hover:border-primary hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40 hover:text-foreground'
          )}
        >
          <LucideIcons.Image className="h-5 w-5" />
          {isUploading ? '处理中...' : '点击选择图片或直接粘贴'}
        </button>

        {/* 错误提示 */}
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>
    </NodeViewWrapper>
  )
}
