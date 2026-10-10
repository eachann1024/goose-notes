import { renderNotebookMenu } from "./notebook-switcher/renderNotebookMenu";
import * as GooseIcons from "@/components/ui/icons";
import "./notebook-switcher.css";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { NotebookCreateDialog } from "./NotebookCreateDialog";
import { NotebookEditDialog } from "./NotebookEditDialog";
import { isElectronHost } from "@/lib/local-vault";
import { useNotebookSwitcherState } from "./notebook-switcher/useNotebookSwitcherState";
import { useNotebookSwitcherActions } from "./notebook-switcher/useNotebookSwitcherActions";

export function NotebookSwitcher(
  props: {
    onOpenSettings?: () => void;
    variant?: "default" | "rail";
  } = {},
) {
  const switcher = useNotebookSwitcherState(props);
  const notebookSwitcherActionsContext = useNotebookSwitcherActions(switcher);
  const context = notebookSwitcherActionsContext;
  const {
    variant,
    notebookDropdownHoverExpand,
    isOpen,
    setIsOpen,
    isDraggingRef,
    menuRef,
    editDialog,
    setEditDialog,
    createDialog,
    setCreateDialog,
    activeNotebook,
    isRail,
    notebookKind,
    activeNotebookLabel,
    handleConfirmCreate,
    handleSaveEdit,
    handleDelete,
  } = context;

  return (
    <>
      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          if (!isDraggingRef.current) setIsOpen(open);
        }}
        variant="notebook"
        openOnHover={notebookDropdownHoverExpand}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`当前${notebookKind} ${activeNotebookLabel}，点击切换`}
                title={
                  isRail
                    ? `${activeNotebookLabel} · 点击切换${notebookKind}`
                    : undefined
                }
                className={cn(
                  "sidebar-notebook-trigger group text-foreground outline-none",
                  isRail && "sidebar-notebook-trigger--rail",
                )}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                    return;
                  event.preventDefault();
                  setIsOpen(true);
                  menuRef.current
                    ?.querySelector<HTMLElement>('[aria-current="true"]')
                    ?.focus();
                }}
              >
                <span aria-hidden="true" className="goose-notebook-monogram">
                  {Array.from(activeNotebook?.name.trim() || "")[0] || "N"}
                </span>
                <span
                  className="min-w-0 truncate leading-5"
                  title={activeNotebook?.name}
                  hidden={isRail}
                >
                  {activeNotebookLabel}
                </span>
                <GooseIcons.ChevronDown
                  className="goose-notebook-chevron"
                  aria-hidden="true"
                />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side={isRail ? "right" : "top"}>
            {activeNotebookLabel} · 点击切换{notebookKind}
          </TooltipContent>
        </Tooltip>
        {renderNotebookMenu(context)}
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
