import { NotebookCreateDialog } from "./NotebookCreateDialog";
import { NotebookEditDialog } from "./NotebookEditDialog";
import { renderNotebookIcon } from "./notebookUtils";

export function NotebookSwitcher() {
  const {
    notebooks,
    activeNotebookId,
    setActiveNotebook,
    createNotebook,
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
    icon: "",
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

  const handleEdit = (id: string) => {
    const notebook = notebooks[id];
    if (!notebook) return;

    setEditDialog({
      open: true,
      id,
      name: notebook.name,
      icon: notebook.icon || "📓",
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
    if (!editDialog.id || editDialog.id === "default-notebook") return;
    deleteNotebook(editDialog.id);
    setEditDialog({ ...editDialog, open: false });
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
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
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          {notebookList.map((notebook) => (
            <DropdownMenuItem
              key={notebook.id}
              className="flex items-center justify-between group"
              onClick={() => {
                setActiveNotebook(notebook.id);
                const lastPageId = getLastActivePage(notebook.id);
                setActivePage(lastPageId);
                setIsOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                {renderNotebookIcon(notebook.icon || "📓")}
                <span className="truncate">{notebook.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {activeNotebookId === notebook.id && (
                  <LucideIcons.Check className="h-4 w-4" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                    activeNotebookId === notebook.id && "opacity-0",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(notebook.id);
                  }}
                >
                  <LucideIcons.Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreate}>
            <LucideIcons.Plus className="mr-2 h-4 w-4" />
            新建记事本
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotebookEditDialog
        open={editDialog.open}
        notebookId={editDialog.id}
        name={editDialog.name}
        icon={editDialog.icon}
        isDefault={editDialog.id === "default-notebook"}
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
          createDialog.error &&
          setCreateDialog({ ...createDialog, error: "" })
        }
      />
    </>
  );
}
