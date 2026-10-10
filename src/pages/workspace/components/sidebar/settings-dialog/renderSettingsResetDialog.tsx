import * as GooseIcons from "@/components/ui/icons";
import type { useSettingsResetActions } from "./useSettingsResetActions";

export function renderSettingsResetDialog(
  context: ReturnType<typeof useSettingsResetActions>,
) {
  const {
    open,
    onOpenChange,
    resetDialogOpen,
    setResetDialogOpen,
    resetInput,
    setResetInput,
    resetting,
    resetPhrase,
    canReset,
    handleManualReset,
  } = context;
  return (
    <DialogShell
      open={open && resetDialogOpen}
      onOpenChange={setResetDialogOpen}
      layout="fullscreen"
      contentClassName="bg-[hsl(var(--goose-shell-bg))]"
      bodyClassName="relative h-full overflow-y-auto p-6 animate-in fade-in duration-200"
    >
      <div className="relative mx-auto w-full max-w-md py-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[14px] mb-4 bg-[var(--goose-color-danger-subtle-bg)]">
            <GooseIcons.AlertTriangle className="w-7 h-7 text-danger" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            确认重置应用数据？
          </h1>
          <p className="text-muted-foreground">
            此操作将清空应用内的所有笔记本、历史版本、AI
            对话及偏好设置（您硬盘上的本地文件夹文件不受影响）。
          </p>
        </div>

        <div className="bg-[var(--goose-color-danger-subtle-bg)] backdrop-blur-[1px] rounded-[14px] p-6 shadow-[0_12px_26px_rgba(15,23,42,0.1)] space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-medium text-danger select-none">
              请输入以下短语以确认重置：
              <span className="ml-1 select-text font-bold text-foreground">
                {resetPhrase}
              </span>
            </div>
            <Input
              id="reset-all"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder={resetPhrase}
              className="h-12 text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canReset && !resetting) {
                  void handleManualReset();
                }
              }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setResetDialogOpen(false)}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={() => void handleManualReset()}
              disabled={!canReset || resetting}
              className="flex-1"
            >
              {resetting ? "正在重置…" : "确认重置"}
            </Button>
          </div>
        </div>
      </div>
    </DialogShell>
  );
}
