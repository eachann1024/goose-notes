import { renderNotebookIcon } from "./notebookUtils";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={createDialogContentRef} className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>新建记事本</DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Suspense fallback={<Button variant="outline" className="h-12 w-12 flex items-center justify-center">...</Button>}>
              <IconSelector
                value={icon}
                onChange={(val) => onIconChange(val || "📓")}
                portalContainerRef={createDialogContentRef}
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
              id="new-notebook-name"
              value={name}
              onChange={(e) => {
                onNameChange(e.target.value);
                onClearError();
              }}
              placeholder="输入记事本名称"
              className="h-12 flex-1 text-base shadow-sm"
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

        <DialogFooter className="flex justify-between items-center sm:justify-between">
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" onClick={onCreate}>
              创建
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
