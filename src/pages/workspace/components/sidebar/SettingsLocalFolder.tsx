import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import * as GooseIcons from "@/components/ui/icons";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import {
  isElectronHost,
  type SettingsLocalFolderProps,
  SETTINGS_OPTION_ROW_CLASS,
  SYSTEM_FILE_MANAGER_IDS,
  SYSTEM_TERMINAL_IDS,
  OpenAppField,
  HiddenFoldersField,
  LegacyInternalPagesExportCard,
} from "./local-folder-settings/shared";
import { useLocalFolderSettings } from "./local-folder-settings/useLocalFolderSettings";

export function SettingsLocalFolder(props: SettingsLocalFolderProps) {
  const localFolderSettingsContext = useLocalFolderSettings(props);
  const context = localFolderSettingsContext;
  const {
    localFolderFileManager,
    setLocalFolderFileManager,
    localFolderExternalEditor,
    setLocalFolderExternalEditor,
    localFolderTerminal,
    setLocalFolderTerminal,
    localFolderHiddenFolders,
    fileManagerOptions,
    editorOptions,
    terminalOptions,
    systemDefaultLabels,
    openAssetMaintenance,
    handleHiddenFoldersChange,
  } = context;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        本地文件夹
      </h3>

      <div className="settings-card-columns">
        <div className="space-y-5">
          {isElectronHost && <LegacyInternalPagesExportCard />}

          <SettingsSectionCard title="打开方式">
            <div className="space-y-3">
              <OpenAppField
                id="local-folder-file-manager"
                title="文件管理器"
                description="右键打开或显示本地文件时使用。"
                icon={GooseIcons.FolderOpen}
                value={localFolderFileManager}
                onChange={setLocalFolderFileManager}
                defaultLabel={systemDefaultLabels.fileManager}
                customPlaceholder="如：Path Finder"
                options={fileManagerOptions}
                systemIds={SYSTEM_FILE_MANAGER_IDS}
              />
              <OpenAppField
                id="local-folder-editor"
                title="编辑器"
                description="右键用外部应用打开文件或文件夹时使用。"
                icon={GooseIcons.SquarePen}
                value={localFolderExternalEditor}
                onChange={setLocalFolderExternalEditor}
                defaultLabel="默认"
                customPlaceholder="如：Cursor、Zed、code -r"
                options={editorOptions}
              />
              <OpenAppField
                id="local-folder-terminal"
                title="终端"
                description="右键在终端中打开目录时使用。"
                icon={GooseIcons.Terminal}
                value={localFolderTerminal}
                onChange={setLocalFolderTerminal}
                defaultLabel={systemDefaultLabels.terminal}
                customPlaceholder="如：Ghostty、iTerm、wezterm"
                options={terminalOptions}
                systemIds={SYSTEM_TERMINAL_IDS}
              />
            </div>
          </SettingsSectionCard>
        </div>
        <div className="space-y-5">
          <HiddenFoldersField
            folders={localFolderHiddenFolders}
            onChange={handleHiddenFoldersChange}
          />

          <SettingsSectionCard title="存储维护">
            <div
              className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <GooseIcons.Trash2
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <Label>清理未引用图片与视频</Label>
                </div>
                <p className="mt-1 pl-7 text-xs text-muted-foreground">
                  按笔记本扫描，确认后移入废纸篓。
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => void openAssetMaintenance()}
              >
                打开资源清理
              </Button>
            </div>
          </SettingsSectionCard>
        </div>
      </div>
    </div>
  );
}
