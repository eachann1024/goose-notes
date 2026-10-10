import { formatShortcut } from "@/lib/utils";

export interface SidebarMainTreeProps {
  activeNotebookId: string | null;
  selectedPageId?: string | null;
  rowHeight: number;
  itemHeight: number;
  viewportHeight: number;
  onCreatePage: () => void;
}

export const PENDING_CREATE_ID_PREFIX = "local-pending-";

export function normalizePendingFileTitle(name: string): string {
  return name.replace(/\.(md|markdown)$/i, "").trim();
}

export function scheduleAfterMenuClose(action: () => void) {
  window.setTimeout(action, 0);
}

export function MenuShortcut({ shortcut }: { shortcut: string }) {
  return (
    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
      {formatShortcut(shortcut)}
    </span>
  );
}
