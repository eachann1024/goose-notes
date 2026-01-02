type SettingsTab = "general" | "appearance" | "data";

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsSidebar({
  activeTab,
  onTabChange,
}: SettingsSidebarProps) {
  return (
    <div className="w-48 border-r py-4 px-2 bg-muted/50">
      <h2 className="px-2 text-xs font-semibold text-muted-foreground mb-2">
        设置
      </h2>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "justify-start w-full",
            activeTab === "general" && "bg-accent/50",
          )}
          onClick={() => onTabChange("general")}
        >
          <LucideIcons.Settings className="mr-2 h-4 w-4" />
          通用
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "justify-start w-full",
            activeTab === "appearance" && "bg-accent/50",
          )}
          onClick={() => onTabChange("appearance")}
        >
          <LucideIcons.Laptop className="mr-2 h-4 w-4" />
          外观
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "justify-start w-full",
            activeTab === "data" && "bg-accent/50",
          )}
          onClick={() => onTabChange("data")}
        >
          <LucideIcons.Database className="mr-2 h-4 w-4" />
          数据管理
        </Button>
      </div>
    </div>
  );
}
