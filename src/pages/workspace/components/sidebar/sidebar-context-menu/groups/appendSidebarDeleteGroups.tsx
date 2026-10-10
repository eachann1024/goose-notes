import * as GooseIcons from "@/components/ui/icons";
import {
  deletePageWithUndo,
  permanentlyDeletePageWithCleanup,
} from "@/lib/page-delete-actions";
import {
  LOCAL_FOLDER_FILE_SHORTCUTS,
  copyLocalFolderPagePath,
} from "@/lib/local-folder-file-actions";
import { MenuShortcut } from "../shared";
import type { appendSidebarOpenMoveGroups } from "./appendSidebarOpenMoveGroups";

export function appendSidebarDeleteGroups(
  input: ReturnType<typeof appendSidebarOpenMoveGroups>,
) {
  const { page, isLocalFolder, isTrashed, handleRestore, showCopy, sections } =
    input;

  if (showCopy) {
    sections.push(
      <ContextMenuGroup key="clipboard">
        <ContextMenuItem onSelect={() => void copyLocalFolderPagePath(page)}>
          <GooseIcons.ClipboardCopy className="h-4 w-4" />
          <span className="min-w-0 truncate">
            {page.isFolder ? "复制文件夹路径" : "复制文件路径"}
          </span>
          <MenuShortcut shortcut={LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath} />
        </ContextMenuItem>
      </ContextMenuGroup>,
    );
  }

  sections.push(
    <ContextMenuGroup key="danger">
      {isTrashed ? (
        <>
          <ContextMenuItem onSelect={handleRestore}>
            <GooseIcons.RotateCcw className="h-4 w-4" />
            <span>
              {isLocalFolder
                ? page.isFolder
                  ? "恢复文件夹"
                  : "恢复文件"
                : "恢复笔记"}
            </span>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => void permanentlyDeletePageWithCleanup(page.id)}
            className="text-foreground dark:text-foreground focus:text-[var(--goose-color-danger-focus)] focus:bg-[var(--goose-color-danger-subtle-bg)]"
          >
            <GooseIcons.Trash2 className="h-4 w-4" />
            <span>彻底删除</span>
          </ContextMenuItem>
        </>
      ) : (
        <ContextMenuItem
          onSelect={() => void deletePageWithUndo(page.id)}
          className="text-foreground dark:text-foreground focus:text-[var(--goose-color-danger-focus)] focus:bg-[var(--goose-color-danger-subtle-bg)]"
        >
          {isLocalFolder ? (
            <GooseIcons.FileX className="h-4 w-4" />
          ) : (
            <GooseIcons.Trash2 className="h-4 w-4" />
          )}
          <span className="min-w-0 truncate">
            {isLocalFolder ? "移到废纸篓" : "移入回收站"}
          </span>
          <MenuShortcut shortcut="Mod+Backspace" />
        </ContextMenuItem>
      )}
    </ContextMenuGroup>,
  );
  return { ...input };
}
