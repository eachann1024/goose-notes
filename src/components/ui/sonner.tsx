import { Toaster as Sonner } from "sonner";
import { X } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      position="top-right"
      offset={14}
      mobileOffset={14}
      closeButton
      className="toaster group z-[22000]"
      richColors
      icons={{ close: <X className="h-3 w-3" /> }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !opacity-100 !bg-background/95 dark:!bg-background/90 !text-foreground !border !border-border/70 dark:!border-border/80 !shadow-[0_10px_26px_rgba(2,6,23,0.14)] dark:!shadow-[0_10px_28px_rgba(2,6,23,0.42)] backdrop-blur-md !rounded-xl !px-4 !py-2.5 !font-medium !text-sm !min-w-fit !w-auto",
          title:
            "!text-foreground !opacity-100 !font-semibold",
          description:
            "!text-muted-foreground",
          actionButton:
            "!bg-primary !text-primary-foreground hover:!bg-primary/90 !rounded-lg !px-3.5 !h-8 !text-xs !font-semibold !border !border-primary/20 transition-all duration-150",
          cancelButton:
            "!bg-muted !text-muted-foreground hover:!bg-muted/85 !rounded-lg !px-3 !h-8 !text-xs !font-medium",
          closeButton:
            "!absolute !left-auto !right-0 !top-0 !-translate-x-1/3 !translate-y-[-35%] !opacity-0 group-hover:!opacity-100 !transition-opacity !duration-200 !h-5 !w-5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
