import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

type TabType = 'upload' | 'embed'

export function ImageUploadPanel({ editor, deleteNode }: NodeViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upload')
  const [embedUrl, setEmbedUrl] = useState('')
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
        const base64 = await processImageForStorage(file)
        insertImage(base64)
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

  const handleEmbedSubmit = useCallback(() => {
    if (!embedUrl.trim()) {
      setError('请输入图片链接')
      return
    }

    if (!isValidImageUrl(embedUrl)) {
      setError('请输入有效的图片链接')
      return
    }

    insertImage(embedUrl)
  }, [embedUrl, insertImage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleEmbedSubmit()
      }
    },
    [handleEmbedSubmit]
  )

  return (
    <NodeViewWrapper>
      <div
        className="my-4 rounded-md border border-border bg-popover p-3 shadow-md"
        contentEditable={false}
      >
        {/* Tab 切换 - 与 BubbleMenu 工具栏风格一致 */}
        <div className="mb-3 flex items-center gap-1 rounded-md bg-gradient-to-r from-muted/60 to-muted/40 p-1">
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'upload'
                ? 'bg-popover text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LucideIcons.Upload className="h-4 w-4" />
            上传
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'embed'
                ? 'bg-popover text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LucideIcons.Link className="h-4 w-4" />
            嵌入链接
          </button>
        </div>

        {/* 上传 Tab */}
        {activeTab === 'upload' && (
          <>
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
              {isUploading ? '处理中...' : '点击选择图片'}
            </button>
          </>
        )}

        {/* 嵌入链接 Tab */}
        {activeTab === 'embed' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="粘贴图片链接..."
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              onClick={handleEmbedSubmit}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              嵌入
            </button>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </div>
    </NodeViewWrapper>
  )
}
