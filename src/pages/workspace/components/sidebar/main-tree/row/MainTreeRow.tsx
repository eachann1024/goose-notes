import {
  useEffect,
  useState,
  type DragEvent,
  type HTMLProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { Page } from "@/types";
import { isSidebarFolderRow, LocalFileIcon } from "../../local-file-icon";
import { usePages } from "@/stores/usePages";
import { isExternalFileDrag } from "@/lib/local-folder-target";
import { setLocalFolderFileDropTarget } from "@/lib/local-folder-file-drop-target";
import { MainTreeRowDisclosure, MainTreeRowShell } from "../MainTreeRowShell";
import { INDENT, ROW_PADDING_LEFT } from "./mainTreeRowConfig";

export function TreeRowIcon({
  page,
  isLocalFolder,
  isRenaming,
  hasChildren,
  isExpanded,
  onToggleExpanded,
}: {
  page: Page;
  isLocalFolder: boolean;
  isRenaming: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const iconName = usePages((s) => {
    const live = s.pages[page.id];
    return live ? live.icon : page?.icon;
  });
  // 文件夹占一个折叠槽和一个图标槽；子文件从自己的行起点放图标，
  // 因而正好与父文件夹的图标槽对齐，不额外缩进一列。
  const isFolderRow = isSidebarFolderRow({
    isFolder: !!page.isFolder,
    hasChildren,
    isLocalNotebook: isLocalFolder,
  });
  const renderedIcon = (
    <LocalFileIcon
      page={page}
      iconName={iconName}
      isLocalFolder={isLocalFolder}
      hasChildren={hasChildren}
      isExpanded={isExpanded}
    />
  );
  const stopDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const blockDragStart = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <span
      className="main-tree-row-icon-group pointer-events-none relative z-10 flex h-[18px] shrink-0 items-center gap-0"
      style={{ width: isFolderRow ? INDENT * 2 : INDENT, height: INDENT }}
    >
      {isFolderRow && !isRenaming ? (
        <MainTreeRowDisclosure
          expanded={isExpanded}
          label={isExpanded ? "折叠子项" : "展开子项"}
          onToggle={onToggleExpanded}
          className="ml-0 rounded-md pointer-events-auto"
          nativeProps={{
            draggable: false,
            style: { width: INDENT, height: INDENT },
            onDoubleClick: stopDoubleClick,
            onDragStart: blockDragStart,
          }}
        />
      ) : isFolderRow ? (
        <span
          className="main-tree-row-disclosure-placeholder shrink-0"
          style={{ width: INDENT, height: INDENT }}
          aria-hidden="true"
        />
      ) : null}
      <span className="main-tree-row-icon-slot pointer-events-none flex shrink-0 items-center justify-center">
        {renderedIcon}
      </span>
    </span>
  );
}

export function MainTreeRow({
  withoutChildren,
  isLocalFolder,
  isPendingCreate,
  isActive,
  isOver,
  isDragging,
  depth,
  itemIndex,
  children,
}: {
  withoutChildren: HTMLProps<HTMLDivElement>;
  isLocalFolder: boolean;
  isPendingCreate: boolean;
  isActive: boolean;
  isOver: boolean;
  isDragging: boolean;
  depth: number;
  itemIndex: string;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (isDragging) setHovered(false);
  }, [isDragging]);

  return (
    <MainTreeRowShell
      {...withoutChildren}
      onPointerEnter={() => {
        if (!isDragging) setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onDragEnter={
        isLocalFolder
          ? (e) => {
              if (!isExternalFileDrag(e.dataTransfer)) return;
              e.preventDefault();
              setLocalFolderFileDropTarget(itemIndex);
            }
          : undefined
      }
      onDragOver={
        isLocalFolder
          ? (e) => {
              if (!isExternalFileDrag(e.dataTransfer)) return;
              e.preventDefault();
              setLocalFolderFileDropTarget(itemIndex);
            }
          : undefined
      }
      className={cn(
        withoutChildren.className,
        // 行高用 --main-tree-row-height 锁成整数，避免 margin/子像素让 rct
        // computeItemHeight 与真实行距不一致（Electron 越往下越拖不准）。
        isPendingCreate
          ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]"
          : "text-foreground",
        !isPendingCreate && !isDragging && hovered && "main-tree-row--hovered",
        isOver && "main-tree-row--drop-target",
        isDragging && "main-tree-row--dragging",
      )}
      active={!isPendingCreate && isActive}
      hovered={false}
      style={{ paddingLeft: depth * INDENT + ROW_PADDING_LEFT + 4 }}
    >
      {children}
    </MainTreeRowShell>
  );
}
