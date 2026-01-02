interface SidebarDeleteDialogProps {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function SidebarDeleteDialog({
  open,
  title,
  onOpenChange,
  onConfirm,
}: SidebarDeleteDialogProps) {
  const descriptionId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={descriptionId}
        className="sm:max-w-[400px]"
      >
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription id={descriptionId}>
            确定要将「{title || "无标题"}」移至垃圾箱吗？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
