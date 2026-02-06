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
            "group toast group-[.toaster]:bg-zinc-950/98 group-[.toaster]:text-zinc-50 dark:group-[.toaster]:bg-zinc-950/97 dark:group-[.toaster]:text-zinc-100 group-[.toaster]:border group-[.toaster]:border-zinc-700/75 dark:group-[.toaster]:border-zinc-700/80 group-[.toaster]:shadow-[0_8px_20px_rgba(2,6,23,0.28)] group-[.toaster]:rounded-[18px] group-[.toaster]:px-5 group-[.toaster]:py-2.5 group-[.toaster]:font-semibold group-[.toaster]:text-sm group-[.toaster]:min-w-fit group-[.toaster]:w-auto",
          description:
            "group-[.toast]:text-zinc-300 dark:group-[.toast]:text-zinc-400",
          actionButton:
            "!bg-zinc-700/96 !text-zinc-50 hover:!bg-zinc-600 dark:!bg-zinc-700/96 dark:!text-zinc-100 dark:hover:!bg-zinc-600 !rounded-[12px] !px-3.5 !h-8 !text-xs !font-semibold !border !border-zinc-500/50 transition-all duration-150",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
