import * as React from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
interface DialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layout?: "center" | "fullscreen"
  title?: React.ReactNode
  description?: React.ReactNode
  hideClose?: boolean
  contentClassName?: string
  bodyClassName?: string
  footer?: React.ReactNode
  children: React.ReactNode
}

export function DialogShell({
  open,
  onOpenChange,
  layout = "center",
  title,
  description,
  hideClose = false,
  contentClassName,
  bodyClassName,
  footer,
  children,
}: DialogShellProps) {
  const isFullscreen = layout === "fullscreen"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className={cn(
          "origin-center data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-right-0 data-[state=closed]:slide-out-to-top-0 data-[state=closed]:slide-out-to-bottom-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-right-0 data-[state=open]:slide-in-from-top-0 data-[state=open]:slide-in-from-bottom-0",
          isFullscreen
            ? "left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0"
            : "sm:max-w-lg",
          contentClassName
        )}
      >
        {!hideClose && (
          <DialogClose asChild>
            <button
              type="button"
              className={cn(
                "absolute z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted/65 hover:text-foreground",
                isFullscreen ? "top-4 right-4" : "top-4 right-4"
              )}
              aria-label="关闭"
            >
              <LucideIcons.X className="h-7 w-7" />
            </button>
          </DialogClose>
        )}

        {title || description ? (
          <DialogHeader className="p-6 pb-0">
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        ) : null}

        <div className={cn("min-h-0", bodyClassName)}>{children}</div>

        {footer ? <DialogFooter className="px-6 pb-6 pt-0">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
