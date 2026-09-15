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
    <div className="mt-auto shrink-0 pr-2">
      <NotebookSwitcher {...props} />
    </div>
  );
}
