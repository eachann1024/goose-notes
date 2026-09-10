import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./notebook-switcher.css";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAction,
} from "@/components/ui/popover";
import { NotebookCreateDialog } from "./NotebookCreateDialog";
import { NotebookEditDialog } from "./NotebookEditDialog";
import { CreateVaultDialog } from "./CreateVaultDialog";
import { isElectronHost, pickVaultParentDirectory } from "@/lib/local-vault";
import { renderNotebookIcon } from "./notebookUtils";
import { activateNotebook } from "@/lib/notebookNavigation";
import { dialogs } from "@/lib/electron-platform/dialogs";
import {
  sortNotebooksByOrder,
  type Notebook,
  useNotebooks,
} from "@/stores/useNotebooks";

interface SortableNotebookItemProps {
  notebook: Notebook;
  isActive: boolean;
  canDeleteNotebook: boolean;
  onActivate: (id: string) => void;
  onEdit: (id: string) => void;
  onDeleteLocal: (id: string) => void;
}

function SortableNotebookItem({
  notebook,
  isActive,
  canDeleteNotebook,
  onActivate,
  onEdit,
  onDeleteLocal,
}: SortableNotebookItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: notebook.id });
  const dragMoved = useRef(false);

  if (isDragging) dragMoved.current = true;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex select-none items-center rounded-sm outline-none",
        "justify-between gap-2 group",
        "min-h-9 mb-0.5 last:mb-0 py-1.5 px-2 text-xs",
        notebook.localPathMissing && "opacity-50",
        // 选中仓库在 hover 时保持相同的高亮底色。
        isActive
          ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] hover:bg-[var(--goose-interactive-selected)]"
          : "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]",
        isDragging && "opacity-60 cursor-grabbing z-10",
        !isDragging && "cursor-pointer",
      )}
      {...attributes}
      {...listeners}
      role="menuitem"
      tabIndex={-1}
      onPointerDown={(event) => {
        dragMoved.current = false;
        if (event.button !== 0 || event.ctrlKey) return;
        listeners?.onPointerDown?.(event);
      }}
      onClick={() => {
        if (dragMoved.current) {
          dragMoved.current = false;
          return;
        }
        // 路径失效也允许点击：重新触发存在性检测，若云盘目录恢复（如 iCloud 已物化）
        // 可自动清除「路径失效」并重新加载页面；若确实已删除则保持失效状态。
        onActivate(notebook.id);
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground group-hover:text-[var(--goose-interactive-selected-fg)]">
          {renderNotebookIcon(notebook.icon || "BookOpen", "h-3.5 w-3.5")}
        </span>
        <span className="truncate text-xs leading-snug">{notebook.name}</span>
        {notebook.localPathMissing && (
          <span className="text-xs text-destructive">路径失效</span>
        )}
      </div>
      <div
        className="flex items-center gap-1 shrink-0 justify-end"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {notebook.source === "local-folder" && canDeleteNotebook && (
          <TooltipProvider delayDuration={600}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 overflow-hidden px-0 text-muted-foreground transition-all duration-120 pointer-events-none hover:bg-[var(--goose-color-danger-subtle-bg)] hover:text-[var(--goose-color-danger)] group-hover:opacity-100 group-hover:pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLocal(notebook.id);
                  }}
                  aria-label="移除本地文件夹"
                >
                  <LucideIcons.FolderX className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">移除本地文件夹</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider delayDuration={600}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 overflow-hidden px-0 text-muted-foreground transition-all duration-120 pointer-events-none hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)] group-hover:opacity-100 group-hover:pointer-events-auto"
                aria-label="编辑记事本"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(notebook.id);
                }}
              >
                <LucideIcons.Settings className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">编辑记事本</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isActive && <LucideIcons.Check className="h-4 w-4" />}
      </div>
    </div>
  );
}

