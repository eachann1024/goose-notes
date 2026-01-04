import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zinc-950 group-[.toaster]:text-zinc-50 dark:group-[.toaster]:bg-zinc-50 dark:group-[.toaster]:text-zinc-950 group-[.toaster]:border-transparent group-[.toaster]:shadow-xl group-[.toaster]:rounded-full group-[.toaster]:px-6 group-[.toaster]:py-3 group-[.toaster]:font-medium group-[.toaster]:text-sm group-[.toaster]:min-w-fit group-[.toaster]:w-auto",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "!bg-white/30 !text-zinc-50 hover:!bg-white/40 dark:!bg-black/20 dark:!text-zinc-950 dark:hover:!bg-black/30 !rounded-full !px-4 !h-8 !text-xs !font-medium transition-all duration-200",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
