import * as React from "react";
import { Modal } from "@heroui/react";
import { cn } from "@/lib/utils";
import { TriggerChild } from "./trigger-child";

type DialogProps = React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;
const DialogDescriptionId = React.createContext<string | undefined>(undefined);
// HeroUI 3.1 forwards all Dialog props, but its declaration omits React Aria's ref.
const ModalDialog = Modal.Dialog as React.ComponentType<
  React.ComponentProps<typeof Modal.Dialog> & React.RefAttributes<HTMLElement>
>;
function Dialog({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  const descriptionId = React.useId();
  return (
    <DialogDescriptionId.Provider value={descriptionId}>
      <Modal
        isOpen={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        {children}
      </Modal>
    </DialogDescriptionId.Provider>
  );
}
const DialogTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => (
  <Modal.Trigger
    {...props}
    ref={ref}
    render={
      asChild && React.isValidElement(children)
        ? (injected) => (
            <TriggerChild
              child={
                children as React.ReactElement<
                  React.HTMLAttributes<HTMLElement>
                >
              }
              injected={injected}
            />
          )
        : undefined
    }
  >
    {asChild ? undefined : children}
  </Modal.Trigger>
));
const DialogClose = Modal.CloseTrigger;
const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Modal.Backdrop>
>(({ className, ...props }, ref) => (
  <Modal.Backdrop
    {...props}
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100] bg-black/30 backdrop-blur-[1px]",
      className,
    )}
  />
));
interface DialogContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Modal.Dialog>,
  "children"
> {
  children: React.ReactNode;
  hideClose?: boolean;
  overlayClassName?: string;
}
const DialogContent = React.forwardRef<HTMLElement, DialogContentProps>(
  ({ className, children, hideClose, overlayClassName, ...props }, ref) => {
    const descriptionId = React.useContext(DialogDescriptionId);
    return (
      <DialogOverlay className={overlayClassName}>
        <Modal.Container className="contents">
          <ModalDialog
            {...props}
            ref={ref}
            aria-describedby={props["aria-describedby"] ?? descriptionId}
            className={cn(
              "fixed left-[50%] top-[50%] z-[100] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-visible border-0 bg-background p-6 shadow-[0_16px_36px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.08)] sm:rounded-[14px]",
              className,
            )}
          >
            {children}
            {!hideClose && (
              <DialogClose
                aria-label="关闭"
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-sm bg-transparent text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-[var(--goose-icon-chip-on-selected)] hover:text-[var(--goose-interactive-selected-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LucideIcons.X className="h-4 w-4" />
              </DialogClose>
            )}
          </ModalDialog>
        </Modal.Container>
      </DialogOverlay>
    );
  },
);
function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        className,
      )}
    />
  );
}
function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className,
      )}
    />
  );
}
const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof Modal.Heading>
>(({ className, ...props }, ref) => (
  <Modal.Heading
    {...props}
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
  />
));
const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const id = React.useContext(DialogDescriptionId);
  return (
    <p
      id={id}
      {...props}
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
    />
  );
});
DialogTrigger.displayName = "DialogTrigger";
DialogOverlay.displayName = "DialogOverlay";
DialogContent.displayName = "DialogContent";
DialogTitle.displayName = "DialogTitle";
DialogDescription.displayName = "DialogDescription";
export {
  Dialog,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
export type { DialogProps };
