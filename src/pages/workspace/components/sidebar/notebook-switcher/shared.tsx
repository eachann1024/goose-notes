import * as GooseIcons from "@/components/ui/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Notebook } from "@/stores/useNotebooks";

export interface SortableNotebookItemProps {
  notebook: Notebook;
  isActive: boolean;
  canDeleteNotebook: boolean;
  onActivate: (id: string) => void;
  onEdit: (id: string) => void;
  onDeleteLocal: (id: string) => void;
}

export function SortableNotebookItem({
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
        notebook.localPathMissing && "text-disabled",
        "hover:bg-[var(--goose-interactive-hover)] focus-visible:bg-[var(--goose-interactive-hover)]",
        isActive && "bg-[var(--goose-interactive-selected)]",
        isDragging && "cursor-grabbing z-10",
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
        <span className="truncate leading-snug" title={notebook.name}>
          {notebook.name}
        </span>
        {notebook.localPathMissing && (
          <span className="text-xs text-danger">路径失效</span>
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
                aria-label="编辑笔记本"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(notebook.id);
                }}
              >
                <GooseIcons.Settings className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">编辑笔记本</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isActive && <GooseIcons.Check className="h-4 w-4" />}
      </div>
    </div>
  );
}
