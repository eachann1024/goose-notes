import type { HTMLAttributes, MouseEvent, PointerEvent } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import "./main-tree.css";

export function MainTreeRowShell({
  active = false,
  hovered = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { active?: boolean; hovered?: boolean }) {
  return (
    <div
      {...props}
      className={cn(
        "main-tree-row group/main-row relative z-10 flex items-center gap-1 rounded-lg pl-0 pr-2",
        "text-[13px] font-medium leading-none cursor-pointer select-none transition-colors duration-150 outline-none",
        active && "main-tree-row--selected",
        !active && hovered && "main-tree-row--hovered",
        className,
      )}
    />
  );
}

export function MainTreeRowDisclosure({
  expanded,
  label,
  onToggle,
  nativeProps,
  revealOnRowHover = false,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
  nativeProps?: HTMLAttributes<HTMLButtonElement>;
  revealOnRowHover?: boolean;
}) {
  const toggleFromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button === 0 && !event.ctrlKey) onToggle();
  };
  const toggleFromClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail === 0) onToggle();
  };
  return (
    <button
      {...nativeProps}
      type="button"
      className={cn(
        "main-tree-row-disclosure relative z-10 ml-1.5 inline-flex w-5 h-5 shrink-0 items-center justify-center rounded transition-colors duration-150 ease-out hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] hover:[&_svg]:text-[var(--goose-interactive-selected-fg)] dark:hover:bg-[var(--goose-interactive-hover)]",
        revealOnRowHover &&
          "opacity-0 group-hover/main-row:opacity-100",
      )}
      aria-label={label}
      aria-expanded={expanded}
      onPointerDown={toggleFromPointer}
      onClick={toggleFromClick}
    >
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground/80 transition-transform duration-150 ease-out",
          expanded && "rotate-90",
        )}
      />
    </button>
  );
}