export function NotebookSwitcher() {
  const {
    notebooks,
    activeNotebookId,
    createNotebook,
    createLocalFolderNotebook,
    updateNotebook,
    deleteNotebook,
    reorderNotebooks,
  } = useNotebooks();
  const notebookDropdownHoverExpand = useSettings(
    (state) => state.notebookDropdownHoverExpand,
  );
  const [isOpen, setIsOpen] = useState(false);
  const hovering = useRef({ trigger: false, content: false });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 整行按住再拖：短点选切换仓库，按住后才进入排序，避免再做拖拽把手
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    [],
  );

  const scheduleClose = () => {
    if (isDraggingRef.current) return;
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      if (
        !isDraggingRef.current &&
        !hovering.current.trigger &&
        !hovering.current.content
      ) {
        setIsOpen(false);
      }
    }, 80);
  };

  const [editDialog, setEditDialog] = useState({
    open: false,
    id: "",
    name: "",
    confirmName: "",
    icon: "",
    excludeFromGlobalSearch: false,
    openDeleteConfirm: false,
    isLocalFolder: false,
  });
  const [createDialog, setCreateDialog] = useState({
    open: false,
    name: "",
    icon: "BookOpen",
    error: "",
  });

  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;
  const notebookList = sortNotebooksByOrder(notebooks);
  // Electron 仅本地文件夹模式：最后一个文件夹也允许移除（回到空态）
  const canDeleteNotebook = isElectronHost
    ? notebookList.length > 0
    : notebookList.length > 1;

  const [vaultDialog, setVaultDialog] = useState<{
    open: boolean;
    parentDir: string | null;
  }>({ open: false, parentDir: null });

  const handleCreateVault = async () => {
    setIsOpen(false);
    const parentDir = await pickVaultParentDirectory();
    if (parentDir) {
      setVaultDialog({ open: true, parentDir });
    }
  };

  const handleCreate = () => {
    setCreateDialog({ open: true, name: "", icon: "BookOpen", error: "" });
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

    const notebookId = createNotebook(
      createDialog.name.trim(),
      createDialog.icon,
    );
    void activateNotebook(notebookId);
    setCreateDialog({ open: false, name: "", icon: "BookOpen", error: "" });
  };

  const handleOpenLocalFolder = async () => {
    try {
      const path = await dialogs.selectDirectory();
      if (path) {
        const folderName = path.split(/[\\/]/).pop() || "Unknown";
        const notebookId = createLocalFolderNotebook(folderName, path);
        await usePages.getState().loadLocalFolderPages(notebookId, path, {
          showWelcome: true,
        });
        void activateNotebook(notebookId);
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
      icon:
        notebook.icon ||
        (notebook.source === "local-folder" ? "FolderOpen" : "BookOpen"),
      excludeFromGlobalSearch: Boolean(notebook.excludeFromGlobalSearch),
      openDeleteConfirm: false,
      isLocalFolder: notebook.source === "local-folder",
    });
    setIsOpen(false);
  };

  const handleSaveEdit = () => {
    if (!editDialog.id) return;
    updateNotebook(editDialog.id, {
      name: editDialog.name,
      icon: editDialog.icon,
      excludeFromGlobalSearch: editDialog.excludeFromGlobalSearch,
    });
    setEditDialog({ ...editDialog, open: false });
  };

  const handleDelete = () => {
    if (!editDialog.id) return;
    deleteNotebook(editDialog.id);
    setEditDialog({ ...editDialog, open: false });
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
    setIsOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isDraggingRef.current = false;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = notebookList.findIndex((nb) => nb.id === active.id);
    const newIndex = notebookList.findIndex((nb) => nb.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(notebookList, oldIndex, newIndex);
    reorderNotebooks(next.map((nb) => nb.id));
  };

  const handleDragCancel = () => {
    isDraggingRef.current = false;
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div
            className="w-full"
            onMouseEnter={() => {
              if (!notebookDropdownHoverExpand) return;
              hovering.current.trigger = true;
              if (closeTimer.current !== null) clearTimeout(closeTimer.current);
              setIsOpen(true);
            }}
            onMouseLeave={() => {
              if (!notebookDropdownHoverExpand) return;
              hovering.current.trigger = false;
              scheduleClose();
            }}
          >
            <Button
              variant="ghost"
              className={cn(
                "sidebar-notebook-trigger w-full justify-between px-2 h-9 py-0 font-medium text-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)] data-[state=open]:bg-[var(--goose-interactive-hover)] transition-colors",
                isOpen && "bg-[var(--goose-interactive-hover)]",
              )}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                {activeNotebook && (
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-foreground/70 text-[16px] leading-none">
                    {renderNotebookIcon(
                      activeNotebook.icon || "BookOpen",
                      "h-[18px] w-[18px] leading-none",
                    )}
                  </span>
                )}
                {/* leading-snug：truncate(overflow hidden) 配 leading-none 会裁掉 g/y/p 降部 */}
                <span className="truncate tracking-[0.01em] leading-snug">
                  {activeNotebook?.name ||
                    (isElectronHost ? "打开文件夹" : "选择记事本")}
                </span>
              </div>
              {isOpen ? (
                <LucideIcons.ChevronUp className="h-3.5 w-3.5 shrink-0 text-foreground/40 transition-transform" />
              ) : (
                <LucideIcons.ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground/40 transition-transform" />
              )}
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="goose-notebook-menu-surface w-[var(--goose-popover-trigger-width)] min-w-[13.75rem] max-w-[calc(100vw-1rem)] rounded-lg border border-border p-1.5 shadow-md before:content-[''] before:absolute before:left-0 before:right-0 before:-top-2 before:h-2 backdrop-blur-0 data-[state=closed]:animate-none data-[state=closed]:zoom-out-100 data-[state=closed]:duration-0"
          style={{ minWidth: 220 }}
          align="start"
          alignOffset={0}
          sideOffset={2}
          forceMount
          onMouseEnter={() => {
            if (!notebookDropdownHoverExpand) return;
            hovering.current.content = true;
            if (closeTimer.current !== null) clearTimeout(closeTimer.current);
          }}
          onMouseLeave={() => {
            if (!notebookDropdownHoverExpand) return;
            hovering.current.content = false;
            scheduleClose();
          }}
          onCloseAutoFocus={(e) => {
            if (isDraggingRef.current) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isDraggingRef.current) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isDraggingRef.current) e.preventDefault();
          }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={notebookList.map((nb) => nb.id)}
              strategy={verticalListSortingStrategy}
            >
              {notebookList.map((notebook) => (
                <SortableNotebookItem
                  key={notebook.id}
                  notebook={notebook}
                  isActive={activeNotebookId === notebook.id}
                  canDeleteNotebook={canDeleteNotebook}
                  onActivate={(id) => {
                    void activateNotebook(id);
                    setIsOpen(false);
                  }}
                  onEdit={handleEdit}
                  onDeleteLocal={deleteNotebook}
                />
              ))}
            </SortableContext>
          </DndContext>
          <div className="mx-1 my-1 h-px bg-border" />
          <div className="grid grid-cols-2 gap-1">
            {isElectronHost ? (
              <PopoverAction
                className="min-h-9 w-full justify-start gap-1.5 rounded-sm px-2 py-1.5 text-xs whitespace-nowrap"
                onClick={() => void handleCreateVault()}
              >
                <LucideIcons.FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                新建仓库
              </PopoverAction>
            ) : (
              <PopoverAction
                className="min-h-9 w-full justify-start gap-1.5 rounded-sm px-2 py-1.5 text-xs whitespace-nowrap"
                onClick={handleCreate}
              >
                <LucideIcons.BookPlus className="h-3.5 w-3.5 text-muted-foreground" />
                新建记事本
              </PopoverAction>
            )}
            <PopoverAction
              className="min-h-9 w-full justify-start gap-1.5 rounded-sm px-2 py-1.5 text-xs whitespace-nowrap"
              onClick={handleOpenLocalFolder}
            >
              <LucideIcons.FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              打开文件夹
            </PopoverAction>
          </div>
        </PopoverContent>
      </Popover>

      {editDialog.open && (
        <NotebookEditDialog
          open={editDialog.open}
          notebookId={editDialog.id}
          name={editDialog.name}
          confirmName={editDialog.confirmName}
          icon={editDialog.icon}
          excludeFromGlobalSearch={editDialog.excludeFromGlobalSearch}
          openDeleteConfirm={editDialog.openDeleteConfirm}
          isLocalFolder={editDialog.isLocalFolder}
          onOpenChange={(open) => setEditDialog({ ...editDialog, open })}
          onNameChange={(name) => setEditDialog({ ...editDialog, name })}
          onIconChange={(icon) => setEditDialog({ ...editDialog, icon })}
          onExcludeFromGlobalSearchChange={(excludeFromGlobalSearch) =>
            setEditDialog({ ...editDialog, excludeFromGlobalSearch })
          }
          onSave={handleSaveEdit}
          onDelete={handleDelete}
        />
      )}

      {createDialog.open && !isElectronHost && (
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
      )}
      {vaultDialog.open && (
        <CreateVaultDialog
          open={vaultDialog.open}
          parentDir={vaultDialog.parentDir}
          onOpenChange={(open) => setVaultDialog((prev) => ({ ...prev, open }))}
          onCreated={(id) => void activateNotebook(id)}
        />
      )}
    </>
  );
}
