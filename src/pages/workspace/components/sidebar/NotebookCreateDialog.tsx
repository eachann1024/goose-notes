import { renderNotebookIcon } from "./notebookUtils";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";
import { BookOpen, X } from "lucide-react";
import { createPortal } from "react-dom";

interface NotebookCreateDialogProps {
  open: boolean;
  name: string;
  icon: string;
  error: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onIconChange: (icon: string) => void;
  onCreate: () => void;
  onClearError: () => void;
}

export function NotebookCreateDialog({
  open,
  name,
  icon,
  error,
  onOpenChange,
  onNameChange,
  onIconChange,
  onCreate,
  onClearError,
}: NotebookCreateDialogProps) {
  const createDialogContentRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6 animate-in fade-in duration-200">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={() => onOpenChange(false)}
        className="absolute top-6 right-6 p-2 rounded-full hover:bg-gradient-to-br hover:from-muted/60 hover:to-muted/40 transition-all duration-200 z-10"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* 内容卡片 */}
      <div className="relative w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mb-4 shadow-xl shadow-primary/20">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">新建记事本</h1>
          <p className="text-muted-foreground">创建一个新的记事本</p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-md border-2 rounded-2xl p-6 shadow-lg space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-gradient-to-r from-destructive/15 to-destructive/5 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">选择图标</label>
            <div className="flex justify-center">
              <Suspense fallback={<Button variant="outline" className="h-20 w-20 text-3xl">...</Button>}>
                <IconSelector
                  value={icon}
                  onChange={(val) => onIconChange(val || "📓")}
                  portalContainerRef={createDialogContentRef}
                >
                  <Button
                    variant="outline"
                    className="h-20 w-20 p-0 hover:bg-gradient-to-br hover:from-primary/10 hover:to-primary/5 hover:border-primary/50 transition-all duration-200"
                  >
                    {renderNotebookIcon(icon, "h-10 w-10 text-4xl")}
                  </Button>
                </IconSelector>
              </Suspense>
            </div>
          </div>

          <div className="space-y-3">
            <label htmlFor="new-notebook-name" className="text-sm font-medium text-muted-foreground">
              记事本名称
            </label>
            <Input
              id="new-notebook-name"
              value={name}
              onChange={(e) => {
                onNameChange(e.target.value);
                onClearError();
              }}
              placeholder="输入记事本名称"
              className="h-12 text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCreate();
                }
              }}
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-center gap-3 mt-6">
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
            onClick={onCreate}
            disabled={!name.trim()}
            className="min-w-[100px] shadow-lg shadow-primary/20"
          >
            创建
          </Button>
        </div>

        {/* 快捷键提示 */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          按 <kbd className="px-1.5 py-0.5 rounded bg-gradient-to-r from-muted/80 to-muted/60 text-muted-foreground text-xs">Enter</kbd> 快速创建
        </p>
      </div>
    </div>,
    document.body
  );
}
