import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePages } from "@/stores/usePages"
import { ChevronRight, File, SquarePen, Settings, FileText } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { SidebarContextMenu } from "./SidebarContextMenu"
import { SettingsDialog } from "./SettingsDialog"

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core"

import type { DragEndEvent, DragStartEvent, DragMoveEvent } from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Page } from "@/types"

// 拖拽位置类型：上方、中间（嵌套）、下方
type DropPosition = 'before' | 'inside' | 'after' | null

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

interface DropIndicatorInfo {
  targetId: string
  position: DropPosition
  targetLevel: number
}

interface PageTreeItemProps {
  page: Page
  level: number
  dropIndicator: DropIndicatorInfo | null
  activeId: string | null
  allPagesFlat: { page: Page; level: number }[]
}

function PageTreeItem({ page, level, dropIndicator, activeId, allPagesFlat }: PageTreeItemProps) {
  const { activePageId, setActivePage, getChildren } = usePages()
  const [expanded, setExpanded] = useState(false)
  const children = getChildren(page.id)
  const hasChildren = children.length > 0
  
  useEffect(() => {
     if (!expanded && children.some(c => c.id === activePageId)) {
         setExpanded(true)
     }
  }, [activePageId, children, expanded])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: page.id,
    data: { page, level }
  })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isCurrentTarget = dropIndicator?.targetId === page.id
  const showIndicatorBefore = isCurrentTarget && dropIndicator?.position === 'before'
  const showIndicatorAfter = isCurrentTarget && dropIndicator?.position === 'after'
  const showIndicatorInside = isCurrentTarget && dropIndicator?.position === 'inside'

  return (
    <>
      {/* 上方指示线 */}
      {showIndicatorBefore && (
        <div 
          className="h-0.5 bg-primary rounded-full mx-2 my-0.5"
          style={{ marginLeft: `${level * 12 + 8}px` }}
        />
      )}
      
      <SidebarContextMenu page={page}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        data-page-id={page.id}
        data-level={level}
        className={cn(
          "group flex items-center gap-1 py-1 px-2 rounded-sm cursor-grab active:cursor-grabbing transition-colors relative",
          activePageId === page.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          isDragging && "opacity-30",
          showIndicatorInside && "ring-2 ring-primary ring-inset bg-primary/10"
        )}
        onClick={() => setActivePage(page.id)}
      >
        {/* 左侧缩进 */}
        <div style={{ width: `${level * 12}px` }} />
        
        <div 
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted/80"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
        >
            {hasChildren ? (
                 <ChevronRight className={cn("h-3 w-3 transition-transform text-muted-foreground", expanded && "rotate-90")} />
            ) : (
                <div className="w-3 h-3" />
            )}
        </div>
        
        {/* 图标 */}
        {page.icon ? (
            <div className="h-4 w-4 shrink-0 flex items-center justify-center mr-1">
                {(LucideIcons as any)[page.icon] ? (
                    (() => {
                        const Icon = (LucideIcons as any)[page.icon]
                        return <Icon className="h-4 w-4" />
                    })()
                ) : (
                    <span className="text-xs">{page.icon}</span>
                )}
            </div>
        ) : (
            <File className="h-4 w-4 shrink-0 text-muted-foreground mr-1" />
        )}
        
        <span className="truncate text-sm flex-1">{page.title || "无标题"}</span>
      </div>
      </SidebarContextMenu>
      
      {/* 下方指示线 */}
      {showIndicatorAfter && (
        <div 
          className="h-0.5 bg-primary rounded-full mx-2 my-0.5"
          style={{ marginLeft: `${level * 12 + 8}px` }}
        />
      )}
      
      {/* 子页面 */}
      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <PageTreeItem 
              key={child.id} 
              page={child} 
              level={level + 1}
              dropIndicator={dropIndicator}
              activeId={activeId}
              allPagesFlat={allPagesFlat}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function Sidebar({ className }: SidebarProps) {
  const { createPage, getChildren, updatePage, pages } = usePages()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorInfo | null>(null)
  const [width, setWidth] = useState(256)
  const [isResizing, setIsResizing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  const rootPages = getChildren(undefined)
  
  // 构建扁平化的页面列表（用于拖拽定位）
  const allPagesFlat = useMemo(() => {
    const result: { page: Page; level: number }[] = []
    const buildFlat = (parentId: string | undefined, level: number) => {
      const children = getChildren(parentId)
      for (const child of children) {
        result.push({ page: child, level })
        buildFlat(child.id, level + 1)
      }
    }
    buildFlat(undefined, 0)
    return result
  }, [pages, getChildren])
  
  const pageIds = useMemo(() => allPagesFlat.map(p => p.page.id), [allPagesFlat])
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleCreatePage = () => {
    createPage()
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }
  
  // 上次更新时间，用于节流
  const lastUpdateRef = useRef(0)
  
  // 根据鼠标位置计算放置位置和目标
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    // 节流：50ms 内只更新一次
    const now = Date.now()
    if (now - lastUpdateRef.current < 50) return
    lastUpdateRef.current = now
    
    if (!scrollAreaRef.current || !activeId) return
    
    const { activatorEvent, delta } = event
    const mouseEvent = activatorEvent as MouseEvent
    if (!mouseEvent) return
    
    const currentY = mouseEvent.clientY + delta.y
    const currentX = mouseEvent.clientX + delta.x
    
    // 使用 elementFromPoint 直接找到目标元素，比遍历所有元素快很多
    const elementsAtPoint = document.elementsFromPoint(currentX, currentY)
    const targetEl = elementsAtPoint.find(el => {
      const pageId = el.getAttribute('data-page-id')
      return pageId && pageId !== activeId
    })
    
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      const targetId = targetEl.getAttribute('data-page-id')!
      const targetLevel = parseInt(targetEl.getAttribute('data-level') || '0')
      
      // 根据 Y 位置决定 position
      const relativeY = currentY - rect.top
      const threshold = rect.height * 0.25
      let position: DropPosition
      
      if (relativeY < threshold) {
        position = 'before'
      } else if (relativeY > rect.height - threshold) {
        position = 'after'
      } else {
        position = 'inside'
      }
      
      // X 位置判断是否移到顶层
      const sidebarRect = scrollAreaRef.current.getBoundingClientRect()
      const relativeX = currentX - sidebarRect.left
      let adjustedLevel = targetLevel
      if (position !== 'inside' && relativeX < 50) {
        adjustedLevel = 0
      }
      
      setDropIndicator({ targetId, position, targetLevel: adjustedLevel })
    } else {
      // 没找到目标，检查是否在列表下方空白区
      if (allPagesFlat.length > 0) {
        const lastPage = allPagesFlat[allPagesFlat.length - 1]
        setDropIndicator({ targetId: lastPage.page.id, position: 'after', targetLevel: 0 })
      } else {
        setDropIndicator(null)
      }
    }
  }, [activeId, allPagesFlat])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event
    const activePageId = active.id as string
    
    if (dropIndicator && dropIndicator.targetId !== activePageId) {
      const targetPage = pages[dropIndicator.targetId]
      
      if (dropIndicator.position === 'inside') {
        // 嵌入为子页面
        updatePage(activePageId, { parentId: dropIndicator.targetId })
      } else {
        // before 或 after：成为同级
        // 如果 targetLevel 是 0，则移到顶层，否则跟目标同一个父级
        if (dropIndicator.targetLevel === 0) {
          updatePage(activePageId, { parentId: undefined })
        } else {
          updatePage(activePageId, { parentId: targetPage?.parentId })
        }
      }
    }
    
    setActiveId(null)
    setDropIndicator(null)
  }
  
  const handleDragCancel = () => {
    setActiveId(null)
    setDropIndicator(null)
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
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
          document.body.style.cursor = 'default'
      }
      
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
  }

  const activePage = activeId ? pages[activeId] : null

  return (
    <div 
        ref={sidebarRef}
        className={cn("pb-0 border-r bg-muted/30 h-screen flex flex-col relative group/sidebar", className)}
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
               <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center text-xs">G</div>
               <span className="truncate font-semibold text-foreground">Goose Note</span>
            </div>
            
            <Button onClick={handleCreatePage} variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="新建页面">
               <SquarePen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Page List */}
        <ScrollArea className="flex-1 px-2" ref={scrollAreaRef}>
           <div className="space-y-0.5 pb-20">
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
                  {rootPages.map((page) => (
                    <PageTreeItem 
                      key={page.id} 
                      page={page} 
                      level={0}
                      dropIndicator={dropIndicator}
                      activeId={activeId}
                      allPagesFlat={allPagesFlat}
                    />
                  ))}
                </SortableContext>
                
                <DragOverlay dropAnimation={null}>
                  {activePage && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-md shadow-lg">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{activePage.title || "无标题"}</span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
              
              {rootPages.length === 0 && (
                <div className="text-sm text-muted-foreground px-4 py-8 text-center bg-muted/30 rounded mx-2 border border-dashed">
                  <div className="mb-2">👻</div>
                  <p>暂无页面</p>
                  <Button variant="link" onClick={handleCreatePage} className="h-auto p-0 mt-1">创建第一个页面</Button>
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
