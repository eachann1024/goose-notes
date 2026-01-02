import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
// import { Separator } from "@/components/ui/separator"
import {
  MoreHorizontal,
  Trash2,
  FileJson,
  FileCode,
  FileType,
  FolderInput,
  Lock,
  Download,
  Upload as UploadIcon
} from "lucide-react"
import { usePages } from "@/stores/usePages"
import { useNotebooks, DEFAULT_NOTEBOOK } from "@/stores/useNotebooks"
import { exportToJSON, exportToHTML, exportToMarkdown, importFile } from "@/lib/export"
import { Switch } from "@/components/ui/switch"
import { FontSelector } from "@/components/FontSelector"

export function PageMenu() {
  const { activePageId, getPage, updatePage, deletePage, createPage, setActivePage } = usePages()
  const { activeNotebookId } = useNotebooks()
  const page = activePageId ? getPage(activePageId) : undefined

  const handleImport = async () => {
    const result = await importFile()
    if (result.success) {
      const newId = createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK)
      updatePage(newId, { title: result.title, content: result.content })

      setActivePage(null)
      requestAnimationFrame(() => {
        setActivePage(newId)
      })
    } else {
      console.error('导入失败:', result.error)
    }
  }

  if (!page || !activePageId) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] p-2" align="end" forceMount>

         {/* Font Selector */}
         <div className="px-1 py-2">
             <FontSelector
               value={page.fontFamily}
               onChange={(fontFamily) => updatePage(activePageId, { fontFamily })}
             />
         </div>

         <DropdownMenuSeparator />

         <DropdownMenuGroup>
             <div className="flex items-center justify-between py-1 px-2 rounded-sm text-xs">
                 <div className="flex items-center gap-2">
                     <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                     <span className="ml-2.5">锁定页面</span>
                 </div>
                 <Switch
                     checked={page.isLocked}
                     onCheckedChange={(checked) => updatePage(activePageId, { isLocked: checked })}
                 />
             </div>
         </DropdownMenuGroup>



         {/* Switches Section */}
         <DropdownMenuGroup>
             <DropdownMenuItem className="text-xs">
                 <FolderInput className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                 <span className="flex-1">移动到</span>
                 <span className="text-[10px] text-muted-foreground">⌘⇧P</span>
             </DropdownMenuItem>
             <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
                onClick={() => deletePage(activePageId)}
             >
                 <Trash2 className="mr-2 h-3.5 w-3.5" />
                 <span>移至垃圾箱</span>
             </DropdownMenuItem>

         </DropdownMenuGroup>

         <DropdownMenuSeparator />




         {/* Import/Export */}
         <DropdownMenuGroup>
             <DropdownMenuItem className="text-xs" onSelect={handleImport}>
                 <UploadIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                 <span>导入</span>
             </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                   <Download className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                   <span>导出</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                   <DropdownMenuItem className="text-xs" onSelect={() => exportToJSON(page)}>
                      <FileJson className="mr-2 h-3.5 w-3.5" /> JSON
                   </DropdownMenuItem>
                   <DropdownMenuItem className="text-xs" onSelect={() => exportToMarkdown(page)}>
                      <FileCode className="mr-2 h-3.5 w-3.5" /> Markdown
                   </DropdownMenuItem>
                   <DropdownMenuItem className="text-xs" onSelect={() => exportToHTML(page)}>
                      <FileType className="mr-2 h-3.5 w-3.5" /> HTML
                   </DropdownMenuItem>
                </DropdownMenuSubContent>
             </DropdownMenuSub>
         </DropdownMenuGroup>


      </DropdownMenuContent>
    </DropdownMenu>
  )
}
