import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCAL_FOLDER_EDITOR_CANDIDATES,
  LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  LOCAL_FOLDER_TERMINAL_CANDIDATES,
  type LocalFolderOpenAppCandidate,
} from "@/lib/local-folder-open-apps";
import { shell } from "@/lib/utools/shell";
import * as LucideIcons from "lucide-react";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";

interface SettingsLocalFolderProps {
  localFolderFileManager: string;
  setLocalFolderFileManager: (value: string) => void;
  localFolderExternalEditor: string;
  setLocalFolderExternalEditor: (value: string) => void;
  localFolderTerminal: string;
  setLocalFolderTerminal: (value: string) => void;
}

interface OpenAppFieldProps {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  onChange: (value: string) => void;
  defaultLabel: string;
  customPlaceholder: string;
  options: LocalFolderOpenAppCandidate[];
}

const SYSTEM_VALUE = "__system__";
const CUSTOM_VALUE = "__custom__";

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

function getSystemDefaultLabels() {
  const platform = navigator.platform || navigator.userAgent;
  if (/Win/i.test(platform)) {
    return {
      fileManager: "系统默认（资源管理器）",
      terminal: "系统默认（命令提示符）",
    };
  }
  if (/Mac/i.test(platform)) {
    return {
      fileManager: "系统默认（访达）",
      terminal: "系统默认（终端）",
    };
  }
  return {
    fileManager: "系统默认（文件管理器）",
    terminal: "系统默认（终端）",
  };
}

function OpenAppField({
  id,
  title,
  description,
  icon: Icon,
  value,
  onChange,
  defaultLabel,
  customPlaceholder,
  options,
}: OpenAppFieldProps) {
  const trimmedValue = value.trim();
  const matchedOption = useMemo(
    () => options.find((option) => option.appName === trimmedValue),
    [options, trimmedValue],
  );
  const isCustomValue = Boolean(trimmedValue && !matchedOption);
  const [customActive, setCustomActive] = useState(isCustomValue);

  useEffect(() => {
    if (isCustomValue) {
      setCustomActive(true);
      return;
    }
    if (trimmedValue && matchedOption) {
      setCustomActive(false);
    }
  }, [isCustomValue, matchedOption, trimmedValue]);

  const selectedValue = customActive && !trimmedValue
    ? CUSTOM_VALUE
    : !trimmedValue
      ? SYSTEM_VALUE
      : matchedOption?.appName ?? CUSTOM_VALUE;
  const selectedLabel = customActive && !trimmedValue
    ? "自定义"
    : !trimmedValue
      ? defaultLabel
      : matchedOption?.label ?? trimmedValue;
  const showCustomInput = customActive || isCustomValue;

  const handleSelect = (nextValue: string) => {
    if (nextValue === SYSTEM_VALUE) {
      setCustomActive(false);
      onChange("");
      return;
    }
    if (nextValue === CUSTOM_VALUE) {
      setCustomActive(true);
      return;
    }
    setCustomActive(false);
    onChange(nextValue);
  };

  return (
    <div className={`space-y-3 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <Label htmlFor={`${id}-custom`} className="cursor-pointer">
              {title}
            </Label>
          </div>
          <p className="mt-1 pl-7 text-xs text-muted-foreground">{description}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 min-w-36 max-w-56 shrink-0 items-center justify-between gap-2 rounded-[10px] bg-[hsl(var(--background))] px-3 text-left text-sm text-foreground shadow-[inset_0_0_0_1px_hsl(var(--input))] transition-colors hover:bg-[var(--goose-interactive-hover)] focus:bg-[var(--goose-interactive-selected)]"
            >
              <span className="truncate">{selectedLabel}</span>
              <LucideIcons.ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuRadioGroup value={selectedValue} onValueChange={handleSelect}>
              <DropdownMenuRadioItem value={SYSTEM_VALUE}>
                <span className="truncate">{defaultLabel}</span>
              </DropdownMenuRadioItem>
              {options.map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.appName}>
                  <span className="truncate">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value={CUSTOM_VALUE}>
                <span>自定义</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showCustomInput && (
        <div className="pl-7">
          <Input
            id={`${id}-custom`}
            value={trimmedValue}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onChange(event.target.value.trim())}
            placeholder={customPlaceholder}
            className="h-9 text-sm"
          />
        </div>
      )}
    </div>
  );
}

export function SettingsLocalFolder({
  localFolderFileManager,
  setLocalFolderFileManager,
  localFolderExternalEditor,
  setLocalFolderExternalEditor,
  localFolderTerminal,
  setLocalFolderTerminal,
}: SettingsLocalFolderProps) {
  const [fileManagerOptions, setFileManagerOptions] = useState<LocalFolderOpenAppCandidate[]>([]);
  const [editorOptions, setEditorOptions] = useState<LocalFolderOpenAppCandidate[]>([]);
  const [terminalOptions, setTerminalOptions] = useState<LocalFolderOpenAppCandidate[]>([]);
  const systemDefaultLabels = useMemo(getSystemDefaultLabels, []);

  useEffect(() => {
    let cancelled = false;

    const loadAvailableApps = async () => {
      const [fileManagers, editors, terminals] = await Promise.all([
        shell.listAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES),
      ]);

      if (cancelled) return;
      setFileManagerOptions(fileManagers.filter((item) => item.id !== "finder"));
      setEditorOptions(editors);
      setTerminalOptions(terminals.filter((item) => item.id !== "terminal"));
    };

    void loadAvailableApps();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">本地文件夹</h3>
        <p className="mt-1 text-sm text-muted-foreground">仅对本地文件夹类型的记事本生效。</p>
      </div>

      <SettingsSectionCard title="打开方式">
        <div className="space-y-3">
          <OpenAppField
            id="local-folder-file-manager"
            title="文件管理器"
            description="右键打开或显示本地文件时使用。"
            icon={LucideIcons.FolderOpen}
            value={localFolderFileManager}
            onChange={setLocalFolderFileManager}
            defaultLabel={systemDefaultLabels.fileManager}
            customPlaceholder="如：Path Finder"
            options={fileManagerOptions}
          />
          <OpenAppField
            id="local-folder-editor"
            title="编辑器"
            description="右键用外部应用打开文件或文件夹时使用。"
            icon={LucideIcons.SquarePen}
            value={localFolderExternalEditor}
            onChange={setLocalFolderExternalEditor}
            defaultLabel="系统默认"
            customPlaceholder="如：Cursor、Zed、code -r"
            options={editorOptions}
          />
          <OpenAppField
            id="local-folder-terminal"
            title="终端"
            description="右键在终端中打开目录时使用。"
            icon={LucideIcons.Terminal}
            value={localFolderTerminal}
            onChange={setLocalFolderTerminal}
            defaultLabel={systemDefaultLabels.terminal}
            customPlaceholder="如：Ghostty、iTerm、wezterm"
            options={terminalOptions}
          />
        </div>
      </SettingsSectionCard>
    </div>
  );
}
