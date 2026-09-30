import * as GooseIcons from "@/components/ui/icons";
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
import { useSidebarView } from "@/stores/useSidebarView";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAction,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NotebookCreateDialog } from "./NotebookCreateDialog";
import { NotebookEditDialog } from "./NotebookEditDialog";
import { isElectronHost } from "@/lib/local-vault";
import { activateWorkspace } from "@/lib/settings-navigation";
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
        "goose-notebook-row relative flex select-none items-center rounded-lg outline-none",
        "justify-between gap-2 group",
        "min-h-9 mb-0.5 last:mb-0 px-2 py-1 text-xs font-normal",
        notebook.localPathMissing && "opacity-50",
        "hover:bg-[var(--goose-interactive-hover)] focus-visible:bg-[var(--goose-interactive-hover)]",
        isActive && "bg-[var(--goose-interactive-selected)]",
        isDragging && "opacity-60 cursor-grabbing z-10",
        !isDragging && "cursor-pointer",
      )}
      {...attributes}
      {...listeners}
      role="menuitem"
      aria-current={isActive ? "true" : undefined}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate(notebook.id);
        }
      }}
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
        <span className="goose-notebook-monogram" aria-hidden="true">
          {Array.from(notebook.name.trim())[0] || "N"}
        </span>
        <span className="truncate leading-snug" title={notebook.name}>{notebook.name}</span>
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
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 overflow-hidden px-0 text-muted-foreground transition-all duration-120 pointer-events-none hover:bg-[var(--goose-color-danger-subtle-bg)] hover:text-[var(--goose-color-danger)] group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto motion-reduce:transition-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLocal(notebook.id);
                  }}
                  aria-label="移除本地文件夹"
                >
                  <GooseIcons.FolderX className="h-3.5 w-3.5" />
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
                className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 overflow-hidden px-0 text-muted-foreground transition-all duration-120 pointer-events-none hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto motion-reduce:transition-none"
                aria-label="编辑记事本"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(notebook.id);
                }}
              >
                <GooseIcons.Settings className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">编辑记事本</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isActive && <GooseIcons.Check className="h-4 w-4" />}
      </div>
    </div>
  );
}

