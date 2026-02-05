import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { getPageTitle } from "@/lib/page-title";
import { useEffect } from 'react';
import { countWords } from "@/lib/content-text-extractor";

interface TrashListProps {
  onBack: () => void
}

export function TrashList({ onBack }: TrashListProps) {
  const { getTrashedPages, restorePage, permanentlyDeletePage, setActivePage, activePageId } = usePages()
  const { activeNotebookId } = useNotebooks()
  
  const trashedPages = getTrashedPages(activeNotebookId || undefined)
  
  // 默认选中第一个文件
  useEffect(() => {
    if (trashedPages.length > 0 && !activePageId) {
      setActivePage(trashedPages[0].id)
    }
  }, [trashedPages, activePageId, setActivePage])

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-3 py-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onBack}
        >
          <LucideIcons.ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <LucideIcons.Trash2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">垃圾箱</span>
        </div>
      </div>

      {/* 列表 */}
      <ScrollArea className="flex-1">
        {trashedPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <LucideIcons.Trash2 className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">垃圾箱是空的</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {trashedPages.map((page) => {
              const iconName = page.icon
              const timeAgo = page.trashedAt
                ? formatDistanceToNow(page.trashedAt, { addSuffix: true, locale: zhCN })
                : ''
              const wordCount = countWords(page.content)

              return (
                <div
                  key={page.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-gradient-to-r hover:from-muted/50 hover:to-muted/30 group cursor-pointer transition-all duration-200"
                  onClick={() => setActivePage(page.id)}
                >
                  {/* 图标 */}
                  {iconName ? (
                    <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                      {(LucideIcons as any)[iconName] ? (
                        (() => {
                          const Icon = (LucideIcons as any)[iconName]
                          return <Icon className="h-4 w-4" />
                        })()
                      ) : (
                        <span className="text-xs">{iconName}</span>
                      )}
                    </div>
                  ) : (
                    <LucideIcons.File className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}

                  {/* 标题和时间 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{getPageTitle(page)}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo}</div>
                  </div>

                  {/* 字数 - 最右边 */}
                  {wordCount > 0 && (
                    <div className="text-xs text-muted-foreground shrink-0">
                      {wordCount} 字
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        restorePage(page.id)
                      }}
                      title="恢复"
                    >
                      <LucideIcons.RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void permanentlyDeletePage(page.id)
                      }}
                      title="永久删除"
                    >
                      <LucideIcons.Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* 底部提示 */}
      {trashedPages.length > 0 && (
        <div className="p-3 border-t text-xs text-muted-foreground text-center">
          30 天后自动永久删除
        </div>
      )}
    </div>
  )
}
