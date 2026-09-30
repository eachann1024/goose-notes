import * as GooseIcons from "@/components/ui/icons";
import { resolvePageIcon } from "@/lib/resolvePageIcon";
import type { Page } from "@/types";
import type { LocalFolderLoadStatus } from "@/stores/useNotebooks";

interface LocalFileIconProps {
  page: Page;
  iconName?: string;
  isLocalFolder: boolean;
  className?: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
}

/**
 * 侧栏行是不是文件夹：本地仓库看 isFolder，内置笔记本看是否已有子页面。
 * 只有文件夹行画图标、才有展开箭头。
 */
export function isSidebarFolderRow({
  isFolder,
  hasChildren,
  isLocalNotebook,
}: {
  isFolder: boolean;
  hasChildren: boolean;
  isLocalNotebook: boolean;
}): boolean {
  return isLocalNotebook ? isFolder : hasChildren;
}

/** 本地仓库：每一级文件夹都显示展开箭头，不论当前有没有子项。 */
export function shouldShowFolderExpandArrow(args: {
  isFolder: boolean;
  hasChildren: boolean;
  isLocalNotebook: boolean;
}): boolean {
  return isSidebarFolderRow(args);
}

/**
 * 空文件夹占位：文件夹行展开后确实一个子项都没有才显示。
 * 本地仓库读取中/读取失败时不能冒充空目录——那只是还没扫到。
 */
export function shouldShowEmptyFolderPlaceholder({
  isFolderRow,
  isExpanded,
  hasChildren,
  isLocalNotebook,
  localLoadStatus,
}: {
  isFolderRow: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  isLocalNotebook: boolean;
  localLoadStatus?: LocalFolderLoadStatus;
}): boolean {
  if (!isFolderRow || !isExpanded || hasChildren) return false;
  if (isLocalNotebook && (localLoadStatus === "loading" || localLoadStatus === "error")) {
    return false;
  }
  return true;
}

function nodeHasVisibleContent(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const value = node as {
    text?: unknown;
    content?: unknown;
    type?: unknown;
  };

  if (typeof value.text === "string" && value.text.trim().length > 0) {
    return true;
  }

  const children = Array.isArray(value.content) ? value.content : [];
  if (children.some((child: unknown) => nodeHasVisibleContent(child))) {
    return true;
  }

  if (
    value.type === "doc" ||
    value.type === "paragraph" ||
    value.type === "heading" ||
    value.type === "text" ||
    value.type === "hardBreak"
  ) {
    return false;
  }

  return typeof value.type === "string" && value.type.length > 0;
}

const visibleContentCache = new WeakMap<object, boolean>();

function pageHasVisibleContent(page: Page): boolean {
  const content = page.content;
  if (!content || typeof content !== "object") return false;
  const cached = visibleContentCache.get(content);
  if (cached !== undefined) return cached;
  const result = nodeHasVisibleContent(content);
  visibleContentCache.set(content, result);
  return result;
}

export function LocalFileIcon({
  page,
  iconName,
  isLocalFolder,
  className,
  hasChildren,
  isExpanded,
}: LocalFileIconProps) {
  const SelectedIcon = resolvePageIcon(iconName);

  if (page.localReadState === "error") {
    return (
      <GooseIcons.CircleX
        size={16}
        className={cn("h-4 w-4 text-destructive/90", className)}
        aria-label={page.localReadError || "Markdown 文件读取失败"}
      />
    );
  }

  // 本地仓库：目录默认用文件夹图标（开合状态跟箭头走），右键菜单换过的图标优先。
  if (isLocalFolder && page.isFolder) {
    const Icon =
      SelectedIcon ?? (isExpanded ? GooseIcons.FolderOpen : GooseIcons.Folder);
    return (
      <Icon
        size={16}
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  if (SelectedIcon) {
    return (
      <SelectedIcon
        size={16}
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  const DefaultPageIcon = isLocalFolder
    ? GooseIcons.FileMd
    : pageHasVisibleContent(page) ? GooseIcons.FileText : GooseIcons.File;

  if (isLocalFolder) {
    return (
      <DefaultPageIcon
        size={16}
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  // 内置笔记本：有子页面且未自定义图标时，用"有内容的文件夹"标识可展开
  if (hasChildren) {
    const FolderStateIcon = isExpanded ? GooseIcons.FolderOpen : GooseIcons.Folder;
    return (
      <FolderStateIcon
        size={16}
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  // 已设置 iconName 但 lucide 中不存在该 key（升级/改名导致）：
  // fallback 到默认图标，避免把英文字符串直接渲染到侧栏。
  if (page.isFolder) {
    const FolderIcon = isExpanded ? GooseIcons.FolderOpen : GooseIcons.Folder;
    return (
      <FolderIcon
        size={16}
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  return (
    <DefaultPageIcon
      size={16}
      className={cn(
        "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
        className,
      )}
    />
  );
}
