import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePages } from "@/stores/usePages"
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks"
import { ChevronRight, File, SquarePen, Settings, Search, Star, Trash2 } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { SidebarContextMenu } from "./SidebarContextMenu"
import { SettingsDialog } from "./SettingsDialog"
import { NotebookSwitcher } from "./NotebookSwitcher"
import { TrashList } from "./TrashList"
import { Tree } from "react-arborist"
import type { NodeRendererProps, NodeApi } from "react-arborist"
import type { Page } from "@/types"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

// 树节点数据结构
interface TreeNode {
  id: string
  name: string
  icon?: string
  children?: TreeNode[]
  page: Page
}

// 将扁平的 pages 转换为树形结构
function buildTree(pages: Record<string, Page>, parentId?: string, workspaceId?: string): TreeNode[] {
  return Object.values(pages)
    .filter(p => {
      const matchParent = p.parentId === parentId && !p.trashedAt
      const matchWorkspace = workspaceId ? p.workspaceId === workspaceId : true
      return matchParent && matchWorkspace
    })
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
    .map(page => ({
      id: page.id,
      name: page.title || "无标题",
      icon: page.icon,
      children: buildTree(pages, page.id, workspaceId),
      page,
    }))
}

// 自定义节点渲染
function PageNode({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const { activePageId, setActivePage } = usePages()
  const isActive = activePageId === node.id
  const hasChildren = node.children && node.children.length > 0
  const iconName = node.data.icon

  return (
    <SidebarContextMenu page={node.data.page}>
      <div
        ref={dragHandle}
        style={style}
        className={cn(
          "group flex items-center gap-1 py-1 px-2 rounded-sm cursor-pointer transition-colors",
          isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          node.state.isDragging && "opacity-50"
        )}
        onClick={(e) => {
          e.stopPropagation()
          setActivePage(node.id)
        }}
      >
        {/* 展开/折叠按钮 */}
        <div
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted/80"
          onClick={(e) => {
            e.stopPropagation()
            node.toggle()
          }}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform text-muted-foreground",
                node.isOpen && "rotate-90"
              )}
            />
          ) : (
            <div className="w-3 h-3" />
          )}
        </div>

        {/* 图标 */}
        {iconName ? (
          <div className="h-4 w-4 shrink-0 flex items-center justify-center mr-1">
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
          <File className="h-4 w-4 shrink-0 text-muted-foreground mr-1" />
        )}

        {/* 标题 */}
        <span className="truncate text-sm flex-1">{node.data.name}</span>
      </div>
    </SidebarContextMenu>
  )
}

type SidebarView = 'pages' | 'trash'

