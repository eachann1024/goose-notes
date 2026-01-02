export const renderNotebookIcon = (iconStr: string, className?: string) => {
  if (iconStr && !iconStr.match(/\p{Emoji}/u) && (LucideIcons as any)[iconStr]) {
    const IconComp = (LucideIcons as any)[iconStr];
    return <IconComp className={cn("h-4 w-4", className)} />;
  }
  return (
    <span className={cn("text-base leading-none", className)}>
      {iconStr || "📓"}
    </span>
  );
};
