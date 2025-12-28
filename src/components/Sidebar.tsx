import { useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePages } from "@/stores/usePages"
import { ChevronRight, File, SquarePen, Settings } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { SidebarContextMenu } from "./SidebarContextMenu"
import { SettingsDialog } from "./SettingsDialog"
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
  // 保存原始 page 引用
  page: Page
}

// 将扁平的 pages 转换为树形结构
function buildTree(pages: Record<string, Page>, parentId?: string): TreeNode[] {
  return Object.values(pages)
    .filter(p => p.parentId === parentId && !p.trashedAt)
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
    .map(page => ({
      id: page.id,
      name: page.title || "无标题",
      icon: page.icon,
      children: buildTree(pages, page.id),
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

export function Sidebar({ className }: SidebarProps) {
  const { createPage, updatePage, pages, activePageId, setActivePage, reorderPages, getChildren } = usePages()
  const [width, setWidth] = useState(256)
  const [isResizing, setIsResizing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<any>(null)

  // 将 pages 转换为 tree data
  const treeData = useMemo(() => buildTree(pages), [pages])

  const handleCreatePage = () => {
    createPage()
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
    // 1. Get current children of the target parent
    const targetParentId = parentId || undefined
    const siblings = getChildren(targetParentId)

    // 2. Remove dragged items if they are already in the list (same parent move)
    const filteredSiblings = siblings.filter(p => !dragIds.includes(p.id))

    // 3. Insert dragged items
    const movedPages = dragIds.map(id => pages[id]).filter(Boolean) as Page[]
    
    // Create a new array for mutation
    const newSiblings = [...filteredSiblings]
    newSiblings.splice(index, 0, ...movedPages)

    // 4. Extract IDs and update order
    const newOrderIds = newSiblings.map(p => p.id)
    reorderPages(newOrderIds, targetParentId)
  }

  // 处理重命名（双击编辑）
  const handleRename = ({ id, name }: { id: string; name: string }) => {
    updatePage(id, { title: name })
  }

  // 处理节点激活（点击）
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
      setWidth(Math.max(200, Math.min(480, newWidth)))
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
        {/* Header Area */}
        <div className="px-3 py-3">
          <div className="flex items-center justify-between px-2 mb-2 group">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer">
              <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center text-xs">
                G
              </div>
              <span className="truncate font-semibold text-foreground">
                Goose Note
              </span>
            </div>

            <Button
              onClick={handleCreatePage}
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="新建页面"
            >
              <SquarePen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Page List with react-arborist */}
        <ScrollArea className="flex-1 px-2">
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

        {/* Footer Settings */}
        <div className="p-2 mt-auto border-t bg-background/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground h-9 px-2"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span className="text-sm">设置</span>
          </Button>
        </div>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  )
}
