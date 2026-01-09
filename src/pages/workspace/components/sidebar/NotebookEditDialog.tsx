import { renderNotebookIcon } from "./notebookUtils";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";

interface NotebookEditDialogProps {
  open: boolean;
  notebookId: string;
  name: string;
  confirmName: string;
  icon: string;
  isDefault: boolean;
  openDeleteConfirm?: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onIconChange: (icon: string) => void;
  onSave: () => void;
  onDelete: () => void;
}

export function NotebookEditDialog({
  open,
  notebookId,
  name,
  confirmName,
  icon,
  isDefault,
  openDeleteConfirm = false,
  onOpenChange,
  onNameChange,
  onIconChange,
  onSave,
  onDelete,
}: NotebookEditDialogProps) {
  const editDialogContentRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false);
      setDeleteConfirmInput("");
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setShowDeleteConfirm(openDeleteConfirm);
    }
  }, [open, openDeleteConfirm]);

  const isDeleteEnabled = deleteConfirmInput === confirmName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={editDialogContentRef}
        aria-describedby={descriptionId}
        className="sm:max-w-[400px]"
      >
        <DialogHeader>
          <DialogTitle>{showDeleteConfirm ? "永久删除记事本？" : "编辑记事本"}</DialogTitle>
          <DialogDescription id={descriptionId} className="sr-only">
            编辑记事本名称与图标，或执行删除操作
          </DialogDescription>
          {showDeleteConfirm && (
            <DialogDescription className="text-destructive pt-2">
              此操作无法撤销。这将永久删除该记事本及其所有内容。
            </DialogDescription>
          )}
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="py-6">
            <div className="grid gap-2">
              <Label htmlFor="confirm-delete" className="text-muted-foreground">
                请输入 <span className="font-bold text-foreground select-all">{confirmName}</span> 以确认删除
              </Label>
              <Input
                id="confirm-delete"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={confirmName}
                className="w-full h-11"
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div className="py-6">
            <div className="flex items-center gap-3">
              <Suspense fallback={<Button variant="outline" className="h-12 w-12 flex items-center justify-center">...</Button>}>
                <IconSelector
                  value={icon}
                  onChange={(val) => onIconChange(val || "📓")}
                  portalContainerRef={editDialogContentRef}
                >
                  <Button
                    variant="outline"
                    className="h-12 w-12 p-0 flex items-center justify-center shrink-0 text-xl shadow-sm"
                  >
                    {renderNotebookIcon(icon)}
                  </Button>
                </IconSelector>
              </Suspense>
              <Input
                id="notebook-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="记事本名称"
                className="h-12 flex-1 text-base shadow-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between items-center sm:justify-between">
          {showDeleteConfirm ? (
            <div className="flex w-full justify-between">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!isDeleteEnabled) return;
                  onDelete();
                }}
                disabled={!isDeleteEnabled}
              >
                确认删除
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-between items-center">
              {!isDefault ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <LucideIcons.Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button size="sm" onClick={onSave} disabled={!notebookId}>
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
