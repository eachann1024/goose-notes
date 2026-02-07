import { FontSelector } from "@/pages/workspace/components/shared/FontSelector";

export function PageMenu() {
  const {
    activePageId,
    getPage,
    updatePage,
    createPage,
    setActivePage,
  } = usePages();
  const { deletePageWithUndo } = useDeletePageWithUndo();
  const { activeNotebookId, notebooks } = useNotebooks();
  const page = activePageId ? getPage(activePageId) : undefined;
  const notebook = activeNotebookId ? notebooks[activeNotebookId] : undefined;
  const isLocalFolderPage = notebook?.source === "local-folder";

  const handleImport = async () => {
    const result = await importFile();
    if (result.success) {
      const newId = createPage(undefined, activeNotebookId || DEFAULT_NOTEBOOK);

      const content = result.content;
      content.content = [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: result.title }],
        },
        ...(content.content || []),
      ];

      updatePage(newId, { content });

      setActivePage(null);
      requestAnimationFrame(() => {
        setActivePage(newId);
      });
    } else {
      console.error("导入失败:", result.error);
    }
  };

  if (!page || !activePageId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-[7px] text-muted-foreground/70 transition-colors duration-150 hover:bg-muted/65 hover:text-foreground"
        >
          <LucideIcons.MoreHorizontal className="h-4 w-4" />
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
              <LucideIcons.Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="ml-2.5">锁定页面</span>
            </div>
            <Switch
              checked={page.isLocked}
              onCheckedChange={(checked) =>
                updatePage(activePageId, { isLocked: checked })
              }
            />
          </div>
        </DropdownMenuGroup>

        {/* Switches Section */}
        <DropdownMenuGroup>
          {!isLocalFolderPage && (
            <div className="flex items-center justify-between py-1 px-2 rounded-sm text-xs">
              <div className="flex items-center gap-2">
                <LucideIcons.ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="ml-2.5">全宽</span>
              </div>
              <Switch
                checked={page.isFullWidth}
                onCheckedChange={(checked) =>
                  updatePage(activePageId, { isFullWidth: checked })
                }
              />
            </div>
          )}

          <DropdownMenuItem
            className="text-xs text-destructive focus:text-destructive"
            onClick={() => void deletePageWithUndo(activePageId)}
          >
            <LucideIcons.Trash2 className="mr-2 h-3.5 w-3.5" />
            <span>移至垃圾箱</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Import/Export */}
        <DropdownMenuGroup>
          <DropdownMenuItem className="text-xs" onSelect={handleImport}>
            <LucideIcons.Upload className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <span>导入</span>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <LucideIcons.Download className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>导出</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => exportToJSON(page)}
              >
                <LucideIcons.FileJson className="mr-2 h-3.5 w-3.5" /> JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => exportToMarkdown(page)}
              >
                <LucideIcons.FileCode className="mr-2 h-3.5 w-3.5" /> Markdown
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => exportToHTML(page)}
              >
                <LucideIcons.FileType className="mr-2 h-3.5 w-3.5" /> HTML
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span>字数</span>
              <span className="text-[10px] opacity-80">
                {countWords(page.content)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span>最后编辑于</span>
              <span className="text-[10px] opacity-80">
                {new Date(page.updatedAt).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
