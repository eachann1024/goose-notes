
import { Editor } from "@/components/Editor"
import { Sidebar } from "@/components/Sidebar"
import { usePages } from "@/stores/usePages"
import { cn } from "@/lib/utils"
import { PageMenu } from "@/components/PageMenu"
import { CommandPalette } from "@/components/CommandPalette"
import { IconSelector } from "@/components/IconSelector"
import * as LucideIcons from "lucide-react"
import { useEffect, useState } from "react"
import welcomeCover from "@/assets/welcome-cover.png"

function App() {
  const { activePageId, getPage, updatePage } = usePages()
  const page = activePageId ? getPage(activePageId) : undefined
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault()
                setZoom(prev => Math.min(prev + 0.1, 2))
            } else if (e.key === '-') {
                e.preventDefault()
                setZoom(prev => Math.max(prev - 0.1, 0.5))
            } else if (e.key === '0') {
                e.preventDefault()
                setZoom(1)
            }
        }
    }
    
    // 全局禁用系统右键菜单
    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault()
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  return (
    <div 
        className="flex h-screen overflow-hidden bg-background text-foreground transition-transform duration-200"
        style={{ zoom: zoom }}
    >
      <CommandPalette />
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
         {/* 垃圾箱页面预览提示横幅 */}
         {activePageId && page?.trashedAt && (
             <div className="bg-amber-500/90 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-4 shrink-0">
                 <span className="flex items-center gap-2">
                     <LucideIcons.Trash2 className="h-4 w-4" />
                     此页面在垃圾箱中
                 </span>
                 <div className="flex items-center gap-2">
                     <button 
                         onClick={() => {
                             usePages.getState().restorePage(activePageId)
                         }}
                         className="px-3 py-1 bg-amber-950/20 hover:bg-amber-950/30 rounded text-xs transition-colors"
                     >
                         恢复页面
                     </button>
                     <button 
                         onClick={() => {
                             usePages.getState().permanentlyDeletePage(activePageId)
                         }}
                         className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs transition-colors"
                     >
                         永久删除
                     </button>
                 </div>
             </div>
         )}
         
         {/* Top Header (Notion-like) */}
         {activePageId && page && (
             <div className="h-12 flex items-center justify-between px-3 border-b bg-background sticky top-0 z-10 shrink-0">
                 <div className="flex items-center text-sm text-muted-foreground gap-1 overflow-hidden">
                     {/* Breadcrumbs or Page Title */}
                     <span className="truncate max-w-[200px]">{page.title || "无标题"}</span>
                     {page.isLocked && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">已锁定</span>}
                     {page.trashedAt && <span className="text-xs bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded">只读</span>}
                 </div>
                 <div className="flex items-center gap-2">
                     <span className="text-xs text-muted-foreground">
                        本地储存
                     </span>
                     {!page.trashedAt && <PageMenu />}
                     <div className="w-px h-4 bg-border mx-1" />
                     <button 
                        onClick={() => usePages.getState().setActivePage(null)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="关闭页面"
                     >
                        <LucideIcons.X className="h-4 w-4" />
                     </button>
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
                   {/* Icon */}
                   <div className="group relative mb-4">
                      <IconSelector
                        value={page.icon}
                        onChange={(icon) => updatePage(activePageId, { icon })}
                      >
                        <button className={cn(
                           "flex items-center justify-center transition-opacity",
                           page.icon ? "opacity-100" : "opacity-0 hover:opacity-100"
                        )}>
                           {page.icon ? (
                               <div className="flex items-center justify-center h-16 w-16 text-6xl">
                                  {/* Check if it's an emoji (not in Lucide) or Lucide Icon */}
                                  {(LucideIcons as any)[page.icon] ? (
                                     (() => {
                                        const Icon = (LucideIcons as any)[page.icon]
                                        return <Icon className="h-14 w-14" />
                                     })()
                                  ) : (
                                     <span>{page.icon}</span>
                                  )}
                               </div>
                           ) : (
                               <div className="flex items-center gap-1 text-sm text-muted-foreground hover:bg-muted px-2 py-1 rounded-md">
                                  <LucideIcons.Smile className="h-4 w-4" />
                                  <span>添加图标</span>
                               </div>
                           )}
                        </button>
                      </IconSelector>
                   </div>

                   <input
                     type="text"
                     placeholder="无标题"
                     className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                     value={page.title}
                     onChange={(e) => updatePage(activePageId, { title: e.target.value })}
                     disabled={page.isLocked || !!page.trashedAt}
                   />
               </div>
               
               <Editor 
                  editable={!page.isLocked && !page.trashedAt}
               />
            </div>
         ) : (
             <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-background">
                 <div className="w-[400px] h-[300px] mb-8 relative flex items-center justify-center">
                    <img 
                        src={welcomeCover} 
                        alt="Welcome" 
                        className="w-full h-full object-contain opacity-80"
                    />
                 </div>
                 <h2 className="text-2xl font-semibold text-foreground mb-2">准备好记录想法了吗？</h2>
                 <p className="text-sm opacity-60">点击左侧侧边栏新建页面，或选择现有页面开始。</p>
             </div>
         )}
         </div>
      </main>
    </div>
  )
}

export default App
