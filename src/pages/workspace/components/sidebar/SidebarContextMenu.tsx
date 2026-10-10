import { renderSidebarContextGroups } from "./sidebar-context-menu/renderSidebarContextGroups";
import { SidebarRenameContext } from "./SidebarInlineRename";
import { type SidebarContextMenuProps } from "./sidebar-context-menu/shared";
import { useSidebarContextMenu } from "./sidebar-context-menu/useSidebarContextMenu";

export function SidebarContextMenu(props: SidebarContextMenuProps) {
  const sidebarContextMenuContext = useSidebarContextMenu(props);
  const context = sidebarContextMenuContext;
  const {
    page,
    children,
    menuOpen,
    setMenuOpen,
    renaming,
    setRenaming,
    rowRef,
    canRename,
  } = context;

  return (
    <SidebarRenameContext.Provider
      value={{ page, renaming, setRenaming, rowRef }}
    >
      <ContextMenu onOpenChange={setMenuOpen}>
        <ContextMenuTrigger asChild className="w-full">
          <div
            ref={rowRef}
            tabIndex={-1}
            onDragStartCapture={(event) => {
              if (renaming) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onKeyDownCapture={(event) => {
              if (
                !canRename ||
                renaming ||
                event.target instanceof HTMLInputElement ||
                (event.target as HTMLElement).closest(
                  "button, [contenteditable=true]",
                )
              )
                return;
              if (
                event.key === "F2" &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.shiftKey
              ) {
                event.preventDefault();
                event.stopPropagation();
                setRenaming(true);
              }
            }}
            data-goose-context-trigger="true"
            data-context-open={menuOpen ? "true" : undefined}
            className="h-full w-full"
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="goose-sidebar-context-menu w-60"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {renderSidebarContextGroups(context)}
        </ContextMenuContent>
      </ContextMenu>
    </SidebarRenameContext.Provider>
  );
}
