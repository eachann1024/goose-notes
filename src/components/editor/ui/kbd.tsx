import { formatShortcut } from "@/lib/utils";
import { cn } from "../utils/cn";

interface KbdProps {
  shortcut: string;
  className?: string;
}

export function Kbd({ shortcut, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center rounded-md border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] px-1.5 font-mono text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {formatShortcut(shortcut)}
    </kbd>
  );
}
