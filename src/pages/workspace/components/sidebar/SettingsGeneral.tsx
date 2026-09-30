import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import * as LucideIcons from "lucide-react";
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
              <div className="flex items-center gap-3"><LucideIcons.FileClock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="auto-open-last-note" className="cursor-pointer">自动打开上次笔记</Label></div>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">打开应用就直接跳到你上次编辑的那篇笔记，省去再点一次的麻烦。</p>
            </div>
            <Switch id="auto-open-last-note" checked={autoOpenLastNote} onCheckedChange={setAutoOpenLastNote} className={SWITCH_CLASS} />
          </div>
          <div className={`mt-2 flex items-center justify-between gap-4 p-4 ${ROW_CLASS}`}>
            <div>
              <div className="flex items-center gap-3"><LucideIcons.MousePointer2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="notebook-hover-expand" className="cursor-pointer">悬停展开笔记本切换</Label></div>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">鼠标停在笔记本名称上就自动弹出切换菜单，不用点击。</p>
            </div>
            <Switch id="notebook-hover-expand" checked={notebookDropdownHoverExpand} onCheckedChange={setNotebookDropdownHoverExpand} className={SWITCH_CLASS} />
          </div>
          {__HOST_TARGET__ === "electron" && (
            <div className={`mt-2 flex items-center justify-between gap-4 p-4 ${ROW_CLASS}`}>
              <div>
                <div className="flex items-center gap-3"><LucideIcons.Pin className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="window-always-on-top" className="cursor-pointer">窗口置顶</Label></div>
                <p className="mt-1 pl-7 text-xs text-muted-foreground">让笔记窗口保持在其他窗口上方。</p>
              </div>
              <Switch id="window-always-on-top" checked={alwaysOnTop} onCheckedChange={toggleAlwaysOnTop} className={SWITCH_CLASS} />
            </div>
          )}
        </SettingsSectionCard>
        <SettingsSectionCard title="搜索设置">
          <div className={`flex items-center justify-between gap-4 p-4 ${ROW_CLASS}`}>
            <div>
              <div className="flex items-center gap-3"><LucideIcons.History className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} /><Label htmlFor="show-recent-in-search" className="cursor-pointer">搜索框显示最近访问</Label></div>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">关闭后搜索框里不再出现「最近访问」分组，只显示搜索结果。</p>
            </div>
            <Switch id="show-recent-in-search" checked={showRecentInSearch} onCheckedChange={setShowRecentInSearch} className={SWITCH_CLASS} />
          </div>
        </SettingsSectionCard>
      </div>
    </div>
  );
}
