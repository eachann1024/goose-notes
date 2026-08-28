import { type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { WandSparkles } from "lucide-react";
import type { LocalSkill } from "@/lib/notebook-ai/localContext";
import { useCenteredActiveItemScroll } from "@/components/editor/hooks/useCenteredActiveItemScroll";
import { cn } from "@/lib/utils";
import { EDITOR_FONT_SIZE_DEFAULT, useSettings } from "@/stores/useSettings";

const POPOVER_MAX_HEIGHT = 280;
const POPOVER_EMPTY_HEIGHT = 40;
const POPOVER_WIDTH = 340;
const VIEWPORT_PADDING = 8;
const GAP = 4;
const ITEM_HEIGHT = 48;
const LIST_PADDING = 12;

const getSkillItemSelector = (index: number) => `[data-skill-index="${index}"]`;

export function SkillSuggestionsList(props: {
  items: LocalSkill[];
  activeIndex: number;
  listKey?: string;
  anchorRect: DOMRect;
  onSelect: (skill: LocalSkill) => void;
}) {
  const editorUiScale =
    useSettings((state) => state.editorFontSize) / EDITOR_FONT_SIZE_DEFAULT;
  const listRef = useCenteredActiveItemScroll<HTMLDivElement>({
    activeIndex: props.activeIndex,
    itemCount: props.items.length,
    listKey: props.listKey,
    itemSelector: getSkillItemSelector,
  });

  const estimatedHeight =
    props.items.length === 0
      ? POPOVER_EMPTY_HEIGHT
      : Math.min(
          POPOVER_MAX_HEIGHT,
          props.items.length * ITEM_HEIGHT + LIST_PADDING,
        );

  const spaceBelow =
    window.innerHeight - props.anchorRect.bottom - GAP - VIEWPORT_PADDING;
  const spaceAbove = props.anchorRect.top - GAP - VIEWPORT_PADDING;
  const canFitAbove = spaceAbove >= estimatedHeight;
  const canFitBelow = spaceBelow >= estimatedHeight;
  const placeAbove = canFitAbove
    ? true
    : !canFitBelow && spaceAbove > spaceBelow;

  const available =
    Math.max(0, placeAbove ? spaceAbove : spaceBelow) / editorUiScale;
  const maxHeight = Math.min(
    POPOVER_MAX_HEIGHT,
    Math.max(
      props.items.length === 0
        ? POPOVER_EMPTY_HEIGHT
        : ITEM_HEIGHT + LIST_PADDING,
      available,
    ),
  );

  const anchorLeft =
    Number.isFinite(props.anchorRect.left) &&
    (props.anchorRect.width > 0 || props.anchorRect.height > 0)
      ? props.anchorRect.left
      : VIEWPORT_PADDING;
  const maxLeft =
    window.innerWidth - POPOVER_WIDTH * editorUiScale - VIEWPORT_PADDING;
  const left = Math.max(VIEWPORT_PADDING, Math.min(anchorLeft, maxLeft));

  const style: CSSProperties = {
    position: "fixed",
    left,
    zIndex: 9999,
    ...(placeAbove
      ? {
          bottom:
            window.innerHeight - props.anchorRect.top + GAP * editorUiScale,
        }
      : { top: props.anchorRect.bottom + GAP * editorUiScale }),
  };

  return createPortal(
    <div
      style={style}
      className="overflow-hidden"
      onMouseDown={(event) => event.preventDefault()}
    >
      <div
        ref={listRef}
        className="goose-editor-context-ui flex w-[340px] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-lg"
        style={{ maxHeight }}
      >
        {props.items.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-muted-foreground">
            未找到本地 Skill（~/.agents/skills 或当前目录 SKILL/）
          </div>
        ) : (
          props.items.map((skill, index) => (
            <button
              key={skill.path}
              type="button"
              data-skill-index={index}
              className={cn(
                // items-start：多行描述时图标与标题首行并排，首行通过等高容器绝对居中
                "flex w-full flex-nowrap items-start gap-2 rounded-md px-2.5 py-1.5 text-left",
                index === props.activeIndex
                  ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)] [&_svg]:text-[var(--goose-interactive-selected-fg)]"
                  : "hover:bg-[var(--goose-interactive-hover)]",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                props.onSelect(skill);
              }}
            >
              <span className="flex h-[18px] w-3.5 shrink-0 items-center justify-center">
                <WandSparkles className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-start gap-0.5">
                <span className="block truncate text-[12px] font-medium leading-[18px] text-foreground">
                  {skill.name}
                </span>
                {skill.description ? (
                  <span className="line-clamp-2 text-[10.5px] leading-[14px] text-muted-foreground">
                    {skill.description}
                  </span>
                ) : null}
              </span>
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
