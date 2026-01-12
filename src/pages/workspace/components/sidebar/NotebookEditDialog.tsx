import { renderNotebookIcon } from "./notebookUtils";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";
import { BookOpen, X, AlertTriangle, Save } from "lucide-react";
import { createPortal } from "react-dom";

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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6 animate-in fade-in duration-200">
      {/* 背景装饰 - 编辑模式 */}
      {!showDeleteConfirm && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
        </div>
      )}

      {/* 背景装饰 - 删除确认模式（红色渐变） */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-destructive/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-destructive/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-destructive/5 to-transparent rounded-full" />
        </div>
      )}

      {/* 关闭按钮 */}
      <button
        onClick={() => onOpenChange(false)}
        className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted/50 transition-colors z-10"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* 内容卡片 */}
      <div className="relative w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className={cn(
            "inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl",
            showDeleteConfirm
              ? "bg-gradient-to-br from-destructive to-destructive/60 shadow-destructive/20"
              : "bg-gradient-to-br from-primary to-primary/60 shadow-primary/20"
          )}>
            {showDeleteConfirm
              ? <AlertTriangle className="w-8 h-8 text-white" />
              : <BookOpen className="w-8 h-8 text-white" />
            }
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {showDeleteConfirm ? "永久删除记事本" : "编辑记事本"}
          </h1>
          <p className="text-muted-foreground">
            {showDeleteConfirm
              ? "此操作无法撤销，请谨慎操作"
              : "修改记事本的名称与图标"
            }
          </p>
        </div>

        {/* 表单卡片 */}
        {showDeleteConfirm ? (
          <div className="bg-destructive/5 backdrop-blur-sm border-2 border-destructive/20 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="space-y-3">
              <label htmlFor="confirm-delete" className="text-sm font-medium text-destructive">
                确认删除 <span className="font-bold">{confirmName}</span>
              </label>
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
                onClick={() => setShowDeleteConfirm(false)}
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
                className="flex-1 shadow-lg shadow-destructive/20"
              >
                确认删除
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-card/50 backdrop-blur-sm border-2 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">选择图标</label>
              <div className="flex justify-center">
                <Suspense fallback={<Button variant="outline" className="h-16 w-16 text-2xl">...</Button>}>
                  <IconSelector
                    value={icon}
                    onChange={(val) => onIconChange(val || "📓")}
                    portalContainerRef={editDialogContentRef}
                  >
                    <Button
                      variant="outline"
                      className="h-16 w-16 p-0 text-3xl hover:bg-primary/5 hover:border-primary/50 transition-all"
                    >
                      {renderNotebookIcon(icon)}
                    </Button>
                  </IconSelector>
                </Suspense>
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="notebook-name" className="text-sm font-medium text-muted-foreground">
                记事本名称
              </label>
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
            {notebookId && Object.keys(useNotebooks.getState().notebooks).length > 1 && (
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

            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => onOpenChange(false)}
                className="min-w-[100px]"
              >
                取消
              </Button>
              <Button
                size="lg"
                onClick={onSave}
                disabled={!notebookId}
                className="min-w-[100px] shadow-lg shadow-primary/20"
              >
                <Save className="mr-2 h-4 w-4" />
                保存
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
