import { createPortal } from "react-dom";
import { WandSparkles } from "lucide-react";
import type { LocalSkill } from "@/lib/notebook-ai/localContext";
import { useCenteredActiveItemScroll } from "@/components/editor/hooks/useCenteredActiveItemScroll";
import { cn } from "@/lib/utils";

const getSkillItemSelector = (index: number) => `[data-skill-index="${index}"]`;

export function SkillSuggestionsList(props: {
  items: LocalSkill[];
  activeIndex: number;
  listKey?: string;
  anchorRect: DOMRect;
  onSelect: (skill: LocalSkill) => void;
}) {
  const listRef = useCenteredActiveItemScroll<HTMLDivElement>({
    activeIndex: props.activeIndex,
    itemCount: props.items.length,
    listKey: props.listKey,
    itemSelector: getSkillItemSelector,
  });
  const left = Math.max(8, Math.min(props.anchorRect.left, window.innerWidth - 328));

  return createPortal(
    <div
      ref={listRef}
      className="fixed z-[9999] max-h-[280px] w-[340px] overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-lg"
      style={{ left, bottom: window.innerHeight - props.anchorRect.top + 4 }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {props.items.length === 0 ? (
        <div className="px-3 py-2.5 text-[13px] text-muted-foreground">未找到匹配 Skill</div>
      ) : props.items.map((skill, index) => (
        <button
          key={skill.path}
          type="button"
          data-skill-index={index}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left",
            index === props.activeIndex
              ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] [&_svg]:text-[var(--goose-interactive-selected-fg)]"
              : "hover:bg-[var(--goose-interactive-hover)]",
          )}
          onMouseDown={(event) => {
            event.preventDefault();
            props.onSelect(skill);
          }}
        >
          <WandSparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-col justify-center gap-1">
            <span className="block truncate text-[13px] font-medium leading-snug text-foreground">
              /{skill.name}
            </span>
            <span className="block truncate text-[11px] leading-snug text-muted-foreground">
              {skill.description}
            </span>
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
