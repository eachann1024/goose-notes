import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { useSettings } from "@/stores/useSettings";
import type { ClipperMode } from "@/stores/useSettings";

interface ClipTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: ClipperMode;
  onConfirm?: (config: { notebookId: string; pageId: string; mode: ClipperMode }) => void;
}

/**
 * 剪藏目标选择对话框（v1 脚手架，仅 ask 模式预留入口）。
 * 当前不暴露给用户：handleClip v1 默认 append + 静默 toast，不弹此对话框。
 * 留作 v2 扩展：当 settings.clipper.mode === "ask" 时由调用方持有 open 状态触发。
 */
export function ClipTargetDialog({
  open,
  onOpenChange,
  defaultMode = "append",
  onConfirm,
}: ClipTargetDialogProps) {
  const notebooks = useNotebooks((state) => state.notebooks);
  const pagesMap = usePages((state) => state.pages);
  const clipperSettings = useSettings((state) => state.clipper);
  const setClipperInbox = useSettings((state) => state.setClipperInbox);
  const setClipperMode = useSettings((state) => state.setClipperMode);

  const [selectedNotebookId, setSelectedNotebookId] = useState<string>(
    clipperSettings.inboxNotebookId ?? "",
  );
  const [selectedPageId, setSelectedPageId] = useState<string>(
    clipperSettings.inboxPageId ?? "",
  );
  const [mode, setMode] = useState<ClipperMode>(defaultMode);

  const writableNotebooks = useMemo(
    () =>
      Object.values(notebooks)
        .filter((n) => n.source !== "local-folder")
        .sort((a, b) => a.createdAt - b.createdAt),
    [notebooks],
  );

  const candidatePages = useMemo(
    () =>
      Object.values(pagesMap)
        .filter(
          (page) =>
            page.workspaceId === selectedNotebookId && !page.trashedAt && !page.isFolder,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [pagesMap, selectedNotebookId],
  );

  const handleConfirm = () => {
    if (!selectedNotebookId || !selectedPageId) return;
    setClipperInbox(selectedNotebookId, selectedPageId);
    setClipperMode(mode);
    onConfirm?.({ notebookId: selectedNotebookId, pageId: selectedPageId, mode });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>选择剪藏目标</DialogTitle>
          <DialogDescription>
            为剪藏内容选择默认的记事本与页面，后续可在设置中修改。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">记事本</span>
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={selectedNotebookId}
              onChange={(event) => {
                setSelectedNotebookId(event.target.value);
                setSelectedPageId("");
              }}
            >
              <option value="">请选择记事本</option>
              {writableNotebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">页面（收件箱）</span>
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={selectedPageId}
              onChange={(event) => setSelectedPageId(event.target.value)}
              disabled={!selectedNotebookId}
            >
              <option value="">请选择页面</option>
              {candidatePages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.content?.[0]?.content?.[0]?.text || "未命名"}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">写入方式</span>
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              value={mode}
              onChange={(event) => setMode(event.target.value as ClipperMode)}
            >
              <option value="append">追加到收件箱</option>
              <option value="newPage">每次新建页面</option>
              <option value="ask">每次询问</option>
            </select>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedNotebookId || !selectedPageId}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
