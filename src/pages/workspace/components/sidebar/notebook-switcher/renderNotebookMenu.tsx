import * as GooseIcons from "@/components/ui/icons";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PopoverContent, PopoverAction } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { isElectronHost } from "@/lib/local-vault";
import { activateWorkspace } from "@/lib/settings-navigation";
import { activateNotebook } from "@/lib/notebookNavigation";
import type { useNotebookSwitcherActions } from "./useNotebookSwitcherActions";
import { SortableNotebookItem } from "./shared";

export function renderNotebookMenu(
  context: ReturnType<typeof useNotebookSwitcherActions>,
) {
  const {
    onOpenSettings,
    variant,
    toggleDarkMode,
    toggleSidebarCollapsed,
    activeNotebookId,
    deleteNotebook,
    setIsOpen,
    isDraggingRef,
    menuRef,
    sensors,
    isRail,
    notebookKind,
    notebookList,
    canDeleteNotebook,
    handleCreate,
    handleOpenLocalFolder,
    handleEdit,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = context;
  return (
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
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
          return;
        const rows = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            ".goose-notebook-row",
          ),
        );
        if (!rows.length) return;
        event.preventDefault();
        const current = rows.findIndex((row) =>
          row.contains(document.activeElement),
        );
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : event.key === "ArrowDown"
                ? (current + 1) % rows.length
                : current < 0
                  ? rows.length - 1
                  : (current - 1 + rows.length) % rows.length;
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
      <div className="px-2 pt-2 pb-1 text-[11px] text-muted-foreground">
        切换{notebookKind}
      </div>
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
            新建笔记本
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
  );
}