export function NotebookSwitcher({
  onOpenSettings,
  variant = "default",
}: {
  onOpenSettings?: () => void;
  variant?: "default" | "rail";
} = {}) {
  const toggleDarkMode = useSettings((s) => s.toggleDarkMode);

  const toggleSidebarCollapsed = useSidebarView(
    (s) => s.toggleSidebarCollapsed,
  );
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
  const isDraggingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 整行按住再拖：短点选切换仓库，按住后才进入排序，避免再做拖拽把手
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  useEffect(() => {
    if (!isOpen) return;
    const close = () => { if (!isDraggingRef.current) setIsOpen(false); };
    window.addEventListener("blur", close);
    return () => window.removeEventListener("blur", close);
  }, [isOpen]);

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
  const isRail = variant === "rail";
  const notebookKind = isElectronHost ? "文件夹" : "笔记本";
  const activeNotebookLabel =
    activeNotebook?.name || (isElectronHost ? "打开文件夹" : "选择记事本");
  const notebookList = sortNotebooksByOrder(notebooks);
  // Electron 仅本地文件夹模式：最后一个文件夹也允许移除（回到空态）
  const canDeleteNotebook = isElectronHost
    ? notebookList.length > 0
    : notebookList.length > 1;

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
    activateWorkspace();
    void activateNotebook(notebookId);
    setCreateDialog({ open: false, name: "", icon: "BookOpen", error: "" });
  };

  const handleOpenLocalFolder = async () => {
    try {
      const path = await dialogs.selectDirectory();
      if (path) {
        activateWorkspace();
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
      <Popover
        open={isOpen}
        onOpenChange={(open) => { if (!isDraggingRef.current) setIsOpen(open); }}
        variant="notebook"
        openOnHover={notebookDropdownHoverExpand}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`当前${notebookKind} ${activeNotebookLabel}，点击切换`}
                title={isRail ? `${activeNotebookLabel} · 点击切换${notebookKind}` : undefined}
                className={cn(
                  "sidebar-notebook-trigger group text-foreground outline-none",
                  isRail && "sidebar-notebook-trigger--rail",
                )}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                  event.preventDefault();
                  setIsOpen(true);
                  menuRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
                }}
              >
                <span
                  aria-hidden="true"
                  className="goose-notebook-monogram"
                >
                  {Array.from(activeNotebook?.name.trim() || "")[0] || "N"}
                </span>
                <span
                  className="min-w-0 truncate leading-5"
                  title={activeNotebook?.name}
                  hidden={isRail}
                >
                  {activeNotebookLabel}
                </span>
                <GooseIcons.ChevronDown className="goose-notebook-chevron" aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side={isRail ? "right" : "top"}>
            {activeNotebookLabel} · 点击切换{notebookKind}
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          aria-label={`切换${notebookKind}`}
          className={cn(
            "goose-notebook-menu-surface goose-floating-surface w-56 max-w-[calc(100vw-1rem)] p-1 backdrop-blur-0",
            isRail && "goose-notebook-menu-surface--rail",
          )}
          side={isRail ? "right" : "top"}
          align={isRail ? "end" : "start"}
          alignOffset={0}
          sideOffset={8}
          collisionPadding={8}
          ref={menuRef}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".goose-notebook-row"));
            if (!rows.length) return;
            event.preventDefault();
            const current = rows.findIndex(row => row.contains(document.activeElement));
            const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1
              : event.key === "ArrowDown" ? (current + 1) % rows.length
              : current < 0 ? rows.length - 1 : (current - 1 + rows.length) % rows.length;
            rows[next].focus();
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
          <div className="px-2 pt-2 pb-1 text-[11px] text-muted-foreground">切换{notebookKind}</div>
          <div className="max-h-[max(4rem,calc(var(--goose-popover-available-height,80vh)-15rem))] overflow-y-auto">
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
                      activateWorkspace();
                      void activateNotebook(id);
                      setIsOpen(false);
                    }}
                    onEdit={handleEdit}
                    onDeleteLocal={deleteNotebook}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="mx-1 my-1 h-px bg-border" />
          {isElectronHost ? (
            <PopoverAction
              className="min-h-9 w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap"
              onClick={handleOpenLocalFolder}
            >
              <GooseIcons.FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              打开文件夹
            </PopoverAction>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <PopoverAction
                className="min-h-9 w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap"
                onClick={handleCreate}
              >
                <GooseIcons.BookPlus className="h-3.5 w-3.5 text-muted-foreground" />
                新建记事本
              </PopoverAction>
              <PopoverAction
                className="min-h-9 w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 text-xs whitespace-nowrap"
                onClick={handleOpenLocalFolder}
              >
                <GooseIcons.FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                打开文件夹
              </PopoverAction>
            </div>
          )}

          {!isElectronHost && (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="切换外观"
                onClick={toggleDarkMode}
              >
                <GooseIcons.Sun className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="设置"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings?.();
                }}
              >
                <GooseIcons.Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!isElectronHost && (
            <PopoverAction
              onClick={() => {
                setIsOpen(false);
                toggleSidebarCollapsed();
              }}
            >
              <GooseIcons.PanelLeft className="h-4 w-4 text-muted-foreground" />
              收起侧栏
            </PopoverAction>
          )}
        </PopoverContent>
      </Popover>

      {editDialog.open && (
        <NotebookEditDialog
          open={editDialog.open}
          notebookId={editDialog.id}
          name={editDialog.name}
          confirmName={editDialog.confirmName}
          excludeFromGlobalSearch={editDialog.excludeFromGlobalSearch}
          openDeleteConfirm={editDialog.openDeleteConfirm}
          isLocalFolder={editDialog.isLocalFolder}
          onOpenChange={(open) => setEditDialog({ ...editDialog, open })}
          onNameChange={(name) => setEditDialog({ ...editDialog, name })}
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
          error={createDialog.error}
          onOpenChange={(open) =>
            setCreateDialog({ ...createDialog, open, error: "" })
          }
          onNameChange={(name) => setCreateDialog({ ...createDialog, name })}
          onCreate={handleConfirmCreate}
          onClearError={() =>
            createDialog.error &&
            setCreateDialog({ ...createDialog, error: "" })
          }
        />
      )}
    </>
  );
}
