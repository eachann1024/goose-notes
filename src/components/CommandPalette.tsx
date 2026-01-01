import { useEffect, useState, useMemo } from 'react'
import { Command } from 'cmdk'
import { FileText, Search, Clock, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { HighlightText } from '@/lib/highlight-text'
import { extractTextFromContent } from '@/lib/content-text-extractor'
import { usePages } from '@/stores/usePages'
import { useNotebooks, DEFAULT_NOTEBOOK } from '@/stores/useNotebooks'
import { useSettings } from '@/stores/useSettings'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { pages, setActivePage } = usePages()
  const { activeNotebookId } = useNotebooks()
  const { searchAllNotebooks, setSearchAllNotebooks } = useSettings()
  const [removedRecentIds, setRemovedRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('goose-recent-excludes')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const handleRemoveRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const newIds = [...removedRecentIds, id]
    setRemovedRecentIds(newIds)
    localStorage.setItem('goose-recent-excludes', JSON.stringify(newIds))
  }

  // 根据 searchAllNotebooks 过滤页面
  const filteredPages = useMemo(() => {
    const allPagesArray = Object.values(pages).filter(p => !p.trashedAt)
    if (searchAllNotebooks) {
      // 勾选：搜索所有记事本
      return allPagesArray
    }
    // 不勾选：搜索当前记事本
    const currentNotebookId = activeNotebookId || DEFAULT_NOTEBOOK
    return allPagesArray.filter(p => p.workspaceId === currentNotebookId)
  }, [pages, searchAllNotebooks, activeNotebookId])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      const recent = filteredPages
        .filter(p => !removedRecentIds.includes(p.id))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)

      const all = filteredPages.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))

      return { recent, all, hasQuery: false }
    }

    const matched = filteredPages.filter(page => {
      const titleMatch = page.title.toLowerCase().includes(query)
      const contentText = extractTextFromContent(page.content)
      const contentMatch = contentText.toLowerCase().includes(query)
      return titleMatch || contentMatch
    })

    const recent = matched
      .filter(p => !removedRecentIds.includes(p.id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)

    const all = matched.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))

    return { recent, all, hasQuery: true }
  }, [filteredPages, searchQuery, removedRecentIds])

  // 键盘事件：⌘K 打开搜索，Tab 切换搜索范围
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K 打开搜索
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      // Tab 切换搜索范围（仅在搜索框打开时）
      if (open && e.key === 'Tab') {
        e.preventDefault()
        setSearchAllNotebooks(!searchAllNotebooks)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, searchAllNotebooks, setSearchAllNotebooks])

  const runCommand = async (command: () => void) => {
    command()
    await new Promise(resolve => setTimeout(resolve, 0))
    setOpen(false)
  }

  // 当前记事本名称
  const currentNotebookName = activeNotebookId
    ? useNotebooks.getState().notebooks[activeNotebookId]?.name || '当前记事本'
    : '当前记事本'

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Search"
      filter={() => 1}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[640px] bg-popover rounded-xl shadow-2xl border p-0 overflow-hidden z-50 text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 backdrop-blur-xl bg-popover/90"
    >
      <div className="flex items-center border-b px-4" cmdk-input-wrapper="">
        <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
        <Command.Input
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder={searchAllNotebooks ? '搜索所有记事本...' : `搜索 "${currentNotebookName}"...`}
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <Switch
            id="search-all"
            checked={searchAllNotebooks}
            onCheckedChange={setSearchAllNotebooks}
            className="scale-75"
          />
          <Label
            htmlFor="search-all"
            className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
          >
            {searchAllNotebooks ? '所有记事本' : '当前记事本'}
          </Label>
        </div>
        <div className="w-px h-4 bg-border mx-2" />
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">Tab</span>
        </kbd>
      </div>

      <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden py-2 px-2">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            {searchQuery.trim() ? '未找到匹配的页面' : '输入关键词开始搜索'}
        </Command.Empty>

        {/* 只有在没有输入内容且有结果时才显示最近访问 */}
        {!searchQuery.trim() && searchResults.recent.length > 0 && (
          <Command.Group heading="最近访问">
            {searchResults.recent.map(page => (
                 <Command.Item
                    key={page.id}
                    value={page.title || "无标题"}
                    onSelect={() => runCommand(() => setActivePage(page.id))}
                    className="group relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                 >
                    <div className="mr-2 h-4 w-4 shrink-0 flex items-center justify-center relative">
                      <Clock className="h-4 w-4 text-muted-foreground/70 transition-opacity duration-200 group-hover:opacity-0" />
                      <div 
                        role="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemoveRecent(e, page.id)
                        }}
                        className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted-foreground/20 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute inset-0"
                      >
                         <X className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                    <span className="truncate flex-1">
                      <HighlightText text={page.title || "无标题"} query={searchQuery} />
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/50">
                        {new Date(page.updatedAt).toLocaleDateString()}
                    </span>
                 </Command.Item>
            ))}
          </Command.Group>
        )}

        {!searchQuery.trim() && searchResults.recent.length > 0 && searchResults.all.length > 0 && (
          <Command.Separator className="my-1 h-px bg-border" />
        )}

        {searchResults.all.length > 0 && (
          <Command.Group heading={searchResults.hasQuery ? "搜索结果" : "所有页面"}>
             {searchResults.all.map(page => (
                 <Command.Item
                    key={page.id}
                    value={page.title || "无标题"}
                    onSelect={() => runCommand(() => setActivePage(page.id))}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                 >
                    <FileText className="mr-2 h-4 w-4" />
                    <span className="truncate flex-1">
                      <HighlightText text={page.title || "无标题"} query={searchQuery} />
                    </span>
                 </Command.Item>
             ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  )
}
