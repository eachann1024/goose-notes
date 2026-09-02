import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Page } from "@/types";

interface LocalFileIconProps {
  page: Page;
  iconName?: string;
  isLocalFolder: boolean;
  className?: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
}

/** 本地仓库里的目录不能换图标；文件和内置笔记本页面可以。 */
export function canCustomizePageIcon(
  page: Pick<Page, "isFolder" | "localPendingCreate">,
  isLocalNotebook: boolean,
): boolean {
  if (page.localPendingCreate) return false;
  if (isLocalNotebook && page.isFolder) return false;
  return true;
}

/** 本地仓库：每一级文件夹都显示展开箭头，不论当前有没有子项。 */
export function shouldShowFolderExpandArrow({
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
  const iconComponentMap = LucideIcons as unknown as Record<string, LucideIcon>;
  const SelectedIcon = iconName ? iconComponentMap[iconName] : null;

  if (page.localReadState === "error") {
    return (
      <LucideIcons.CircleX
        className={cn("h-4 w-4 text-destructive/90", className)}
        aria-label={page.localReadError || "Markdown 文件读取失败"}
      />
    );
  }

  // 本地仓库：目录永远用文件夹图标，不吃自定义 icon。
  // 开合状态跟箭头走，避免收起时还显示打开的文件夹。
  if (isLocalFolder && page.isFolder) {
    const Icon = isExpanded ? LucideIcons.FolderOpen : LucideIcons.Folder;
    return (
      <Icon
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  if (SelectedIcon) {
    return <SelectedIcon className={cn("h-4 w-4", className)} />;
  }

  const DefaultPageIcon = pageHasVisibleContent(page)
    ? LucideIcons.FileText
    : LucideIcons.File;

  if (isLocalFolder) {
    return (
      <DefaultPageIcon
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  // 内置笔记本：有子页面且未自定义图标时，用"有内容的文件夹"标识可展开
  if (hasChildren) {
    return (
      <LucideIcons.FolderOpen
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
    const FolderIcon = hasChildren ? LucideIcons.FolderOpen : LucideIcons.Folder;
    return (
      <FolderIcon
        className={cn(
          "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
          className,
        )}
      />
    );
  }

  return (
    <DefaultPageIcon
      className={cn(
        "h-4 w-4 text-muted-foreground/80 dark:text-muted-foreground/80",
        className,
      )}
    />
  );
}
