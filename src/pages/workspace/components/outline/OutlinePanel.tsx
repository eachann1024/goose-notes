import { useCallback, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import {
  MainTreeRowDisclosure,
  MainTreeRowShell,
} from "../sidebar/main-tree/MainTreeRowShell";
import {
  MAIN_TREE_INDENT,
  MAIN_TREE_ROW_PADDING_LEFT,
} from "../sidebar/main-tree/mainTreeDragGeometry";
import { useSidebarItemHeight } from "../sidebar/hooks/useSidebarItemHeight";
import type { HeadingItem } from "./useHeadings";
import "./outline.css";

interface OutlinePanelProps {
  headings: HeadingItem[];
  activeId: string | null;
  onHeadingClick: (blockId: string) => void;
  onHeadingToggle: (blockId: string) => void;
}

export function OutlinePanel({
  headings,
  activeId,
  onHeadingClick,
  onHeadingToggle,
}: OutlinePanelProps) {
  const itemHeight = useSidebarItemHeight();
  const [locallyCollapsedIds, setLocallyCollapsedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleLocalOutline = useCallback((blockId: string) => {
    setLocallyCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  if (headings.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-[hsl(var(--goose-shell-bg))]">
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/20 mb-2" />
          <p className="text-xs text-muted-foreground/50">暂无标题</p>
          <p className="text-[11px] text-muted-foreground/30 mt-0.5">使用 # 到 #### 添加</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[hsl(var(--goose-shell-bg))]">
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <nav>
          {headings.map((heading) => (
            <OutlineTreeNode
              key={heading.id}
              heading={heading}
              depth={0}
              activeId={activeId}
              itemHeight={itemHeight}
              locallyCollapsedIds={locallyCollapsedIds}
              onHeadingClick={onHeadingClick}
              onHeadingToggle={onHeadingToggle}
              onToggleLocalOutline={toggleLocalOutline}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function OutlineTreeNode({
  heading,
  depth,
  activeId,
  itemHeight,
  locallyCollapsedIds,
  onHeadingClick,
  onHeadingToggle,
  onToggleLocalOutline,
}: {
  heading: HeadingItem;
  depth: number;
  activeId: string | null;
  itemHeight: number;
  locallyCollapsedIds: Set<string>;
  onHeadingClick: (blockId: string) => void;
  onHeadingToggle: (blockId: string) => void;
  onToggleLocalOutline: (blockId: string) => void;
}) {
  const isActive = activeId === heading.id;
  const [hovered, setHovered] = useState(false);
  // 箭头只控制大纲树。正文折叠状态不参与大纲子项的可见性。
  const canToggleOutline = heading.children.length > 0;
  const isEditorCollapsed = heading.isEditorFoldable && heading.isCollapsed;
  const isOutlineCollapsed = locallyCollapsedIds.has(heading.id);
  const toggleOutline = () => onToggleLocalOutline(heading.id);

  return (
    <div>
      <MainTreeRowShell
        active={isActive || isEditorCollapsed}
        hovered={!isActive && !isEditorCollapsed && hovered}
        className="outline-heading-row text-foreground"
        data-collapsed={isEditorCollapsed ? "true" : undefined}
        style={
          {
            paddingLeft: depth * MAIN_TREE_INDENT + MAIN_TREE_ROW_PADDING_LEFT,
            "--main-tree-row-height": `${itemHeight}px`,
          } as CSSProperties
        }
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          // 右键只走编辑器既有的折叠限制；首标题不能折叠时保持无操作，
          // 绝不回退为收起本地大纲子树。
          onHeadingToggle(heading.id);
        }}
      >
        {canToggleOutline ? (
          <MainTreeRowDisclosure
            expanded={!isOutlineCollapsed}
            label={
              isOutlineCollapsed
                ? "展开子标题"
                : "收起子标题"
            }
            onToggle={toggleOutline}
            revealOnRowHover
          />
        ) : (
          <span
            className="main-tree-row-disclosure ml-1.5 w-5 h-5 shrink-0 pointer-events-none"
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={() => onHeadingClick(heading.id)}
          aria-current={isActive ? "location" : undefined}
          aria-label={
            isEditorCollapsed ? `${heading.text}，已收起` : heading.text
          }
          className={cn(
            "outline-heading relative z-10 min-w-0 flex-1 truncate text-left leading-snug",
          )}
        >
          <span className="block truncate">{heading.text}</span>
        </button>
      </MainTreeRowShell>
      {heading.children.length > 0 && !isOutlineCollapsed ? (
        <div>
          {heading.children.map((child) => (
            <OutlineTreeNode
              key={child.id}
              heading={child}
              depth={depth + 1}
              activeId={activeId}
              itemHeight={itemHeight}
              locallyCollapsedIds={locallyCollapsedIds}
              onHeadingClick={onHeadingClick}
              onHeadingToggle={onHeadingToggle}
              onToggleLocalOutline={onToggleLocalOutline}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
