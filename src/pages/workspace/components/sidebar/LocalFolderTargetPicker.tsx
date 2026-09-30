import { useEffect, useMemo, useRef, useState } from "react";
import * as GooseIcons from "@/components/ui/icons";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/components/ui/sonner";
import { closeNotebookAiIfFullscreen } from "@/pages/workspace/components/notebook-ai/useNotebookAiPanel";
import { activateNotebook } from "@/lib/notebookNavigation";
import {
  buildLocalFolderPickerItems,
  rememberLocalFolderTarget,
  readRecentLocalFolderTargets,
} from "@/lib/local-folder-target";
import { importTextFilesToLocalFolder } from "@/lib/local-folder-import";
import { useLocalFolderTargetPicker } from "@/stores/useLocalFolderTargetPicker";
import { usePages } from "@/stores/usePages";
import { useSidebarView } from "@/stores/useSidebarView";
import { useTabs } from "@/stores/useTabs";

export function LocalFolderTargetPicker() {
  const {
    open,
    mode,
    workspaceId,
    pageId,
    importFiles,
    closePicker,
  } = useLocalFolderTargetPicker();
  const pages = usePages((s) => s.pages);
  const moveLocalPage = usePages((s) => s.moveLocalPage);
  const setExpandPageId = usePages((s) => s.setExpandPageId);
  const expandView = useSidebarView((s) => s.expand);
  const setSelectedView = useSidebarView((s) => s.setSelected);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const recentKeys = useMemo(
    () => (workspaceId ? readRecentLocalFolderTargets(workspaceId) : []),
    [workspaceId, open],
  );

  const items = useMemo(
    () =>
      workspaceId
        ? buildLocalFolderPickerItems(pages, workspaceId, {
            query,
            excludePageId: mode === "move" ? pageId : undefined,
            recentKeys,
          })
        : [],
    [pages, workspaceId, query, mode, pageId, recentKeys],
  );

  const handleSelect = async (folderId: string | undefined) => {
    if (!workspaceId) return;

    if (mode === "move") {
      if (!pageId) return;
      try {
        await moveLocalPage(pageId, folderId);
        rememberLocalFolderTarget(workspaceId, folderId);
        toast.success("已移动");
        closePicker();
        if (folderId) {
          expandView(workspaceId, folderId);
          setExpandPageId(folderId);
        }
        setSelectedView(workspaceId, pageId);
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-rct-item-id="${pageId}"]`)
            ?.scrollIntoView({ block: "nearest" });
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "移动失败，请重试",
        );
      }
      return;
    }

    const { importedIds, failedCount } = await importTextFilesToLocalFolder({
      workspaceId,
      files: importFiles,
      parentId: folderId,
    });
    rememberLocalFolderTarget(workspaceId, folderId);
    closePicker();

    const firstPageId = importedIds[0];
    if (!firstPageId) {
      toast.error("导入失败", {
        description: "文件内容无法解析为笔记。",
      });
      return;
    }

    closeNotebookAiIfFullscreen();
    await activateNotebook(workspaceId);
    useTabs.getState().openTab(firstPageId);
    await usePages.getState().setActivePage(firstPageId);
    if (folderId) {
      expandView(workspaceId, folderId);
      setExpandPageId(folderId);
    }

    const successCount = importedIds.length;
    toast.success(
      successCount === 1 ? "文本文件已导入" : `已导入 ${successCount} 个文件`,
      {
        description:
          failedCount > 0 ? `${failedCount} 个文件导入失败，已跳过` : undefined,
      },
    );
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => !next && closePicker()}
      commandProps={{ value: query, onValueChange: setQuery }}
    >
      <CommandInput ref={inputRef} placeholder="搜索文件夹或路径…" />
      <CommandList>
        <CommandEmpty>没有匹配的文件夹</CommandEmpty>
        <CommandGroup heading={mode === "move" ? "移动到" : "导入到"}>
          {items.map((item) => (
            <CommandItem
              key={item.key}
              value={`${item.label} ${item.pathLabel}`}
              onSelect={() => void handleSelect(item.folderId)}
            >
              <GooseIcons.Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{item.label}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.pathLabel}
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
