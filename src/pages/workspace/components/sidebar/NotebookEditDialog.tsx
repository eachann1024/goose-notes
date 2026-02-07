import { renderNotebookIcon } from "./notebookUtils";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";
import { BookOpen, AlertTriangle, Save } from "lucide-react";

interface NotebookEditDialogProps {
  open: boolean;
  notebookId: string;
  name: string;
  confirmName: string;
  icon: string;
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
  openDeleteConfirm = false,
  onOpenChange,
  onNameChange,
  onIconChange,
  onSave,
  onDelete,
}: NotebookEditDialogProps) {
  const editDialogContentRef = useRef<HTMLDivElement>(null);
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
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      layout="fullscreen"
      contentClassName="bg-[hsl(var(--goose-shell-bg))]"
      bodyClassName="relative h-full overflow-y-auto p-6 animate-in fade-in duration-200"
    >
      {/* 内容卡片 */}
      <div ref={editDialogContentRef} className="relative mx-auto w-full max-w-md py-6">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div
            className={cn(
              "inline-flex items-center justify-center w-16 h-16 rounded-[14px] mb-4 shadow-[0_10px_22px_rgba(15,23,42,0.1)]",
              showDeleteConfirm
                ? "bg-destructive/15"
                : "bg-[hsl(var(--goose-selected-bg))]",
            )}
          >
            {showDeleteConfirm ? (
              <AlertTriangle className="w-8 h-8 text-destructive" />
            ) : (
              <BookOpen className="w-8 h-8 text-foreground/80" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {showDeleteConfirm ? "永久删除记事本" : "编辑记事本"}
          </h1>
          <p className="text-muted-foreground">
            {showDeleteConfirm
              ? "此操作无法撤销，请谨慎操作"
              : "修改记事本的名称与图标"}
          </p>
        </div>

        {/* 表单卡片 */}
        {showDeleteConfirm ? (
          <div className="bg-destructive/10 backdrop-blur-[1px] border border-destructive/20 rounded-[14px] p-6 shadow-[0_12px_26px_rgba(15,23,42,0.1)] space-y-4">
            <div className="space-y-3">
              <Label
                htmlFor="confirm-delete"
                className="select-text text-sm font-medium text-destructive"
              >
                确认删除 <span className="select-text font-bold">{confirmName}</span>
              </Label>
              <Input
                id="confirm-delete"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={confirmName}
                className="h-12 text-base"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (openDeleteConfirm) {
                    // 直接删除入口：关闭整个对话框
                    onOpenChange(false);
                  } else {
                    // 编辑进入删除：返回编辑界面
                    setShowDeleteConfirm(false);
                  }
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={() => {
                  if (!isDeleteEnabled) return;
                  onDelete();
                }}
                disabled={!isDeleteEnabled}
                className="flex-1"
              >
                确认删除
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-card backdrop-blur-[1px] border-0 rounded-[14px] p-6 shadow-[0_12px_26px_rgba(15,23,42,0.1)] space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">
                选择图标
              </Label>
              <div className="flex justify-center">
                <Suspense
                  fallback={
                    <Button variant="outline" className="h-16 w-16 text-2xl">
                      ...
                    </Button>
                  }
                >
                  <IconSelector
                    value={icon}
                    onChange={(val) => onIconChange(val || "📓")}
                    portalContainerRef={editDialogContentRef}
                  >
                    <Button
                      variant="outline"
                      className="h-16 w-16 p-0 text-3xl hover:bg-[var(--goose-interactive-hover)] transition-all duration-200"
                    >
                      {renderNotebookIcon(icon)}
                    </Button>
                  </IconSelector>
                </Suspense>
              </div>
            </div>

            <div className="space-y-3">
              <Label
                htmlFor="notebook-name"
                className="text-sm font-medium text-muted-foreground"
              >
                记事本名称
              </Label>
              <Input
                id="notebook-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="记事本名称"
                className="h-12 text-base"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSave();
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* 操作按钮 - 编辑模式 */}
        {!showDeleteConfirm && (
          <div className="flex flex-col gap-4 mt-6">
            {/* 删除按钮（仅在有多个记事本时显示） */}
            {notebookId &&
              Object.keys(useNotebooks.getState().notebooks).length > 1 && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-full"
                >
                  <LucideIcons.Trash2 className="mr-2 h-4 w-4" />
                  删除此记事本
                </Button>
              )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => onOpenChange(false)}
                className="h-11 w-full"
              >
                取消
              </Button>
              <Button
                size="lg"
                onClick={onSave}
                disabled={!notebookId}
                className="h-11 w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                保存
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
