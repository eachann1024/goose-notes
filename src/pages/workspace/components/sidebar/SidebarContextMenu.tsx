import { SidebarRenameDialog, useRenameDialog } from "./SidebarRenameDialog";
import { getPageTitle } from "@/components/editor/utils/page-title";
import type { ReactNode } from "react";
import type { Page } from "@/types";
import { IconSelector } from "../shared/IconSelector";
import {
  deletePageWithUndo,
  permanentlyDeletePageWithCleanup,
  restorePageWithToast,
} from "@/lib/page-delete-actions";
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts";
import { formatShortcut } from "@/lib/utils";
import { useNotebooks } from "@/stores/useNotebooks";
import { useTabs } from "@/stores/useTabs";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import {
  LOCAL_FOLDER_FILE_SHORTCUTS,
  copyLocalFolderPagePath,
  openLocalFolderPageInExternalApp,
  openLocalFolderPageInTerminal,
  revealLocalFolderPageInFileManager,
} from "@/lib/local-folder-file-actions";
import { formatLocalFolderOpenAppName } from "@/lib/local-folder-open-apps";
import { toast } from "@/components/ui/sonner";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { openPageFromSidebar } from "@/lib/sidebarPageNavigation";
import { isElectronHost } from "@/lib/local-vault";
import { useLocalFolderTargetPicker } from "@/stores/useLocalFolderTargetPicker";
import {
  clearLocalFolderOrder,
  useLocalFolderManualOrder,
} from "@/stores/localFolderOrder";

const _platform = navigator.platform || navigator.userAgent;
const _isMac = /Mac/i.test(_platform);
const _isWin = /Win/i.test(_platform);
function getFinderLabel(isFolder: boolean) {
  const action = isFolder ? "打开" : "显示";
  if (_isMac) return `在访达中${action}`;
  if (_isWin) return `在资源管理器中${action}`;
  return `在文件管理器中${action}`;
}

function MenuShortcut({ shortcut }: { shortcut: string }) {
  return (
    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
      {formatShortcut(shortcut)}
    </span>
  );
}

function getExternalAppLabel(app: string): string {
  if (!app.trim()) return "用系统默认打开";
  return `用 ${formatLocalFolderOpenAppName(app, "外部应用")} 打开`;
}

function getFileManagerLabel(isFolder: boolean, fileManager: string): string {
  if (!fileManager.trim()) return getFinderLabel(isFolder);
  return `用 ${formatLocalFolderOpenAppName(fileManager, "文件管理器")} 打开`;
}

function getTerminalLabel(terminal: string): string {
  if (!terminal.trim()) return "在终端中打开";
  return `在 ${formatLocalFolderOpenAppName(terminal, "终端")} 中打开`;
}

function scheduleAfterMenuClose(action: () => void) {
  window.setTimeout(action, 0);
}

interface SidebarContextMenuProps {
  page: Page;
  children: React.ReactNode;
  /** 该行在侧栏里是不是文件夹行：只有文件夹行能在右键菜单里换图标 */
  isFolderRow?: boolean;
  onCreateLocalFile?: (parentId?: string) => void;
  onCreateLocalFolder?: (parentId?: string) => void;
}

