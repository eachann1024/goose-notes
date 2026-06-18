import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as LucideIcons from "lucide-react";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";

interface SettingsLocalFolderProps {
  localFolderExternalEditor: string;
  setLocalFolderExternalEditor: (value: string) => void;
}

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

export function SettingsLocalFolder({
  localFolderExternalEditor,
  setLocalFolderExternalEditor,
}: SettingsLocalFolderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">本地文件夹</h3>
        <p className="mt-1 text-sm text-muted-foreground">仅对本地文件夹类型的记事本生效。</p>
      </div>

      <SettingsSectionCard title="外部编辑器">
        <div className={`space-y-2 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
          <div>
            <div className="flex items-center gap-3">
              <LucideIcons.SquarePen className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <Label htmlFor="external-editor" className="cursor-pointer">
                用外部编辑器打开
              </Label>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              macOS 填应用名称（如 Typora、Visual Studio Code），Windows 填可执行命令路径。留空则使用系统默认应用打开。
            </p>
          </div>
          <div className="pl-7">
            <Input
              id="external-editor"
              value={localFolderExternalEditor}
              onChange={(e) => setLocalFolderExternalEditor(e.target.value)}
              onBlur={(e) => setLocalFolderExternalEditor(e.target.value.trim())}
              placeholder="如：Typora"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
