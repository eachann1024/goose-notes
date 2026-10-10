import * as GooseIcons from "@/components/ui/icons";
import { isWorkspaceSettingsOpen } from "@/lib/settings-navigation";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useEffect, useRef, useState } from "react";

const EXPORT_OPEN_DELAY_MS = 80;
const EXPORT_CLOSE_DELAY_MS = 150;
const EXPORT_MENU_PAD_PX = 8;

function pointInElement(
  x: number,
  y: number,
  element: HTMLElement | null,
  pad = 0,
) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  );
}

export function PageExportSubmenu({
  enabled,
  viewportHeight,
  onExportMarkdown,
  onExportHtml,
  onExportWord,
  onExportPdf,
}: {
  enabled: boolean;
  viewportHeight: number;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportWord: () => void;
  onExportPdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const suppressHoverOpen = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  openRef.current = open;

  const clearTimers = () => {
    if (openTimer.current != null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const closeNow = () => {
    suppressHoverOpen.current = true;
    clearTimers();
    setOpen(false);
  };

  const pointerInHoverZone = (x: number, y: number) =>
    pointInElement(x, y, triggerRef.current, 2) ||
    pointInElement(x, y, menuRef.current, EXPORT_MENU_PAD_PX);

  useEffect(() => () => clearTimers(), []);
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const menu = document.querySelector<HTMLDivElement>(".goose-page-menu-export");
      if (menu) menuRef.current = menu;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    if (!enabled) {
      suppressHoverOpen.current = false;
      clearTimers();
      setOpen(false);
      return;
    }
    const onMove = (event: PointerEvent) => {
      if (pointerInHoverZone(event.clientX, event.clientY)) {
        if (suppressHoverOpen.current) return;
        if (closeTimer.current != null) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        if (openRef.current || openTimer.current != null) return;
        openTimer.current = window.setTimeout(() => {
          openTimer.current = null;
          setOpen(true);
        }, EXPORT_OPEN_DELAY_MS);
        return;
      }
      suppressHoverOpen.current = false;
      if (openTimer.current != null) {
        window.clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      if (!openRef.current || closeTimer.current != null) return;
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null;
        setOpen(false);
      }, EXPORT_CLOSE_DELAY_MS);
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [enabled]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (isWorkspaceSettingsOpen()) return;
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeNow();
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const select = (action: () => void) => {
    closeNow();
    action();
  };

  const itemClass =
    "goose-interactive group grid min-h-[32px] w-full cursor-default grid-cols-[16px_minmax(0,1fr)] items-center gap-x-2 rounded-lg px-2 text-left text-xs";

  return (
    <Popover
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (next) {
          clearTimers();
          setOpen(true);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          data-state={open ? "open" : "closed"}
          aria-haspopup="menu"
          aria-expanded={open}
          onPointerEnter={(event) => {
            if (suppressHoverOpen.current) return;
            if (pointerInHoverZone(event.clientX, event.clientY) && !open) {
              if (openTimer.current != null) return;
              openTimer.current = window.setTimeout(() => {
                openTimer.current = null;
                setOpen(true);
              }, EXPORT_OPEN_DELAY_MS);
            }
          }}
          className="goose-interactive group grid min-h-[32px] w-full cursor-default grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-1.5 rounded-lg px-2 text-left text-xs"
        >
          <GooseIcons.Export className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)] group-data-[state=open]:text-[var(--goose-interactive-selected-fg)]" />
          <span className="min-w-0 truncate">导出</span>
          <GooseIcons.ChevronRight className="ml-auto h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={menuRef}
        side="right"
        align="start"
        sideOffset={4}
        alignOffset={-4}
        collisionPadding={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="goose-page-menu-export goose-page-menu-surface min-w-[144px] w-auto rounded-[12px] p-1"
        style={{
          maxHeight:
            viewportHeight <= 0
              ? undefined
              : `${Math.max(120, viewportHeight - 16)}px`,
        }}
      >
        <div role="menu" aria-label="导出">
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportMarkdown)}
          >
            <GooseIcons.FileCode className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">Markdown</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportHtml)}
          >
            <GooseIcons.FileType className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">HTML</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportWord)}
          >
            <GooseIcons.File className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">Word</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => select(onExportPdf)}
          >
            <GooseIcons.FileText className="h-3.5 w-3.5 text-muted-foreground group-focus:text-[var(--goose-interactive-selected-fg)]" />
            <span className="min-w-0 truncate">PDF</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
