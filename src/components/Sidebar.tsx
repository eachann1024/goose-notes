
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePages } from "@/stores/usePages"
import { FileText, Plus, Trash2 } from "lucide-react"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const { activePageId, setActivePage, createPage, getChildren } = usePages()
  
  // Get root pages (no parent)
  const rootPages = getChildren(undefined)

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const handleCreatePage = () => {
    createPage()
    // Auto select is handled in store
  }

  return (
    <div className={cn("pb-12 w-64 border-r bg-muted/40 h-screen flex flex-col", className)}>
      <div className="space-y-4 py-4 flex-1">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2 px-4">
            <h2 className="text-lg font-semibold tracking-tight">
              工作区
            </h2>
            <Button onClick={handleCreatePage} variant="ghost" size="icon" className="h-6 w-6">
               <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
             <ScrollArea className="h-[calc(100vh-100px)]">
                {rootPages.map((page) => (
                    <Button
                        key={page.id}
                        variant={activePageId === page.id ? "secondary" : "ghost"}
                        className="w-full justify-start font-normal"
                        onClick={() => setActivePage(page.id)}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        {page.title || "无标题"}
                    </Button>
                ))}
                {rootPages.length === 0 && (
                     <div className="text-sm text-muted-foreground px-4 py-2">
                        暂无页面，点击 + 创建
                     </div>
                )}
             </ScrollArea>
          </div>
        </div>
      </div>
      
      {/* Bottom Actions */}
      <div className="px-3 py-2 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
             <Trash2 className="mr-2 h-4 w-4" />
             回收站
          </Button>
      </div>
    </div>
  )
}
