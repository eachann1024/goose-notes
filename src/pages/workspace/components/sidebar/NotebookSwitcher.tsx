import { NotebookCreateDialog } from "./NotebookCreateDialog";
import { NotebookEditDialog } from "./NotebookEditDialog";
import { renderNotebookIcon } from "./notebookUtils";

export function NotebookSwitcher() {
  const {
    notebooks,
    activeNotebookId,
    setActiveNotebook,
    createNotebook,
    createLocalFolderNotebook,
    updateNotebook,
    deleteNotebook,
    getLastActivePage,
  } = useNotebooks();
  const { setActivePage } = usePages();
  const [isOpen, setIsOpen] = useState(false);
  const [editDialog, setEditDialog] = useState({
    open: false,
    id: "",
    name: "",
    confirmName: "",
    icon: "",
    openDeleteConfirm: false,
  });
  const [createDialog, setCreateDialog] = useState({
    open: false,
    name: "",
    icon: "📓",
    error: "",
  });

  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const notebookList = Object.values(notebooks).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const canDeleteNotebook = Object.keys(notebooks).length > 1;

  const handleCreate = () => {
    setCreateDialog({ open: true, name: "", icon: "📓", error: "" });
    setIsOpen(false);
  };

  const handleConfirmCreate = () => {
    if (!createDialog.name.trim()) {
      setCreateDialog({ ...createDialog, error: "请输入记事本名称" });
      return;
    }

    const nameExists = Object.values(notebooks).some(
      (nb) => nb.name.toLowerCase() === createDialog.name.trim().toLowerCase(),
    );
    if (nameExists) {
      setCreateDialog({ ...createDialog, error: "记事本名称已存在" });
      return;
    }

    createNotebook(createDialog.name.trim(), createDialog.icon);
    setActivePage(null);
    setCreateDialog({ open: false, name: "", icon: "📓", error: "" });
  };

  const handleOpenLocalFolder = async () => {
    try {
      const utools = (window as Window & {
        utools?: {
          showOpenDialog?: (options: {
            title?: string;
            properties: string[];
          }) => Promise<string[] | null>;
        };
      }).utools;
      if (typeof utools?.showOpenDialog === "function") {
        const result = await utools.showOpenDialog({
          title: "选择 Markdown 文件夹",
          properties: ["openDirectory"],
        });
        if (result && result.length > 0) {
          const folderName = result[0].split(/[\\/]/).pop() || "Unknown";
          const notebookId = createLocalFolderNotebook(folderName, result[0]);
          await usePages
            .getState()
            .loadLocalFolderPages(notebookId, result[0], {
              showWelcome: true,
            });
          setActiveNotebook(notebookId);
          setActivePage(null);
        }
      } else {
        const path = await window.gooseFs?.selectDirectory?.();
        if (path) {
          const folderName = path.split(/[\\/]/).pop() || "Unknown";
          const notebookId = createLocalFolderNotebook(folderName, path);
          await usePages
            .getState()
            .loadLocalFolderPages(notebookId, path, {
              showWelcome: true,
            });
          setActiveNotebook(notebookId);
          setActivePage(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsOpen(false);
    }
  };

  const handleEdit = (id: string) => {
    const notebook = notebooks[id];
    if (!notebook) return;

    setEditDialog({
      open: true,
      id,
      name: notebook.name,
      confirmName: notebook.name,
      icon: notebook.icon || "📓",
      openDeleteConfirm: false,
    });
  };

  const handleSaveEdit = () => {
    if (!editDialog.id) return;
    updateNotebook(editDialog.id, {
      name: editDialog.name,
      icon: editDialog.icon,
    });
    setEditDialog({ ...editDialog, open: false });
  };

  const handleDelete = () => {
    if (!editDialog.id) return;
    deleteNotebook(editDialog.id);
    setEditDialog({ ...editDialog, open: false });
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <div
            className="w-full"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
          >
            <Button
              variant="ghost"
              className="w-full justify-between px-1 h-auto py-1 font-medium hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                {activeNotebook &&
                  renderNotebookIcon(activeNotebook.icon || "📓", "h-4 w-4")}
                <span className="truncate text-sm">
                  {activeNotebook?.name || "选择记事本"}
                </span>
              </div>
              <LucideIcons.ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[312px]"
          align="start"
          sideOffset={-4}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {notebookList.map((notebook) => (
            <DropdownMenuItem
              key={notebook.id}
              className={cn(
                "flex items-center justify-between gap-2 group",
                notebook.localPathMissing && "opacity-50",
              )}
              onClick={() => {
                if (notebook.localPathMissing) return;
                setActiveNotebook(notebook.id);
                const lastPageId = getLastActivePage(notebook.id);
                const { pages } = usePages.getState();
                const lastPage = lastPageId ? pages[lastPageId] : null;
                if (lastPage && !lastPage.trashedAt) {
                  setActivePage(lastPageId);
                } else {
                  const firstValidPage = Object.values(pages)
                    .filter(
                      (p) => p.workspaceId === notebook.id && !p.trashedAt,
                    )
                    .sort(
                      (a, b) =>
                        (a.order ?? a.createdAt) - (b.order ?? b.createdAt),
                    )[0];
                  setActivePage(firstValidPage?.id ?? null);
                }
                setIsOpen(false);
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {renderNotebookIcon(notebook.icon || "📓")}
                <span className="truncate">{notebook.name}</span>
                {notebook.localPathMissing && (
                  <span className="text-xs text-destructive">路径失效</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 justify-end">
                {notebook.source === "local-folder" ? (
                  canDeleteNotebook && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-0 opacity-0 overflow-hidden px-0 group-hover:w-6 group-hover:opacity-100 group-hover:px-0 transition-all pointer-events-none group-hover:pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotebook(notebook.id);
                      }}
                      title="删除本地记事本"
                    >
                      <LucideIcons.Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-0 opacity-0 overflow-hidden px-0 group-hover:w-6 group-hover:opacity-100 group-hover:px-0 transition-all pointer-events-none group-hover:pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(notebook.id);
                    }}
                  >
                    <LucideIcons.Settings className="h-3.5 w-3.5" />
                  </Button>
                )}
                {activeNotebookId === notebook.id && (
                  <LucideIcons.Check className="h-4 w-4" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuGroup className="grid grid-cols-2 gap-2 px-2 pt-1.5 pb-2">
            <DropdownMenuItem
              className="justify-start gap-2 whitespace-nowrap rounded-[8px] px-2.5 py-2"
              onClick={handleCreate}
            >
              <LucideIcons.BookPlus className="h-4 w-4" />
              新建记事本
            </DropdownMenuItem>
            <DropdownMenuItem
              className="justify-start gap-2 whitespace-nowrap rounded-[8px] px-2.5 py-2"
              onClick={handleOpenLocalFolder}
            >
              <LucideIcons.FolderOpen className="h-4 w-4" />
              打开
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotebookEditDialog
        open={editDialog.open}
        notebookId={editDialog.id}
        name={editDialog.name}
        confirmName={editDialog.confirmName}
        icon={editDialog.icon}
        openDeleteConfirm={editDialog.openDeleteConfirm}
        onOpenChange={(open) => setEditDialog({ ...editDialog, open })}
        onNameChange={(name) => setEditDialog({ ...editDialog, name })}
        onIconChange={(icon) => setEditDialog({ ...editDialog, icon })}
        onSave={handleSaveEdit}
        onDelete={handleDelete}
      />

      <NotebookCreateDialog
        open={createDialog.open}
        name={createDialog.name}
        icon={createDialog.icon}
        error={createDialog.error}
        onOpenChange={(open) =>
          setCreateDialog({ ...createDialog, open, error: "" })
        }
        onNameChange={(name) => setCreateDialog({ ...createDialog, name })}
        onIconChange={(icon) => setCreateDialog({ ...createDialog, icon })}
        onCreate={handleConfirmCreate}
        onClearError={() =>
          createDialog.error && setCreateDialog({ ...createDialog, error: "" })
        }
      />
    </>
  );
}
