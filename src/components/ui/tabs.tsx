import * as React from "react";
import { Tabs as HeroTabs } from "@heroui/react";
import { cn } from "@/lib/utils";

type TabsProps = Omit<
  React.ComponentProps<typeof HeroTabs>,
  "onSelectionChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};
function Tabs({ value, defaultValue, onValueChange, ...props }: TabsProps) {
  return (
    <HeroTabs
      {...props}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onValueChange?.(String(key))}
    />
  );
}
const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof HeroTabs.List>
>(({ className, ...props }, ref) => (
  <HeroTabs.List
    {...props}
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
  />
));
const TabsTrigger = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof HeroTabs.Tab>, "id"> & {
    value: string;
    disabled?: boolean;
  }
>(({ value, disabled, className, ...props }, ref) => (
  <HeroTabs.Tab
    {...props}
    id={value}
    isDisabled={disabled}
    ref={ref}
    className={cn(
      "goose-interactive inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent px-3 py-1 text-sm font-medium text-muted-foreground ring-offset-background data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
  />
));
const TabsContent = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof HeroTabs.Panel>, "id"> & {
    value: string;
  }
>(({ value, className, ...props }, ref) => (
  <HeroTabs.Panel
    {...props}
    id={value}
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background ",
      className,
    )}
  />
));
TabsList.displayName = "TabsList";
TabsTrigger.displayName = "TabsTrigger";
TabsContent.displayName = "TabsContent";
export { Tabs, TabsList, TabsTrigger, TabsContent };
