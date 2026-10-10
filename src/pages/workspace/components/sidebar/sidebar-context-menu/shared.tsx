
import type { Page } from "@/types";
import { formatShortcut } from "@/lib/utils";
import { formatLocalFolderOpenAppName } from "@/lib/local-folder-open-apps";

export const _platform = navigator.platform || navigator.userAgent;

export const _isMac = /Mac/i.test(_platform);

export const _isWin = /Win/i.test(_platform);

export function getFinderLabel(isFolder: boolean) {
  const action = isFolder ? "打开" : "显示";
  if (_isMac) return `在访达中${action}`;
  if (_isWin) return `在资源管理器中${action}`;
  return `在文件管理器中${action}`;
}

export function MenuShortcut({ shortcut }: { shortcut: string }) {
  return (
    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
      {formatShortcut(shortcut)}
    </span>
  );
}

export function getExternalAppLabel(app: string): string {
  if (!app.trim()) return "用系统默认打开";
  return `用 ${formatLocalFolderOpenAppName(app, "外部应用")} 打开`;
}

export function getFileManagerLabel(
  isFolder: boolean,
  fileManager: string,
): string {
  if (!fileManager.trim()) return getFinderLabel(isFolder);
  return `用 ${formatLocalFolderOpenAppName(fileManager, "文件管理器")} 打开`;
}

export function getTerminalLabel(terminal: string): string {
  if (!terminal.trim()) return "在终端中打开";
  return `在 ${formatLocalFolderOpenAppName(terminal, "终端")} 中打开`;
}

export function scheduleAfterMenuClose(action: () => void) {
  window.setTimeout(action, 0);
}

export interface SidebarContextMenuProps {
  page: Page;
  children: React.ReactNode;
  /** 该行在侧栏里是不是文件夹行 */
  isFolderRow?: boolean;
  onCreateLocalFile?: (parentId?: string) => void;
  onCreateLocalFolder?: (parentId?: string) => void;
}
