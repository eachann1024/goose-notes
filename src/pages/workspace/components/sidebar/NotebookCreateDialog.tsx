import { renderNotebookIcon } from "./notebookUtils";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";
import { BookOpen } from "lucide-react";

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

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      layout="fullscreen"
      contentClassName="bg-[hsl(var(--goose-shell-bg))]"
      bodyClassName="relative h-full overflow-y-auto p-6 animate-in fade-in duration-200"
    >
      {/* 内容卡片 */}
      <div ref={createDialogContentRef} className="relative mx-auto w-full max-w-md py-6">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[14px] bg-[hsl(var(--goose-selected-bg))] mb-4 shadow-[0_10px_22px_rgba(15,23,42,0.1)]">
            <BookOpen className="w-8 h-8 text-foreground/80" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">新建记事本</h1>
          <p className="text-muted-foreground">创建一个新的记事本</p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-card backdrop-blur-[1px] border-0 rounded-[14px] p-6 shadow-[0_12px_26px_rgba(15,23,42,0.1)] space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-[10px]">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">选择图标</Label>
            <div className="flex justify-center">
              <Suspense fallback={<Button variant="outline" className="h-24 w-24 text-4xl">...</Button>}>
                <IconSelector
                  value={icon}
                  onChange={(val) => onIconChange(val || "📓")}
                  portalContainerRef={createDialogContentRef}
                  scope="general"
                >
                  <Button
                    variant="outline"
                    className="h-24 w-24 p-0 hover:bg-[var(--goose-interactive-hover)] transition-all duration-200"
                  >
                    {renderNotebookIcon(icon, "h-14 w-14 text-5xl")}
                  </Button>
                </IconSelector>
              </Suspense>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="new-notebook-name" className="text-sm font-medium text-muted-foreground">
              记事本名称
            </Label>
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
            className="min-w-[100px] flex-1"
          >
            取消
          </Button>
          <Button
            size="lg"
            onClick={onCreate}
            disabled={!name.trim()}
            className="min-w-[100px] flex-1"
          >
            创建
          </Button>
        </div>

        {/* 快捷键提示 */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          按 <kbd className="px-1.5 py-0.5 rounded-[10px] bg-muted text-muted-foreground text-xs">Enter</kbd> 快速创建
        </p>
      </div>
    </DialogShell>
  );
}
