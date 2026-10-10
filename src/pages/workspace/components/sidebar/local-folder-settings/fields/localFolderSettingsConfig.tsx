import { type ComponentType } from "react";
import { type LocalFolderOpenAppCandidate } from "@/lib/local-folder-open-apps";

export const isElectronHost = __HOST_TARGET__ === "electron";

export interface SettingsLocalFolderProps {
  visible?: boolean;
  localFolderFileManager: string;
  setLocalFolderFileManager: (value: string) => void;
  localFolderExternalEditor: string;
  setLocalFolderExternalEditor: (value: string) => void;
  localFolderTerminal: string;
  setLocalFolderTerminal: (value: string) => void;
  localFolderHiddenFolders: string[];
  setLocalFolderHiddenFolders: (folders: string[]) => void;
}

export interface OpenAppFieldProps {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  onChange: (value: string) => void;
  defaultLabel: string;
  customPlaceholder: string;
  options: LocalFolderOpenAppCandidate[];
  systemIds?: ReadonlySet<string>;
}

export const SYSTEM_VALUE = "__system__";

export const CUSTOM_VALUE = "__custom__";

export const DEFAULT_HIDDEN_FOLDERS = ["assets"];

export const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

export const SYSTEM_FILE_MANAGER_IDS = new Set([
  "finder",
  "explorer",
  "nautilus",
]);

export const SYSTEM_TERMINAL_IDS = new Set([
  "terminal",
  "cmd",
  "x-terminal-emulator",
]);

export function getSystemDefaultLabels() {
  const platform = navigator.platform || navigator.userAgent;
  if (/Win/i.test(platform)) {
    return {
      fileManager: "默认（资源管理器）",
      terminal: "默认（命令提示符）",
    };
  }
  if (/Mac/i.test(platform)) {
    return {
      fileManager: "默认（访达）",
      terminal: "默认（终端）",
    };
  }
  return {
    fileManager: "默认（文件管理器）",
    terminal: "默认（终端）",
  };
}

export interface HiddenFoldersFieldProps {
  folders: string[];
  onChange: (folders: string[]) => void;
}
