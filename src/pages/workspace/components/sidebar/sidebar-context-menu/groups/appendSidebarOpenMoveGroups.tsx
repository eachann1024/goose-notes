import * as GooseIcons from "@/components/ui/icons";
import { formatShortcut } from "@/lib/utils";
import { useTabs } from "@/stores/useTabs";
import {
  LOCAL_FOLDER_FILE_SHORTCUTS,
  openLocalFolderPageInExternalApp,
  openLocalFolderPageInTerminal,
  revealLocalFolderPageInFileManager,
} from "@/lib/local-folder-file-actions";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { useLocalFolderTargetPicker } from "@/stores/useLocalFolderTargetPicker";
import {
  MenuShortcut,
  getExternalAppLabel,
  getFileManagerLabel,
  getTerminalLabel,
  scheduleAfterMenuClose,
} from "../shared";
import type { buildSidebarCreateGroups } from "./buildSidebarCreateGroups";

export function appendSidebarOpenMoveGroups(
  input: ReturnType<typeof buildSidebarCreateGroups>,
) {
  const {
    page,
    isTrashed,
    movableNotebooks,
    handleMoveToTopLevel,
    handleDuplicatePage,
    handleMoveToNotebook,
    localFolderFileManager,
    localFolderExternalEditor,
    localFolderTerminal,
    showOpenTab,
    showLocalOpen,
    showOpen,
    showOrganize,
    showMoveTop,
    showMoveNotebook,
    showMoveLocal,
    showMove,
    sections,
  } = input;

  if (showOpen) {
    sections.push(
      <ContextMenuGroup key="open" className="mt-2">
        <ContextMenuLabel>打开</ContextMenuLabel>
        {showOpenTab ? (
          <ContextMenuItem
            onSelect={() => {
              if (isTrashed) return;
              closeNotebookAiIfFullscreen();
              useTabs.getState().openPermanentTab(page.id);
            }}
            disabled={isTrashed}
          >
            <GooseIcons.PanelTopOpen className="h-4 w-4" />
            <span className="min-w-0 truncate">在新标签页打开</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatShortcut("Mod")}+点击
            </span>
          </ContextMenuItem>
        ) : null}
        {showLocalOpen ? (
          <ContextMenuItem
            onSelect={() => void openLocalFolderPageInExternalApp(page)}
          >
            <GooseIcons.SquareArrowOutUpRight className="h-4 w-4" />
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
            onSelect={() => void revealLocalFolderPageInFileManager(page)}
          >
            <GooseIcons.FolderOpen className="h-4 w-4" />
            <span className="min-w-0 truncate">
              {getFileManagerLabel(!!page.isFolder, localFolderFileManager)}
            </span>
            <MenuShortcut
              shortcut={LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager}
            />
          </ContextMenuItem>
        ) : null}
        {showLocalOpen ? (
          <ContextMenuItem
            onSelect={() => void openLocalFolderPageInTerminal(page)}
          >
            <GooseIcons.Terminal className="h-4 w-4" />
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

  if (showOrganize) {
    sections.push(
      <ContextMenuGroup key="organize" className="mt-2">
        <ContextMenuLabel>整理</ContextMenuLabel>
        <ContextMenuItem onSelect={handleDuplicatePage}>
          <GooseIcons.Copy className="h-4 w-4" />
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
            <GooseIcons.ArrowUpToLine className="h-4 w-4" />
            <span>移至顶层</span>
          </ContextMenuItem>
        ) : null}
        {showMoveNotebook ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <GooseIcons.FolderOutput className="h-4 w-4" />
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
            <GooseIcons.FolderInput className="h-4 w-4" />
            <span className="min-w-0 truncate">移动到…</span>
            <MenuShortcut shortcut={LOCAL_FOLDER_FILE_SHORTCUTS.moveItem} />
          </ContextMenuItem>
        ) : null}
      </ContextMenuGroup>,
    );
  }
  return { ...input };
}
