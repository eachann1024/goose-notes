import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogShell } from "@/components/ui/dialog-shell";
import { AlertCircle, FolderPlus } from "lucide-react";
import { createVaultNotebook } from "@/lib/local-vault";

interface CreateVaultDialogProps {
  open: boolean;
  /** 已选好的父目录；为空时对话框不渲染内容 */
  parentDir: string | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: (notebookId: string) => void;
}

/** 桌面端「新建仓库」：选完父目录后输入名称，确认后 mkdir + 挂载。 */
export function CreateVaultDialog({
  open,
  parentDir,
  onOpenChange,
  onCreated,
}: CreateVaultDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
      setCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!parentDir) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请输入仓库名称");
      return;
    }
    setCreating(true);
    const notebookId = await createVaultNotebook(parentDir, trimmed);
    setCreating(false);
    if (!notebookId) {
      setError("创建失败，请换一个名称或目录");
      return;
    }
    onCreated?.(notebookId);
    onOpenChange(false);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      layout="fullscreen"
      contentClassName="bg-[hsl(var(--goose-shell-bg))]"
      bodyClassName="relative h-full overflow-y-auto p-6 animate-in fade-in duration-200"
    >
      <div className="relative mx-auto w-full max-w-md py-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[14px] mb-4 bg-[hsl(var(--goose-selected-bg))]">
            <FolderPlus className="w-7 h-7 text-foreground/75" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">新建仓库</h1>
          <p className="text-muted-foreground break-all">
            在 {parentDir ?? ""} 下创建新的笔记文件夹
          </p>
        </div>

        <div className="bg-card backdrop-blur-[1px] border-0 rounded-[14px] p-6 shadow-[0_12px_26px_rgba(15,23,42,0.1)] space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-[10px] bg-[var(--goose-color-danger-subtle-bg)] px-3 py-2 text-sm text-[var(--goose-color-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0 leading-relaxed">{error}</span>
            </div>
          )}
          <div className="space-y-3">
            <Label htmlFor="vault-name" className="text-sm font-medium text-muted-foreground">
              仓库名称
            </Label>
            <Input
              id="vault-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="输入文件夹名称"
              className="h-12 text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>
        </div>

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
            onClick={() => void handleCreate()}
            disabled={!name.trim() || creating}
            className="min-w-[100px] flex-1"
          >
            {creating ? "创建中…" : "创建"}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
