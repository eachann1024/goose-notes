import { cn } from "@/lib/utils";
import { List, FileText } from "lucide-react";
import type { HeadingItem } from "./useHeadings";

interface OutlinePanelProps {
  headings: HeadingItem[];
  activeId: string | null;
  onHeadingClick: (blockId: string) => void;
}

export function OutlinePanel({ headings, activeId, onHeadingClick }: OutlinePanelProps) {
  if (headings.length === 0) {
    return (
      <div className="w-[200px] h-full flex flex-col border-l border-[var(--workspace-divider)] bg-[hsl(var(--goose-shell-bg))]">
        <div className="h-10 flex items-center px-3 border-b border-[var(--workspace-divider)]">
          <List className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
          <span className="text-xs font-medium text-muted-foreground">大纲</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/20 mb-2" />
          <p className="text-xs text-muted-foreground/50">暂无标题</p>
          <p className="text-[11px] text-muted-foreground/30 mt-0.5">使用 ## 或 ### 添加</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[200px] h-full flex flex-col border-l border-[var(--workspace-divider)] bg-[hsl(var(--goose-shell-bg))]">
      <div className="h-10 flex items-center px-3 border-b border-[var(--workspace-divider)] shrink-0">
        <List className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
        <span className="text-xs font-medium text-muted-foreground">大纲</span>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <nav className="space-y-0.5">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            const indent = (heading.level - 2) * 12;

            return (
              <button
                key={heading.id}
                onClick={() => onHeadingClick(heading.id)}
                className={cn(
                  "w-full text-left text-xs leading-5 rounded-md px-2 py-1 transition-colors duration-150",
                  "hover:bg-[var(--goose-interactive-hover)]",
                  isActive
                    ? "bg-[var(--goose-interactive-selected)] text-foreground font-medium"
                    : "text-muted-foreground/80",
                )}
                style={{ paddingLeft: `${8 + indent}px` }}
                title={heading.text}
              >
                <span className="block truncate">{heading.text}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
