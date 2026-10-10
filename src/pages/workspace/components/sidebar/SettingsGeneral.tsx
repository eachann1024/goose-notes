import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import * as GooseIcons from "@/components/ui/icons";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { useWindowAlwaysOnTop } from "@/hooks/useWindowAlwaysOnTop";

interface SettingsGeneralProps {
  autoOpenLastNote: boolean;
  setAutoOpenLastNote: (enabled: boolean) => void;
  showRecentInSearch: boolean;
  setShowRecentInSearch: (enabled: boolean) => void;
  notebookDropdownHoverExpand: boolean;
  setNotebookDropdownHoverExpand: (enabled: boolean) => void;
}

const ROW_CLASS = "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";
const SWITCH_CLASS = "data-[state=unchecked]:bg-[hsl(var(--foreground)/0.12)]";

export function SettingsGeneral({
  autoOpenLastNote, setAutoOpenLastNote,
  showRecentInSearch, setShowRecentInSearch,
  notebookDropdownHoverExpand, setNotebookDropdownHoverExpand,
}: SettingsGeneralProps) {
  const { alwaysOnTop, toggleAlwaysOnTop } = useWindowAlwaysOnTop();
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">通用</h3>
      <div className="space-y-5">
        <SettingsSectionCard title="行为设置">
          <div className={`flex items-center justify-between gap-4 p-4 ${ROW_CLASS}`}>
            <div>
              <div className="flex items-center gap-3"><GooseIcons.FileClock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="auto-open-last-note" className="cursor-pointer">自动打开最近笔记</Label></div>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">应用启动时自动恢复上次打开的笔记。</p>
            </div>
            <Switch id="auto-open-last-note" checked={autoOpenLastNote} onCheckedChange={setAutoOpenLastNote} className={SWITCH_CLASS} />
          </div>
          <div className={`mt-2 flex items-center justify-between gap-4 p-4 ${ROW_CLASS}`}>
            <div>
              <div className="flex items-center gap-3"><GooseIcons.MousePointer2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="notebook-hover-expand" className="cursor-pointer">悬停展开笔记本菜单</Label></div>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">鼠标悬停在笔记本切换栏时自动展开列表。</p>
            </div>
            <Switch id="notebook-hover-expand" checked={notebookDropdownHoverExpand} onCheckedChange={setNotebookDropdownHoverExpand} className={SWITCH_CLASS} />
          </div>
          {__HOST_TARGET__ === "electron" && (
            <div className={`mt-2 flex items-center justify-between gap-4 p-4 ${ROW_CLASS}`}>
              <div>
                <div className="flex items-center gap-3"><GooseIcons.Pin className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="window-always-on-top" className="cursor-pointer">窗口置顶</Label></div>
                <p className="mt-1 pl-7 text-xs text-muted-foreground">主窗口始终悬浮在其他应用上方。</p>
              </div>
              <Switch id="window-always-on-top" checked={alwaysOnTop} onCheckedChange={toggleAlwaysOnTop} className={SWITCH_CLASS} />
            </div>
          )}
        </SettingsSectionCard>
        <SettingsSectionCard title="搜索设置">
          <div className={`flex items-center justify-between gap-4 p-4 ${ROW_CLASS}`}>
            <div>
              <div className="flex items-center gap-3"><GooseIcons.History className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="show-recent-in-search" className="cursor-pointer">搜索面板展示最近访问</Label></div>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">开启后，在搜索面板默认展示最近浏览的笔记。</p>
            </div>
            <Switch id="show-recent-in-search" checked={showRecentInSearch} onCheckedChange={setShowRecentInSearch} className={SWITCH_CLASS} />
          </div>
        </SettingsSectionCard>
      </div>
    </div>
  );
}
