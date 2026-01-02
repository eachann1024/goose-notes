interface SidebarFooterProps {
  onOpenTrash: () => void;
  onOpenSettings: () => void;
}

export function SidebarFooter({ onOpenTrash, onOpenSettings }: SidebarFooterProps) {
  return (
    <div className="p-2 mt-auto border-t bg-background/50 backdrop-blur-sm space-y-1">
      <Button
        variant="ghost"
        className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
        onClick={onOpenTrash}
      >
        <LucideIcons.Trash2 className="mr-2 h-4 w-4" />
        <span className="text-sm">垃圾箱</span>
      </Button>
      <Button
        variant="ghost"
        className="w-full justify-start text-muted-foreground hover:text-foreground h-8 px-2"
        onClick={onOpenSettings}
      >
        <LucideIcons.Settings className="mr-2 h-4 w-4" />
        <span className="text-sm">设置</span>
      </Button>
    </div>
  );
}
