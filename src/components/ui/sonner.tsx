import { useEffect } from "react";
import { Toaster as Sonner } from "sonner";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const defaultToastClassNames = {
  // 注意：
  // 1. 不要加 `toast` 标记类 —— @heroui/styles 定义了同名 .toast 组件类
  //    （position:absolute/left:0/right:0/pointer-events 等），会劫持 sonner 的布局
  //    并让关闭按钮点击失效。
  // 2. 不要加 !opacity-100 —— sonner 靠 opacity:0 隐藏过期/超出堆叠数的
  //    toast（data-visible=false），强制不透明会让"幽灵 toast"留在屏幕上且点不动。
  // 3. 不要加 !w-auto/!min-w-fit —— 挂载瞬间宽度塌缩会让 sonner 把竖排文字的高度
  //    记成 --initial-height，导致堆叠偏移错乱。
  toast:
    "group !bg-background/95 dark:!bg-background/90 !text-foreground !border !border-border/70 dark:!border-border/80 !shadow-[0_10px_26px_rgba(2,6,23,0.14)] dark:!shadow-[0_10px_28px_rgba(2,6,23,0.42)] backdrop-blur-md !rounded-xl !px-4 !py-2.5 !font-medium !text-sm",
  title:
    "!text-foreground !opacity-100 !font-semibold",
  description:
    "!text-muted-foreground",
  actionButton:
    "!bg-primary !text-primary-foreground hover:!bg-primary/90 !rounded-lg !px-3.5 !h-8 !text-xs !font-semibold !border !border-primary/20 transition-all duration-150",
  cancelButton:
    "!bg-muted !text-muted-foreground hover:!bg-muted/85 !rounded-lg !px-3 !h-8 !text-xs !font-medium",
  closeButton:
    "!absolute !left-auto !right-1.5 !top-1/2 !transform-none !translate-x-0 !-translate-y-1/2 !opacity-60 hover:!opacity-100 !transition-all !duration-150 !h-5 !w-5 !bg-transparent hover:!bg-foreground/10 !border-0 !text-muted-foreground hover:!text-foreground !cursor-pointer",
} satisfies NonNullable<ToasterProps["toastOptions"]>["classNames"];

const Toaster = ({ className, toastOptions, ...props }: ToasterProps) => {
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const closeBtn = target?.closest?.('[data-sonner-toast] [data-close-button]') as HTMLElement | null;
      if (closeBtn) {
        e.preventDefault();
        closeBtn.click();
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, []);

  return (
    <Sonner
      theme="system"
      position="bottom-right"
      offset={14}
      mobileOffset={14}
      closeButton
      swipeDirections={["left", "right", "top"]}
      className={cn("toaster group z-[22000]", className)}
      richColors
      icons={{ close: <X className="pointer-events-none h-3 w-3" /> }}
      toastOptions={{
        duration: 2600,
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn(defaultToastClassNames.toast, toastOptions?.classNames?.toast),
          title: cn(defaultToastClassNames.title, toastOptions?.classNames?.title),
          description: cn(defaultToastClassNames.description, toastOptions?.classNames?.description),
          actionButton: cn(defaultToastClassNames.actionButton, toastOptions?.classNames?.actionButton),
          cancelButton: cn(defaultToastClassNames.cancelButton, toastOptions?.classNames?.cancelButton),
          closeButton: cn(defaultToastClassNames.closeButton, toastOptions?.classNames?.closeButton),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
