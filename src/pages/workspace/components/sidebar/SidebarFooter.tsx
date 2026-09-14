import { NotebookSwitcher } from "./NotebookSwitcher";

export interface SidebarFooterProps {
  currentView: "pages" | "trash" | "outline";
  isSettingsOpen: boolean;
  hideTrash?: boolean;
  onSwitchToTrash: () => void;
  onOpenSettings: () => void;
}

export function SidebarFooter(props: SidebarFooterProps) {
  return (
    <div className="mt-auto shrink-0 border-t border-border/60 pt-2 pr-2">
      <div className="rounded-xl border border-border/60 bg-background/60 p-1">
        <NotebookSwitcher {...props} />
      </div>
    </div>
  );
}