export function Sidebar({ className }: SidebarProps) {
  const { createPage, updatePage, deletePage, pages, activePageId, setActivePage, reorderPages, getChildren, getFavorites } = usePages()
  const { activeNotebookId } = useNotebooks()
  
  // 从 localStorage 恢复侧边栏宽度
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width')
    return saved ? Math.max(180, Math.min(480, Number(saved))) : 240
  })
  const [isResizing, setIsResizing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentView, setCurrentView] = useState<SidebarView>('pages')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<any>(null)

  // Cmd/Ctrl + Backspace 删除选中页面
  const handleDeleteShortcut = useCallback((e: KeyboardEvent) => {
    // 检查是否按下 Cmd/Ctrl + Backspace
    if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
      // 确保有选中的页面且不在编辑器输入状态
      const target = e.target as HTMLElement
      const isInEditor = target.closest('.ProseMirror') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      
      if (activePageId && !isInEditor && currentView === 'pages') {
        e.preventDefault()
        setDeleteDialogOpen(true)
      }
    }
  }, [activePageId, currentView])

  useEffect(() => {
    document.addEventListener('keydown', handleDeleteShortcut)
    return () => {
      document.removeEventListener('keydown', handleDeleteShortcut)
    }
  }, [handleDeleteShortcut])

  // 宽度变化时保存到 localStorage（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('sidebar-width', String(width))
    }, 300)
    return () => clearTimeout(timer)
  }, [width])

  const handleConfirmDelete = () => {
    if (activePageId) {
      deletePage(activePageId)
      setDeleteDialogOpen(false)
    }
  }

  // 将 pages 转换为 tree data（基于当前记事本过滤）
  const treeData = useMemo(
    () => buildTree(pages, undefined, activeNotebookId || undefined),
    [pages, activeNotebookId]
  )

  // 获取收藏页面
  const favorites = useMemo(
    () => getFavorites(activeNotebookId || undefined),
    [getFavorites, activeNotebookId, pages]
  )

  // 检查页面内容是否为空（只包含一个空段落）
  const isEmptyContent = (content: any) => {
    if (!content || content.type !== 'doc') return true
    if (!content.content || content.content.length === 0) return true
    if (content.content.length === 1) {
      const first = content.content[0]
      // 只有一个空段落算空内容
      if (first.type === 'paragraph' && (!first.content || first.content.length === 0)) {
        return true
      }
    }
    return false
  }

  const handleCreatePage = () => {
    // 查找当前记事本中是否存在空白页面
    const existingBlankPage = Object.values(pages).find(p => {
      const matchWorkspace = p.workspaceId === (activeNotebookId || 'default')
      const notTrashed = !p.trashedAt
      const isBlankTitle = !p.title || p.title.trim() === ''
      const isBlankContent = isEmptyContent(p.content)
      return matchWorkspace && notTrashed && isBlankTitle && isBlankContent
    })

    if (existingBlankPage) {
      // 存在空白页面，直接选中
      setActivePage(existingBlankPage.id)
    } else {
      createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK)
    }
  }

  const handleMove = ({
    dragIds,
    parentId,
    index,
  }: {
    dragIds: string[]
    parentId: string | null
    index: number
  }) => {
    const targetParentId = parentId || undefined
    const siblings = getChildren(targetParentId, activeNotebookId || undefined)
    const filteredSiblings = siblings.filter(p => !dragIds.includes(p.id))
    const movedPages = dragIds.map(id => pages[id]).filter(Boolean) as Page[]
    const newSiblings = [...filteredSiblings]
    newSiblings.splice(index, 0, ...movedPages)
    const newOrderIds = newSiblings.map(p => p.id)
    reorderPages(newOrderIds, targetParentId)
  }

  const handleRename = ({ id, name }: { id: string; name: string }) => {
    updatePage(id, { title: name })
  }

  const handleActivate = (node: NodeApi<TreeNode>) => {
    setActivePage(node.id)
  }

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = width

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + e.clientX - startX
      setWidth(Math.max(180, Math.min(480, newWidth)))
    }

    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      document.body.style.cursor = "default"
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    document.body.style.cursor = "col-resize"
  }

  // 垃圾箱视图
  if (currentView === 'trash') {
    return (
      <div
        ref={sidebarRef}
        className={cn("pb-0 border-r bg-muted/30 h-screen flex flex-col relative", className)}
        style={{ width }}
      >
        <div
          className={cn(
            "absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
            isResizing && "bg-primary"
          )}
          onMouseDown={startResizing}
        />
        <TrashList onBack={() => setCurrentView('pages')} />
      </div>
    )
  }

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "pb-0 border-r bg-muted/30 h-screen flex flex-col relative group/sidebar",
        className
      )}
      style={{ width: width }}
    >
      {/* Resizer Handle */}
      <div
        className={cn(
          "absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
          isResizing && "bg-primary"
        )}
        onMouseDown={startResizing}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Area - 记事本切换器 */}
        <div className="px-3 py-3 border-b">
          <div className="flex items-center gap-1">
            <div className="flex-1">
              <NotebookSwitcher />
            </div>
            <Button
              onClick={handleCreatePage}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              title="新建页面"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 搜索入口 */}
        <div className="px-3 py-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground h-8 px-2"
            onClick={() => {
              // 触发全局搜索 Cmd+K
              const event = new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                bubbles: true,
              })
              document.dispatchEvent(event)
            }}
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="text-sm">搜索</span>
            <span className="ml-auto text-xs text-muted-foreground/60">⌘K</span>
          </Button>
        </div>

        {/* 收藏区 */}
        {favorites.length > 0 && (
          <div className="px-3 py-2 border-b">
            <div className="flex items-center gap-2 px-2 mb-2 text-xs text-muted-foreground font-medium">
              <Star className="h-3 w-3" />
              收藏
            </div>
            <div className="space-y-0.5">
              {favorites.map((page) => {
                const iconName = page.icon
                return (
                  <div
                    key={page.id}
                    className={cn(
                      "flex items-center gap-2 py-1 px-2 rounded-sm cursor-pointer transition-colors text-sm",
                      activePageId === page.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => setActivePage(page.id)}
                  >
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
                      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{page.title || '无标题'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Page List with react-arborist */}
        <ScrollArea className="flex-1 px-2">
          <div className="py-2">
            <div className="flex items-center gap-2 px-2 mb-2 text-xs text-muted-foreground font-medium">
              <File className="h-3 w-3" />
              页面
            </div>
          </div>
          <div className="pb-20">
            {treeData.length > 0 ? (
              <Tree
                ref={treeRef}
                data={treeData}
                onMove={handleMove}
                onRename={handleRename}
                onActivate={handleActivate}
                selection={activePageId || undefined}
                openByDefault={false}
                width={width - 20}
                height={600}
                indent={12}
                rowHeight={32}
                overscanCount={5}
                disableEdit={false}
                disableDrag={false}
                disableDrop={false}
              >
                {PageNode}
              </Tree>
            ) : (
              <div className="text-sm text-muted-foreground px-4 py-8 text-center bg-muted/30 rounded mx-2 border border-dashed">
                <div className="mb-2">👻</div>
                <p>暂无页面</p>
                <Button
                  variant="link"
                  onClick={handleCreatePage}
                  className="h-auto p-0 mt-1"
                >
                  创建第一个页面
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 mt-auto border-t bg-background/50 backdrop-blur-sm space-y-1">
          {/* 垃圾箱 */}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => setCurrentView('trash')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span className="text-sm">垃圾箱</span>
          </Button>
          {/* 设置 */}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span className="text-sm">设置</span>
          </Button>
        </div>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要将「{activePageId ? pages[activePageId]?.title || '无标题' : ''}」移至垃圾箱吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
