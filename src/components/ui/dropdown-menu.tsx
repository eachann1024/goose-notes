import * as React from "react";
import { Dropdown, Popover as HeroPopover, Separator } from "@heroui/react";
import { cn } from "@/lib/utils";
import { TriggerChild } from "./trigger-child";

type DropdownVariant = "dropdown" | "menu";
const DropdownVariantContext = React.createContext<DropdownVariant>("dropdown");

function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>) {
  return (
    <Dropdown
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </Dropdown>
  );
}
const DropdownMenuTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => (
  <HeroPopover.Trigger
    {...props}
    ref={ref as React.Ref<HTMLDivElement>}
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
  </HeroPopover.Trigger>
));
type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
  editorContext?: boolean;
  /** 操作列表：与右键菜单共用灰底高亮；设置类下拉保持强调色。 */
  variant?: DropdownVariant;
};
const menuSurfaceClass =
  "goose-menu-surface p-1 text-popover-foreground";
const DropdownMenuContent = React.forwardRef<HTMLElement, ContentProps>(
  (
    {
      children,
      className,
      align = "start",
      side = "bottom",
      sideOffset = 6,
      alignOffset = 0,
      collisionPadding = 8,
      editorContext,
      variant = "dropdown",
      ...props
    },
    ref,
  ) => {
    const isMenu = variant === "menu";
    const surfaceOnInner = Boolean(editorContext && isMenu);
    return (
      <DropdownVariantContext.Provider value={variant}>
        <Dropdown.Popover
          {...props}
          ref={ref}
          offset={sideOffset}
          crossOffset={alignOffset}
          containerPadding={collisionPadding}
          placement={
            align === "center"
              ? side
              : side === "top" || side === "bottom"
                ? `${side} ${align}`
                : `${side} ${align === "start" ? "top" : "bottom"}`
          }
          data-goose-floating-content=""
          className={cn(
            "z-[20000] min-w-[9.5rem] outline-none",
            !surfaceOnInner && "max-h-[var(--available-height)] overflow-y-auto",
            surfaceOnInner
              ? "goose-dropdown-host"
              : isMenu
                ? menuSurfaceClass
                : "goose-floating-surface p-1.5 text-popover-foreground",
            !editorContext && className,
          )}
          style={props.style}
        >
          <Dropdown.Menu
            aria-label="操作"
            className={cn(
              "outline-none",
              editorContext && "goose-editor-context-ui",
              surfaceOnInner && menuSurfaceClass,
              surfaceOnInner &&
                "max-h-[var(--available-height)] overflow-y-auto",
              editorContext && className,
            )}
          >
            {children}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </DropdownVariantContext.Provider>
    );
  },
);
const itemClass =
  "goose-interactive relative flex cursor-default select-none items-center gap-2 rounded-lg pe-2 ps-2 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:text-disabled [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
const menuItemClass =
  "goose-interactive goose-menu-item relative flex w-full cursor-default select-none items-center gap-2 px-2 py-0 text-left text-sm leading-5 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
type ItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof Dropdown.Item>,
  "onSelect" | "children" | "onClick"
> & {
  children?: React.ReactNode;
  inset?: boolean;
  disabled?: boolean;
  onSelect?: (event: Event) => void;
  onClick?: () => void;
};
const DropdownMenuItem = React.forwardRef<HTMLDivElement, ItemProps>(
  (
    { className, inset, disabled, onSelect, onClick, children, ...props },
    ref,
  ) => {
    const variant = React.useContext(DropdownVariantContext);
    return (
      <Dropdown.Item
        {...props}
        ref={ref}
        isDisabled={disabled}
        className={cn(
          variant === "menu" ? menuItemClass : itemClass,
          inset && "pl-8",
          className,
        )}
        onAction={() => {
          const event = new Event("select", { cancelable: true });
          onSelect?.(event);
          if (!event.defaultPrevented) onClick?.();
        }}
      >
        {children}
      </Dropdown.Item>
    );
  },
);
function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <Separator
      {...props}
      className={cn("goose-menu-separator h-px", className)}
    />
  );
}
function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
}: React.PropsWithChildren<{
  value: string;
  onValueChange?: (value: string) => void;
}>) {
  return (
    <Dropdown.Section
      selectionMode="single"
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        if (keys !== "all") {
          const key = keys.values().next().value;
          if (key !== undefined) onValueChange?.(String(key));
        }
      }}
    >
      {children}
    </Dropdown.Section>
  );
}
export function DropdownMenuIconSlot({
  icon,
  loading = false,
}: {
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  const [retained, setRetained] = React.useState(icon);
  const [visible, setVisible] = React.useState(Boolean(icon) && !loading);
  const shown = loading || !icon ? retained : icon;
  if (!loading && icon && retained !== icon) setRetained(icon);
  if ((loading || !icon) && visible) setVisible(false);
  React.useEffect(() => {
    if (!loading && icon) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(() => setRetained(undefined), 160);
    return () => window.clearTimeout(timer);
  }, [icon, loading]);
  if (!loading && !shown) return null;
  return (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
      {loading && <span className="absolute inset-0 animate-pulse rounded-sm bg-muted-foreground/25 motion-reduce:animate-none" />}
      {shown && <span className={cn("inline-flex transition-opacity duration-150 ease-out motion-reduce:transition-none", visible ? "opacity-100" : "opacity-0")}>{shown}</span>}
    </span>
  );
}
function DropdownMenuRadioItem({
  value,
  children,
  className,
  hideIndicator = false,
  icon,
  iconLoading = false,
  ...props
}: Omit<ItemProps, "value"> & { value: string; hideIndicator?: boolean; icon?: React.ReactNode; iconLoading?: boolean }) {
  return (
    <DropdownMenuItem {...props} id={value} className={cn("ps-2", className)} style={{ ...props.style, paddingInlineStart: "0.5rem" }}>
      <span className="flex min-w-0 flex-1 items-center gap-2 [&>svg]:shrink-0"><DropdownMenuIconSlot icon={icon} loading={iconLoading} />{children}</span>
      {!hideIndicator && <Dropdown.ItemIndicator className="ms-auto shrink-0" style={{ position: "static", transform: "none", translate: "none", color: "currentColor" }} />}
    </DropdownMenuItem>
  );
}
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";
DropdownMenuContent.displayName = "DropdownMenuContent";
DropdownMenuItem.displayName = "DropdownMenuItem";
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
};
