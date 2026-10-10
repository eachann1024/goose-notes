import { TreeBranch } from "../TreeBranch";
import { type HTMLProps } from "react";
import { SidebarContextMenu } from "../../SidebarContextMenu";
import { SidebarInlineRename } from "../../SidebarInlineRename";
import {
  isSidebarFolderRow,
  shouldShowEmptyFolderPlaceholder,
} from "../../local-file-icon";
import { useNotebooks } from "@/stores/useNotebooks";
import { toggleSidebarFolder } from "@/stores/useSidebarView";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { isElectronHost } from "@/lib/local-vault";
import {
  INDENT,
  ROW_PADDING_LEFT,
  CHILD_TITLE_OFFSET,
  type RenderItemArgs,
} from "./mainTreeRowConfig";
import { TreeRowIcon, MainTreeRow } from "./MainTreeRow";
import { PendingCreateNameInput } from "./PendingCreateNameInput";

export let activeMainTreeDragId: string | null = null;

export function renderItem({
  item,
  depth,
  children,
  arrow,
  context,
  onCreateLocalFile,
  onCreateLocalFolder,
  onCommitPendingCreate,
  onCancelPendingCreate,
  onItemDragStart,
  onItemDragEnd,
  onActivateLocalDirectory,
}: RenderItemArgs) {
  const page = item.data;
  if (item.index === "root") {
    return <>{children}</>;
  }
  const isActive = !!context.isSelected;
  const isOver = !!context.isDraggingOver;
  const interactive =
    context.interactiveElementProps as HTMLProps<HTMLDivElement>;
  const withChildren =
    context.itemContainerWithChildrenProps as HTMLProps<HTMLLIElement>;
  const withoutChildren =
    context.itemContainerWithoutChildrenProps as HTMLProps<HTMLDivElement>;

  const title = getPageTitle(page);
  const notebook = page?.workspaceId
    ? useNotebooks.getState().notebooks[page.workspaceId]
    : undefined;
  const isLocalFolder = notebook?.source === "local-folder";
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const isPendingCreate =
    page.localPendingCreate === "folder" || page.localPendingCreate === "file";
  const isLocalDirectory = isLocalFolder && !!page.isFolder;
  const isDragging = activeMainTreeDragId === String(item.index);
  const isFolderRow = isSidebarFolderRow({
    isFolder: !!page.isFolder,
    hasChildren,
    isLocalNotebook: isLocalFolder,
  });
  // 空文件夹占位只在扫完之后才显示：读取中/失败时不能冒充空目录。
  const showEmptyFolderPlaceholder = shouldShowEmptyFolderPlaceholder({
    isFolderRow,
    isExpanded: !!context.isExpanded,
    hasChildren,
    isLocalNotebook: isLocalFolder,
    localLoadStatus: isLocalFolder
      ? useNotebooks.getState().localFolderLoadStates[page.workspaceId]?.status
      : undefined,
  });
  const iconNode = (
    <TreeRowIcon
      page={page}
      isLocalFolder={isLocalFolder}
      isRenaming={!!context.isRenaming}
      hasChildren={hasChildren}
      isExpanded={!!context.isExpanded}
      onToggleExpanded={() =>
        toggleSidebarFolder(page.workspaceId, String(item.index))
      }
    />
  );

  // 默认拖拽快照是整行 DOM（带选中背景的大块），跟随鼠标时会盖住目标行的
  // 拖入高亮，让人误以为不能拖成子页面。换成紧凑的"图标+标题"小胶囊，
  // 并弱化源行，让落点反馈始终可见。
  const handleDragStart: React.DragEventHandler<HTMLDivElement> = (e) => {
    (
      interactive.onDragStart as
        | React.DragEventHandler<HTMLDivElement>
        | undefined
    )?.(e);
    if (!e.dataTransfer) return;
    if (page.localFilePath && !isPendingCreate && !page.localUnsaved) {
      e.dataTransfer.setData("text/plain", page.localFilePath);
      // 外部软件复制路径文本；应用内仍允许移动节点。
      e.dataTransfer.effectAllowed = "copyMove";
    }
    activeMainTreeDragId = String(item.index);
    onItemDragStart?.(String(item.index));

    const ghost = document.createElement("div");
    ghost.className = "main-tree-drag-ghost";
    const rowEl = (e.currentTarget as HTMLElement)
      .closest("li")
      ?.querySelector(".main-tree-row");
    // 跳过折叠箭头，取页面图标本体
    const iconSvg = rowEl?.querySelector(".main-tree-row-icon-slot svg");
    if (iconSvg) ghost.appendChild(iconSvg.cloneNode(true));
    const label = document.createElement("span");
    label.textContent = title || "无标题";
    ghost.appendChild(label);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 18, 17);
    window.setTimeout(() => ghost.remove(), 0);

    if (rowEl instanceof HTMLElement) {
      rowEl.classList.add("main-tree-row--dragging", "main-tree-row--selected");
    }
    e.currentTarget.addEventListener(
      "dragend",
      () => {
        activeMainTreeDragId = null;
        onItemDragEnd?.();
        if (rowEl instanceof HTMLElement) {
          rowEl.classList.remove("main-tree-row--dragging");
        }
      },
      { once: true },
    );
  };

  const toggleLocalDirectory = () => {
    toggleSidebarFolder(page.workspaceId, String(item.index));
  };

  const handleRowPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    (
      interactive.onPointerDown as
        | React.PointerEventHandler<HTMLDivElement>
        | undefined
    )?.(e);
    if (!isLocalDirectory) return;
    if (e.button !== 0 || e.ctrlKey) return;
    if (e.detail <= 1) toggleLocalDirectory();
  };

  const handleRowClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (isLocalDirectory) {
      e.preventDefault();
      e.stopPropagation();
      // Electron：点击文件夹只展开/收起，不打开目录详情页。
      if (!isElectronHost) {
        const pageId = String(item.index);
        if (pageId && pageId !== "root") {
          onActivateLocalDirectory?.(
            pageId,
            e.metaKey || e.ctrlKey ? "permanent" : "preview",
          );
        }
      }
      // 指针已在 pointerdown 翻转；键盘（detail=0）在 click 补一次。
      if (e.detail === 0) toggleLocalDirectory();
      return;
    }
    (
      interactive.onClick as React.MouseEventHandler<HTMLDivElement> | undefined
    )?.(e);
    // 已选中再点时 tree 可能不触发 onSelectItems；全屏 AI 下仍需回到该页标签
    const pageId = String(item.index);
    if (pageId && pageId !== "root") {
      const permanent = e.metaKey || e.ctrlKey;
      openPageFromSidebar(pageId, permanent ? "permanent" : "preview", {
        newTab: permanent,
      });
    }
  };

  const row = (
    <MainTreeRow
      withoutChildren={withoutChildren}
      isLocalFolder={isLocalFolder}
      isPendingCreate={isPendingCreate}
      isActive={isActive}
      isOver={isOver}
      isDragging={isDragging}
      depth={depth}
      itemIndex={String(item.index)}
    >
      {/* 整行作为 hit area：interactive div 绝对覆盖整个 row。
          arrow / icon 各自的实际可点击子节点已有自己的 pointer-events 与 stopPropagation，
          标题文字给 pointer-events-none 透传给底层 interactive；占位 arrow 已 pointer-events-none。 */}
      <div
        {...interactive}
        data-main-tree-folder={item.isFolder ? "true" : "false"}
        onClick={handleRowClick}
        onPointerDown={handleRowPointerDown}
        onDragStart={handleDragStart}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isLocalDirectory) {
            if (isElectronHost) return;
            // Electron：双击文件夹晋升永久标签（目录主页）
            onActivateLocalDirectory?.(String(item.index), "permanent");
            return;
          }
          openPageFromSidebar(String(item.index), "permanent");
        }}
        aria-label={title}
        className={cn(
          "absolute inset-0 rounded-lg outline-none",
          isPendingCreate && "pointer-events-none",
        )}
      />
      {iconNode}
      {/* leading-snug 抵消行容器的 leading-none：truncate(overflow hidden) 配 1 倍行高
          会把 g/y/p 等字母的降部裁掉 */}
      {isPendingCreate ? (
        <PendingCreateNameInput
          id={String(item.index)}
          kind={page.localPendingCreate === "file" ? "file" : "folder"}
          onCommit={onCommitPendingCreate}
          onCancel={onCancelPendingCreate}
        />
      ) : (
        <SidebarInlineRename>
          <span className="relative z-10 truncate flex-1 min-w-0 pointer-events-none leading-snug">
            {title}
          </span>
        </SidebarInlineRename>
      )}
    </MainTreeRow>
  );

  return (
    <li {...withChildren} className="list-none">
      <SidebarContextMenu
        page={page}
        isFolderRow={isFolderRow}
        onCreateLocalFile={onCreateLocalFile}
        onCreateLocalFolder={onCreateLocalFolder}
      >
        {row}
      </SidebarContextMenu>
      <TreeBranch
        expanded={!!context.isExpanded}
        onReturnFocus={() => context.focusItem(true)}
      >
        {children}
        {showEmptyFolderPlaceholder ? (
          <div
            className="flex items-center text-[13px] text-muted-foreground"
            style={{
              paddingLeft:
                (depth + 1) * INDENT + ROW_PADDING_LEFT + CHILD_TITLE_OFFSET,
              minHeight: "var(--main-tree-row-height)",
            }}
          >
            暂无文件
          </div>
        ) : null}
      </TreeBranch>
    </li>
  );
}
