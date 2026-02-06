import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group z-[22000]"
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast !opacity-100 !bg-zinc-950 !text-zinc-50 dark:!bg-zinc-950 dark:!text-zinc-100 !border !border-zinc-700/75 dark:!border-zinc-700/80 !shadow-[0_8px_20px_rgba(2,6,23,0.28)] !rounded-[18px] !px-5 !py-2.5 !font-semibold !text-sm !min-w-fit !w-auto",
          title:
            "!text-zinc-50 dark:!text-zinc-50 !opacity-100",
          description:
            "!text-zinc-300 dark:!text-zinc-400",
          actionButton:
            "!bg-zinc-700 !text-zinc-50 hover:!bg-zinc-600 dark:!bg-zinc-700 dark:!text-zinc-100 dark:hover:!bg-zinc-600 !rounded-[12px] !px-3.5 !h-8 !text-xs !font-semibold !border !border-zinc-500/50 transition-all duration-150",
          cancelButton:
            "!bg-muted !text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
