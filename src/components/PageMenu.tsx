
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Trash2, FileJson, FileCode, FileType, Check } from "lucide-react"
import { usePages } from "@/stores/usePages"
import { exportToJSON, exportToHTML, exportToMarkdown } from "@/lib/export"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function PageMenu() {
  const { activePageId, getPage, updatePage, deletePage } = usePages()
  const page = activePageId ? getPage(activePageId) : undefined

  if (!page || !activePageId) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
             <span className="text-xs text-muted-foreground">最后编辑于 {new Date(page.updatedAt).toLocaleString()}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
           <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">样式</div>
           
           <div className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer" onClick={() => updatePage(activePageId, { fontFamily: 'default' })}>
               <div className="flex items-center gap-2">
                  <span className="font-sans text-xl">Ag</span>
                  <span className="text-sm">默认</span>
               </div>
               {page.fontFamily === 'default' && <Check className="h-4 w-4" />}
           </div>
           
           <div className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer font-serif" onClick={() => updatePage(activePageId, { fontFamily: 'serif' })}>
               <div className="flex items-center gap-2">
                  <span className="text-xl">Ag</span>
                  <span className="text-sm">衬线体</span>
               </div>
               {page.fontFamily === 'serif' && <Check className="h-4 w-4" />}
           </div>
           
           <div className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer font-mono" onClick={() => updatePage(activePageId, { fontFamily: 'mono' })}>
               <div className="flex items-center gap-2">
                  <span className="text-xl">Ag</span>
                  <span className="text-sm">等宽体</span>
               </div>
               {page.fontFamily === 'mono' && <Check className="h-4 w-4" />}
           </div>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
            <div className="flex items-center justify-between px-2 py-1.5">
                <Label htmlFor="small-text-switch" className="text-sm font-normal cursor-pointer flex-1">小字号</Label>
                <Switch 
                    id="small-text-switch" 
                    checked={page.fontSize === 'small'} 
                    onCheckedChange={(checked) => updatePage(activePageId, { fontSize: checked ? 'small' : 'default' })}
                />
            </div>
            
             <div className="flex items-center justify-between px-2 py-1.5">
                <Label htmlFor="full-width-switch" className="text-sm font-normal cursor-pointer flex-1">全宽</Label>
                <Switch 
                    id="full-width-switch" 
                    checked={page.isFullWidth} 
                    onCheckedChange={(checked) => updatePage(activePageId, { isFullWidth: checked })}
                />
            </div>

            <div className="flex items-center justify-between px-2 py-1.5">
                <Label htmlFor="lock-page-switch" className="text-sm font-normal cursor-pointer flex-1">锁定页面</Label>
                <Switch 
                    id="lock-page-switch" 
                    checked={page.isLocked} 
                    onCheckedChange={(checked) => updatePage(activePageId, { isLocked: checked })}
                />
            </div>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => deletePage(activePageId)} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          <span>移至垃圾箱</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuSub>
           <DropdownMenuSubTrigger>
              <FileJson className="mr-2 h-4 w-4" />
              <span>导出</span>
           </DropdownMenuSubTrigger>
           <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => exportToJSON(page)}>
                 <FileJson className="mr-2 h-4 w-4" />
                 <span>JSON</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportToMarkdown(page)}>
                 <FileCode className="mr-2 h-4 w-4" />
                 <span>Markdown</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportToHTML(page)}>
                 <FileType className="mr-2 h-4 w-4" />
                 <span>HTML</span>
              </DropdownMenuItem>
           </DropdownMenuSubContent>
        </DropdownMenuSub>

      </DropdownMenuContent>
    </DropdownMenu>
  )
}