export function SidebarContextMenu({
  page,
  children,
  isFolderRow = false,
  onCreateLocalFile,
  onCreateLocalFolder,
}: SidebarContextMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  // 右键位置：菜单项不是锚点，图标选择器要落在用户右键的地方
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const updatePage = usePages((s) => s.updatePage);
  const iconName = usePages((s) => {
    const live = s.pages[page.id];
    return live ? live.icon : page.icon;
  });
  const duplicatePage = usePages((s) => s.duplicatePage);
  const movePageTreeToNotebook = usePages((s) => s.movePageTreeToNotebook);
  const undoMovePageTree = usePages((s) => s.undoMovePageTree);
  const notebooks = useNotebooks((state) => state.notebooks);
  const notebook = notebooks[page.workspaceId];
  const isLocalFolder = notebook?.source === "local-folder";
  const isTrashed = !!page.trashedAt;
  // 只有进入手动顺序的目录才需要「恢复名称排序」（非目录页面恒为 false）
  const folderHasManualOrder = useLocalFolderManualOrder(
    page.workspaceId,
    page.isFolder ? page.id : undefined,
  );
  const movableNotebooks = Object.values(notebooks).filter(
    (item) => item.id !== page.workspaceId && item.source !== "local-folder",
  );

  const toggleFavorite = () => {
    updatePage(page.id, { isFavorite: !page.isFavorite });
  };

  const togglePinned = () => {
    updatePage(page.id, { isPinned: !page.isPinned });
  };

  const handleMoveToTopLevel = () => {
    updatePage(page.id, { parentId: undefined });
  };

  const handleDuplicatePage = async () => {
    const newId = await duplicatePage(page.id);
    if (!newId || newId === page.id) return;
    openPageFromSidebar(newId, "permanent");
  };

  const handleRestore = () => restorePageWithToast(page.id);

  const handleMoveToNotebook = (targetNotebookId: string) => {
    const result = movePageTreeToNotebook(page.id, targetNotebookId);
    if (!result.ok) {
      if (result.reason === "same-notebook") {
        toast.error("页面已在当前记事本");
      } else if (result.reason === "target-not-supported") {
        toast.error("目标记事本不支持移动");
      } else {
        toast.error("移动失败，请重试");
      }
      return;
    }

    const targetNotebook = notebooks[targetNotebookId];
    const targetName = targetNotebook?.name || "目标记事本";
    toast.success(`已移动到「${targetName}」`, {
      description: `共移动 ${result.movedCount} 个页面`,
      duration: 5000,
      action: {
        label: "撤回",
        onClick: () => {
          const ok = undoMovePageTree(
            result.undoSnapshots,
            result.sourceNotebookId,
            result.prevActivePageId,
          );
          if (!ok) {
            toast.error("撤回失败：源记事本不存在");
          }
        },
      },
    });
  };

  const localFolderFileManager = useSettings((s) => s.localFolderFileManager);
  const localFolderExternalEditor = useSettings(
    (s) => s.localFolderExternalEditor,
  );
  const localFolderTerminal = useSettings((s) => s.localFolderTerminal);
  const singleTabMode = effectiveSingleTabMode(
    useSettings((s) => s.singleTabMode),
  );
  const rename = useRenameDialog();
  const hasParent = !!page.parentId;
  const createParentId = page.isFolder ? page.id : page.parentId;

  return (
    <>
      <ContextMenu onOpenChange={setMenuOpen}>
        <ContextMenuTrigger asChild className="w-full">
          <div
            data-goose-context-trigger="true"
            data-context-open={menuOpen ? "true" : undefined}
            className="h-full w-full"
            onContextMenu={(event) => {
              setMenuPoint({ x: event.clientX, y: event.clientY });
            }}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent
          className="goose-sidebar-context-menu w-60"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {(() => {
            const showCreate =
              isLocalFolder &&
              !isTrashed &&
              !!page.localFilePath &&
              (!!onCreateLocalFile || !!onCreateLocalFolder);
            const showOpenTab =
              !singleTabMode &&
              !(isElectronHost && isLocalFolder && page.isFolder);
            const showLocalOpen =
              isLocalFolder && !isTrashed && !!page.localFilePath;
            const showOpen = showOpenTab || showLocalOpen;
            const showOrganize = !isTrashed && !page.isFolder;
            const showMoveTop = hasParent && !isTrashed && !isLocalFolder;
            const showMoveNotebook =
              !isTrashed && !isLocalFolder && movableNotebooks.length > 0;
            const showMoveLocal =
              isLocalFolder && !isTrashed && !!page.localFilePath;
            const showMove = showMoveTop || showMoveNotebook || showMoveLocal;
            const showRestoreOrder =
              isLocalFolder &&
              !isTrashed &&
              !!page.isFolder &&
              folderHasManualOrder;
            const showCopy = showLocalOpen;
            // 换图标限定文件夹：文件不再展示图标，也不给自定义入口
            const showIconSetting =
              isFolderRow && !isTrashed && !page.localPendingCreate;
            const openIconPicker = () =>
              scheduleAfterMenuClose(() => setIconPickerOpen(true));

            const sections: ReactNode[] = [];

            if (!isTrashed && !page.localPendingCreate && !page.localUnsaved) {
              sections.push(
                <ContextMenuGroup key="rename">
                  <ContextMenuItem onSelect={() => scheduleAfterMenuClose(() =>
                    rename.openRenameDialog(page.id, page.isFolder && page.localFilePath
                      ? page.localFilePath.split(/[\\/]/).pop() || ""
                      : getPageTitle(page)),
                  )}>
                    <LucideIcons.Pencil className="h-4 w-4" />
                    <span>重命名</span>
                  </ContextMenuItem>
                </ContextMenuGroup>,
              );
            }

            if (showCreate) {
              sections.push(
                <ContextMenuGroup key="create">
                  <ContextMenuLabel>新建</ContextMenuLabel>
                  {onCreateLocalFile ? (
                    <ContextMenuItem
                      onSelect={() =>
                        scheduleAfterMenuClose(() =>
                          onCreateLocalFile(createParentId),
                        )
                      }
                    >
                      <LucideIcons.FilePlus2 className="h-4 w-4" />
                      <span className="min-w-0 truncate">新建文件</span>
                      <MenuShortcut shortcut={getFixedAppShortcuts().newNote} />
                    </ContextMenuItem>
                  ) : null}
                  {onCreateLocalFolder ? (
                    <ContextMenuItem
                      onSelect={() =>
                        scheduleAfterMenuClose(() =>
                          onCreateLocalFolder(createParentId),
                        )
                      }
                    >
                      <LucideIcons.FolderPlus className="h-4 w-4" />
                      <span>新建文件夹</span>
                    </ContextMenuItem>
                  ) : null}
                </ContextMenuGroup>,
              );
            }

            if (showRestoreOrder) {
              sections.push(
                <ContextMenuGroup key="sort">
                  <ContextMenuItem
                    onSelect={() =>
                      scheduleAfterMenuClose(() => {
                        if (
                          clearLocalFolderOrder(page.workspaceId, page.id)
                        ) {
                          toast.success("已恢复名称排序");
                        }
                      })
                    }
                  >
                    <LucideIcons.ArrowDownAZ className="h-4 w-4" />
                    <span className="min-w-0 truncate">恢复名称排序</span>
                  </ContextMenuItem>
                </ContextMenuGroup>,
              );
            }

            if (showOpen) {
              sections.push(
                <ContextMenuGroup key="open" className="mt-2">
                  <ContextMenuLabel>打开</ContextMenuLabel>
                  {showOpenTab ? (
                    <ContextMenuItem
                      onSelect={() => {
                        if (isTrashed) return;
                        closeNotebookAiIfFullscreen();
                        useTabs.getState().openTab(page.id);
                      }}
                      disabled={isTrashed}
                    >
                      <LucideIcons.PanelTopOpen className="h-4 w-4" />
                      <span className="min-w-0 truncate">在新标签页打开</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatShortcut("Mod")}+点击
                      </span>
                    </ContextMenuItem>
                  ) : null}
                  {showLocalOpen ? (
                    <ContextMenuItem
                      onSelect={() =>
                        void openLocalFolderPageInExternalApp(page)
                      }
                    >
                      <LucideIcons.SquareArrowOutUpRight className="h-4 w-4" />
                      <span className="min-w-0 truncate">
                        {getExternalAppLabel(localFolderExternalEditor)}
                      </span>
                      <MenuShortcut
                        shortcut={LOCAL_FOLDER_FILE_SHORTCUTS.openInExternalApp}
                      />
                    </ContextMenuItem>
                  ) : null}
                  {showLocalOpen ? (
                    <ContextMenuItem
                      onSelect={() =>
                        void revealLocalFolderPageInFileManager(page)
                      }
                    >
                      <LucideIcons.FolderOpen className="h-4 w-4" />
                      <span className="min-w-0 truncate">
                        {getFileManagerLabel(
                          !!page.isFolder,
                          localFolderFileManager,
                        )}
                      </span>
                      <MenuShortcut
                        shortcut={
                          LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager
                        }
                      />
                    </ContextMenuItem>
                  ) : null}
                  {showLocalOpen ? (
                    <ContextMenuItem
                      onSelect={() => void openLocalFolderPageInTerminal(page)}
                    >
                      <LucideIcons.Terminal className="h-4 w-4" />
                      <span className="min-w-0 truncate">
                        {getTerminalLabel(localFolderTerminal)}
                      </span>
                      <MenuShortcut
                        shortcut={LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal}
                      />
                    </ContextMenuItem>
                  ) : null}
                </ContextMenuGroup>,
              );
            }

            if (showIconSetting && !showOrganize) {
              sections.push(
                <ContextMenuGroup key="icon" className="mt-2">
                  <ContextMenuItem onSelect={openIconPicker}>
                    <LucideIcons.SmilePlus className="h-4 w-4" />
                    <span>设置图标</span>
                  </ContextMenuItem>
                </ContextMenuGroup>,
              );
            }

            if (showOrganize) {
              sections.push(
                <ContextMenuGroup key="organize" className="mt-2">
                  <ContextMenuLabel>整理</ContextMenuLabel>
                  {showIconSetting ? (
                    <ContextMenuItem onSelect={openIconPicker}>
                      <LucideIcons.SmilePlus className="h-4 w-4" />
                      <span>设置图标</span>
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem onSelect={toggleFavorite}>
                    <LucideIcons.Star
                      className={cn(
                        "h-4 w-4",
                        page.isFavorite &&
                          "fill-[var(--goose-interactive-selected-fg)] text-[var(--goose-interactive-selected-fg)]",
                      )}
                    />
                    <span>{page.isFavorite ? "从最爱移除" : "添加到最爱"}</span>
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={togglePinned}>
                    <LucideIcons.Pin
                      className={cn(
                        "h-4 w-4",
                        page.isPinned &&
                          "fill-[var(--goose-color-danger)] text-[var(--goose-color-danger)]",
                      )}
                    />
                    <span>{page.isPinned ? "取消置顶" : "置顶页面"}</span>
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={handleDuplicatePage}>
                    <LucideIcons.Copy className="h-4 w-4" />
                    <span>创建副本</span>
                  </ContextMenuItem>
                </ContextMenuGroup>,
              );
            }

            if (showMove) {
              sections.push(
                <ContextMenuGroup
                  key="move"
                  className={showOrganize ? undefined : "mt-2"}
                >
                  {showMoveTop ? (
                    <ContextMenuItem onSelect={handleMoveToTopLevel}>
                      <LucideIcons.ArrowUpToLine className="h-4 w-4" />
                      <span>移至顶层</span>
                    </ContextMenuItem>
                  ) : null}
                  {showMoveNotebook ? (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <LucideIcons.FolderOutput className="h-4 w-4" />
                        <span>移动到笔记本</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuPortal>
                        <ContextMenuSubContent
                          sideOffset={8}
                          alignOffset={-4}
                          collisionPadding={12}
                          className="w-56 max-h-[min(18rem,calc(100dvh-16px))]"
                        >
                          {movableNotebooks.map((item) => (
                            <ContextMenuItem
                              key={item.id}
                              onSelect={() => handleMoveToNotebook(item.id)}
                            >
                              <span className="truncate">{item.name}</span>
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuPortal>
                    </ContextMenuSub>
                  ) : null}
                  {showMoveLocal ? (
                    <ContextMenuItem
                      onSelect={() =>
                        scheduleAfterMenuClose(() =>
                          useLocalFolderTargetPicker
                            .getState()
                            .openMovePicker(page.workspaceId, page.id),
                        )
                      }
                    >
                      <LucideIcons.FolderInput className="h-4 w-4" />
                      <span className="min-w-0 truncate">移动到…</span>
                      <MenuShortcut
                        shortcut={LOCAL_FOLDER_FILE_SHORTCUTS.moveItem}
                      />
                    </ContextMenuItem>
                  ) : null}
                </ContextMenuGroup>,
              );
            }

            if (showCopy) {
              sections.push(
                <ContextMenuGroup key="clipboard">
                  <ContextMenuItem
                    onSelect={() => void copyLocalFolderPagePath(page)}
                  >
                    <LucideIcons.ClipboardCopy className="h-4 w-4" />
                    <span className="min-w-0 truncate">
                      {page.isFolder ? "复制文件夹路径" : "复制文件路径"}
                    </span>
                    <MenuShortcut
                      shortcut={LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath}
                    />
                  </ContextMenuItem>
                </ContextMenuGroup>,
              );
            }

            sections.push(
              <ContextMenuGroup key="danger">
                {isTrashed ? (
                  <>
                    <ContextMenuItem onSelect={handleRestore}>
                      <LucideIcons.RotateCcw className="h-4 w-4" />
                      <span>
                        {isLocalFolder
                          ? page.isFolder
                            ? "恢复文件夹"
                            : "恢复文件"
                          : "恢复页面"}
                      </span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onSelect={() =>
                        void permanentlyDeletePageWithCleanup(page.id)
                      }
                      className="text-foreground/85 dark:text-foreground/85 focus:text-[var(--goose-color-danger-focus)] focus:bg-[var(--goose-color-danger-subtle-bg)]"
                    >
                      <LucideIcons.Trash2 className="h-4 w-4" />
                      <span>永久删除</span>
                    </ContextMenuItem>
                  </>
                ) : (
                  <ContextMenuItem
                    onSelect={() => void deletePageWithUndo(page.id)}
                    className="text-foreground/85 dark:text-foreground/85 focus:text-[var(--goose-color-danger-focus)] focus:bg-[var(--goose-color-danger-subtle-bg)]"
                  >
                    {isLocalFolder ? (
                      <LucideIcons.FileX className="h-4 w-4" />
                    ) : (
                      <LucideIcons.Trash2 className="h-4 w-4" />
                    )}
                    <span className="min-w-0 truncate">
                      {isLocalFolder ? "移到系统回收站" : "删除"}
                    </span>
                    <MenuShortcut shortcut="Mod+Backspace" />
                  </ContextMenuItem>
                )}
              </ContextMenuGroup>,
            );

            // 保留「新建 / 打开 / 整理」的语义标题；常规组用留白区分，避免
            // 本地目录里的每个动作组都再切一条线。危险操作仍单独成组。
            return sections.flatMap((section, index) =>
              index === sections.length - 1 && index > 0
                ? [<ContextMenuSeparator key="sep-danger" />, section]
                : [section],
            );
          })()}
        </ContextMenuContent>
      </ContextMenu>
      <SidebarRenameDialog
        open={rename.renameDialogOpen}
        onOpenChange={rename.setRenameDialogOpen}
        renamePageId={rename.renamePageId}
        renameValue={rename.renameValue}
        onRenameValueChange={rename.setRenameValue}
        isLocalFolder={isLocalFolder}
        isDirectory={!!page.isFolder}
        busy={rename.busy}
        onConfirm={() => void rename.confirmRename()}
      />
      <IconSelector
        value={iconName}
        onChange={(nextIcon) => updatePage(page.id, { icon: nextIcon })}
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        anchorPoint={menuPoint ?? undefined}
      />
    </>
  );
}
