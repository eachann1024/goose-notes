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
      swipeDirections={["left", "right", "top"]}
      className="toaster group z-[22000]"
      richColors
      icons={{ close: <X className="h-3 w-3" /> }}
      toastOptions={{
        duration: 4000,
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
            "!absolute !left-auto !right-1.5 !top-1.5 !translate-x-0 !translate-y-0 !opacity-60 hover:!opacity-100 !transition-opacity !duration-150 !h-5 !w-5 !bg-transparent !border-0 !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
