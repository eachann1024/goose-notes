
import { Editor } from "@/components/Editor"
import { Sidebar } from "@/components/Sidebar"
import { usePages } from "@/stores/usePages"
import { cn } from "@/lib/utils"
import { PageMenu } from "@/components/PageMenu"

function App() {
  const { activePageId, getPage, updatePage } = usePages()
  const page = activePageId ? getPage(activePageId) : undefined

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
         {/* Top Header (Notion-like) */}
         {activePageId && page && (
             <div className="h-12 flex items-center justify-between px-3 border-b bg-background sticky top-0 z-10 shrink-0">
                 <div className="flex items-center text-sm text-muted-foreground gap-1 overflow-hidden">
                     {/* Breadcrumbs or Page Title */}
                     <span className="truncate max-w-[200px]">{page.title || "无标题"}</span>
                     {page.isLocked && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">已锁定</span>}
                 </div>
                 <div className="flex items-center gap-2">
                     <span className="text-xs text-muted-foreground">
                        本地储存
                     </span>
                     <PageMenu />
                 </div>
             </div>
         )}
         
         <div className="flex-1 overflow-y-auto scroll-smooth">
         {activePageId && page ? (
            <div className="py-12 px-8 min-h-screen">
               {/* Page Title Input */}
               <div className={cn(
                  "mb-8",
                  page.isFullWidth ? "max-w-full px-4" : "max-w-3xl mx-auto"
               )}>
                   {/* Icon (Optional placeholder) */}
                   <div className="group relative mb-4 opacity-0 hover:opacity-100 transition-opacity">
                      {/* TODO: Add Icon / Cover buttons here */}
                   </div>

                   <input
                     type="text"
                     placeholder="无标题"
                     className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                     value={page.title}
                     onChange={(e) => updatePage(activePageId, { title: e.target.value })}
                     disabled={page.isLocked}
                   />
               </div>
               
               <Editor 
                  editable={!page.isLocked}
               />
            </div>
         ) : (
             <div className="h-full flex items-center justify-center text-muted-foreground">
                 <p>选择或创建一个页面开始写作</p>
             </div>
         )}
         </div>
      </main>
    </div>
  )
}

export default App
