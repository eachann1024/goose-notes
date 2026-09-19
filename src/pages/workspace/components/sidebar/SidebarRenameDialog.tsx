import { withInternalPageTitle } from "@/components/editor/utils/page-title";
import { toast } from "@/components/ui/sonner";
import { DialogShell } from "@/components/ui/dialog-shell";

interface SidebarRenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renamePageId: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  isLocalFolder: boolean;
  onConfirm: () => void;
  isDirectory?: boolean;
  busy?: boolean;
}

export function SidebarRenameDialog({
  open,
  onOpenChange,
  renamePageId,
  renameValue,
  onRenameValueChange,
  isLocalFolder,
  onConfirm,
  isDirectory = false,
  busy = false,
}: SidebarRenameDialogProps) {
  const kind = isLocalFolder ? (isDirectory ? "文件夹" : "文件") : "页面";
  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => { if (!busy) onOpenChange(next); }}
      title={`重命名${kind}`}
      description={`输入新的${kind}名称`}
      footer={
        <>
          <Button disabled={busy} variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy || !renamePageId || renameValue.trim() === ""}
          >
            确认
          </Button>
        </>
      }
    >
      <div className="px-6 py-4">
        <div className="grid gap-2">
          <Label htmlFor="rename-input">新名称</Label>
          <Input
            id="rename-input"
            disabled={busy}
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || busy) return;
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm();
              } else if (e.key === "Escape") {
                onOpenChange(false);
              }
            }}
            autoFocus
            placeholder={
              `输入新的${kind}名称`
            }
          />
        </div>
      </div>
    </DialogShell>
  );
}

export function useRenameDialog() {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renamePageId, setRenamePageId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const committing = useRef(false);

  const openRenameDialog = (pageId: string, currentTitle: string) => {
    setRenamePageId(pageId);
    setRenameValue(currentTitle);
    setRenameDialogOpen(true);
  };

  const closeRenameDialog = useCallback(() => {
    setRenameDialogOpen(false);
    setRenamePageId(null);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renamePageId || committing.current) return;
    const page = usePages.getState().pages[renamePageId];
    const nextTitle = renameValue.trim();
    if (!page || !nextTitle) return;
    if (/[\\/:*?"<>|\x00-\x1f\x7f]/.test(nextTitle) || /^\.+$/.test(nextTitle)) {
      toast.error("名称不能包含路径分隔符或非法字符");
      return;
    }
    committing.current = true;
    setBusy(true);
    try {
      if (page.localFilePath) {
        await usePages.getState().renameLocalPageFile(page.id, nextTitle);
      } else {
        usePages.getState().updatePage(page.id, {
          content: withInternalPageTitle(page.content, nextTitle),
        });
      }
      closeRenameDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重命名失败");
    } finally {
      committing.current = false;
      setBusy(false);
    }
  }, [renamePageId, renameValue, closeRenameDialog]);

  return {
    busy,
    renameDialogOpen,
    setRenameDialogOpen,
    renameValue,
    setRenameValue,
    renamePageId,
    setRenamePageId,
    openRenameDialog,
    closeRenameDialog,
    confirmRename,
  };
}
