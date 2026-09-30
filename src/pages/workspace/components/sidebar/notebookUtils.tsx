import { resolvePageIcon } from "@/lib/resolvePageIcon";
export const renderNotebookIcon = (iconStr: string, className?: string) => {
  const IconComp = resolvePageIcon(iconStr);
  if (IconComp) {
    return <IconComp className={cn("h-4 w-4 stroke-[1.6]", className)} />;
  }
  return (
    <span className={cn("flex items-center justify-center text-base leading-none", className)}>
      {iconStr || "📓"}
    </span>
  );
};
