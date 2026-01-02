import type { Page } from "@/types";
import { IconSelector } from "@/pages/workspace/components/shared/IconSelector";

interface PageTitleProps {
  page: Page;
  onUpdate: (payload: Partial<Page>) => void;
  onFocusEditorStart: () => void;
}

export function PageTitle({
  page,
  onUpdate,
  onFocusEditorStart,
}: PageTitleProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFocusTitleEnd = () => {
      inputRef.current?.focus();
      const length = inputRef.current?.value.length || 0;
      inputRef.current?.setSelectionRange(length, length);
    };

    const handleMergeToTitle = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      const mergedTitle = page.title + customEvent.detail.text;
      onUpdate({ title: mergedTitle });

      requestAnimationFrame(() => {
        inputRef.current?.focus();
        const length = mergedTitle.length;
        inputRef.current?.setSelectionRange(length, length);
      });
    };

    window.addEventListener("goose-note:focus-title-end", handleFocusTitleEnd);
    window.addEventListener("goose-note:merge-to-title", handleMergeToTitle);

    return () => {
      window.removeEventListener(
        "goose-note:focus-title-end",
        handleFocusTitleEnd,
      );
      window.removeEventListener(
        "goose-note:merge-to-title",
        handleMergeToTitle,
      );
    };
  }, [page.title, onUpdate]);

  return (
    <div
      className={cn(
        "mb-8 px-8",
        page.isFullWidth ? "max-w-full" : "max-w-3xl mx-auto",
      )}
    >
      <div className="group relative mb-4">
        <IconSelector
          value={page.icon}
          onChange={(icon) =>
            !page.trashedAt && !page.isLocked && onUpdate({ icon })
          }
        >
          <button
            className={cn(
              "flex items-center justify-center transition-opacity",
              page.icon ? "opacity-100" : "opacity-0 hover:opacity-100",
            )}
          >
            {page.icon ? (
              <div className="flex items-center justify-center h-16 w-16 text-6xl">
                {(LucideIcons as any)[page.icon] ? (
                  (() => {
                    const Icon = (LucideIcons as any)[page.icon];
                    return <Icon className="h-14 w-14" />;
                  })()
                ) : (
                  <span>{page.icon}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm text-muted-foreground hover:bg-muted px-2 py-1 rounded-md">
                <LucideIcons.Smile className="h-4 w-4" />
                <span>添加图标</span>
              </div>
            )}
          </button>
        </IconSelector>
      </div>

      <input
        ref={inputRef}
        type="text"
        placeholder="无标题"
        className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
        value={page.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        disabled={page.isLocked || !!page.trashedAt}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();

            const target = e.currentTarget;
            const cursorPos = target.selectionStart || 0;
            const beforeCursor = page.title.slice(0, cursorPos);
            const afterCursor = page.title.slice(cursorPos);

            if (afterCursor) {
              onUpdate({ title: beforeCursor });

              window.dispatchEvent(
                new CustomEvent("goose-note:insert-first-line", {
                  detail: { text: afterCursor },
                }),
              );
            } else {
              onFocusEditorStart();
            }
          }
        }}
      />
    </div>
  );
}
