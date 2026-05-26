import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Page } from "@/types";

interface LocalFileIconProps {
  page: Page;
  iconName?: string;
  isLocalFolder: boolean;
  className?: string;
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

function pageHasVisibleContent(page: Page): boolean {
  return nodeHasVisibleContent(page.content);
}

export function LocalFileIcon({
  page,
  iconName,
  isLocalFolder,
  className,
}: LocalFileIconProps) {
  const iconComponentMap = LucideIcons as unknown as Record<string, LucideIcon>;
  const SelectedIcon = iconName ? iconComponentMap[iconName] : null;
  const DefaultPageIcon = pageHasVisibleContent(page)
    ? LucideIcons.FileText
    : LucideIcons.File;

  if (page.localReadState === "error") {
    return (
      <LucideIcons.CircleX
        className={cn("h-4 w-4 text-destructive/90", className)}
        aria-label={page.localReadError || "Markdown 文件读取失败"}
      />
    );
  }

  if (isLocalFolder) {
    const Icon = page.isFolder ? LucideIcons.Folder : DefaultPageIcon;
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

  // 已设置 iconName 但 lucide 中不存在该 key（升级/改名导致）：
  // fallback 到默认图标，避免把英文字符串直接渲染到侧栏。
  if (page.isFolder) {
    return (
      <LucideIcons.Folder
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
