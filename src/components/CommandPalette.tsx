
import { useEffect, useState, useMemo } from 'react'
import { Command } from 'cmdk'
import { FileText, Search, Clock } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

import { usePages } from '@/stores/usePages'

// 当前工作区 ID（后续可从 store 动态获取）
const CURRENT_WORKSPACE_ID = 'default'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [searchAll, setSearchAll] = useState(false)
  const { pages, setActivePage } = usePages()
  
  // 根据 searchAll 过滤页面
  const filteredPages = useMemo(() => {
    const allPagesArray = Object.values(pages).filter(p => !p.trashedAt)
    if (searchAll) {
      return allPagesArray
    }
    return allPagesArray.filter(p => p.workspaceId === CURRENT_WORKSPACE_ID)
  }, [pages, searchAll])
  
  // Calculate recent pages (top 5 modified recently)
  const recentPages = useMemo(() => {
    return filteredPages
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
  }, [filteredPages])

  const allPagesSorted = useMemo(() => {
    return filteredPages.sort((a, b) => a.title.localeCompare(b.title))
  }, [filteredPages])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Search"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] bg-popover rounded-xl shadow-2xl border p-0 overflow-hidden z-50 text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 backdrop-blur-xl bg-popover/90"
    >
      <div className="flex items-center border-b px-4" cmdk-input-wrapper="">
        <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
        <Command.Input 
            placeholder="搜索页面..." 
            className="flex h-12 w-full rouned-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <Switch 
            id="search-all" 
            checked={searchAll} 
            onCheckedChange={setSearchAll}
            className="scale-75"
          />
          <Label 
            htmlFor="search-all" 
            className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
          >
            {searchAll ? '全部' : '当前'}
          </Label>
        </div>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 ml-2">
            <span className="text-xs">⌘</span>K
        </kbd>
      </div>
      
      <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden py-2 px-2">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            未找到结果
        </Command.Empty>

        <Command.Group heading="最近访问">
            {recentPages.map(page => (
                 <Command.Item
                    key={page.id}
                    value={`${page.title} ${page.id}`} // Ensure searching matches title
                    onSelect={() => runCommand(() => setActivePage(page.id))}
                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                 >
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground/70" />
                    <span className="truncate">{page.title || "无标题"}</span>
                    <span className="ml-auto text-xs text-muted-foreground/50">
                        {new Date(page.updatedAt).toLocaleDateString()}
                    </span>
                 </Command.Item>
            ))}
        </Command.Group>

        <Command.Separator className="my-1 h-px bg-border" />

        <Command.Group heading="所有页面">
             {allPagesSorted.map(page => (
                 <Command.Item
                    key={page.id}
                    value={`${page.title} ${page.id} all`}
                    onSelect={() => runCommand(() => setActivePage(page.id))}
                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                 >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>{page.title || "无标题"}</span>
                 </Command.Item>
            ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
