import { CircleAlert, RotateCcw, X } from "@/components/ui/icons";
import { SuccessToastIcon, toast } from "./sonner";

type ReceiptItem = { title: string; deleted: boolean };

/** One receipt for one or many deletions; undo appears only when a real restore is available. */
export function showDeleteReceipt(
  items: ReceiptItem[],
  isLocalFolder: boolean,
  onUndo?: () => void | Promise<void>,
) {
  if (!items.length) return;
  const done = items.filter((item) => item.deleted).length;
  const failed = items.length - done;
  const destination = isLocalFolder ? "系统废纸篓" : "应用垃圾箱";
  let undoing = false;
  // ponytail: the receipt shows only outcome and undo; add a detail view if item-level diagnostics become necessary.
  const label = failed
    ? done ? `${done} 项已移动，${failed} 项未完成` : `${failed} 项未完成`
    : items.length === 1
      ? `已移入${destination} · ${items[0].title}`
      : `${done} 项已移入${destination}`;

  toast.custom(
    (id) => (
      <section
        aria-label="删除回执"
        role="status"
        className="flex w-full items-center gap-3 text-foreground"
      >
        {failed ? (
          <CircleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
        ) : (
          <SuccessToastIcon />
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={label}>{label}</p>
        {done > 0 && onUndo && (
          <button type="button" aria-label="撤回删除" onClick={async () => {
            if (undoing) return;
            undoing = true;
            try {
              await onUndo();
              toast.dismiss(id);
            } catch (error) {
              toast.error("撤回失败", { description: error instanceof Error ? error.message : "请稍后重试" });
            } finally {
              undoing = false;
            }
          }} className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md bg-[var(--goose-interactive-selected)] px-2.5 text-xs font-semibold text-[var(--goose-interactive-selected-fg)]  ">
            <RotateCcw className="size-4" aria-hidden="true" />撤回
          </button>
        )}
        <button type="button" aria-label="关闭删除回执" onClick={() => toast.dismiss(id)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted ">
          <X className="size-4" aria-hidden="true" />
        </button>
      </section>
    ),
    { duration: 8000, closeButton: false, className: "goose-delete-receipt-toast" },
  );
}
