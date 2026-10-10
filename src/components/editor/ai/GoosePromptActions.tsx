import { ArrowUp, ChevronDown, Settings } from "@/components/ui/icons";
import type { GoosePromptSuggestionMenuProps } from "./GoosePromptSuggestionMenu";

export function GoosePromptActions({
  props,
  promptTextToUse,
}: {
  props: GoosePromptSuggestionMenuProps;
  promptTextToUse: string;
}) {
  const tags = props.tags ?? [];
  const disabled = props.disabled;
  const onManualPromptSubmit = props.onManualPromptSubmit;
  return (
    <div className="goose-ai-tags" role="group" aria-label="AI 快捷操作">
      {tags.map((tag) => (
        <button
          key={tag.key}
          type="button"
          className={`goose-ai-tag${tag.key === "accept" ? " goose-inline-ai-primary" : ""}`}
          onMouseDown={(event) => {
            // 避免 mousedown 抢走 textarea 焦点导致浮层抖动
            event.preventDefault();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            tag.onClick();
          }}
        >
          {tag.label}
        </button>
      ))}
      {props.actionMenus?.map((menu) => (
        <details
          className="goose-inline-ai-actions-menu"
          key={menu.label}
          onToggle={(event) => {
            if (!event.currentTarget.open) return;
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLDetailsElement>("details[open]")
              .forEach((other) => {
                if (other !== event.currentTarget) other.open = false;
              });
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.removeAttribute("open");
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            {menu.label}
            <ChevronDown aria-hidden className="h-3 w-3" />
          </summary>
          <div className="goose-inline-ai-actions-list">
            {menu.actions.map((action) => (
              <button
                type="button"
                key={action.key}
                onClick={(event) => {
                  event.currentTarget
                    .closest("details")
                    ?.removeAttribute("open");
                  action.onClick();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </details>
      ))}
      {props.showPlus && props.onOpenAiPanel && (
        <button
          type="button"
          className="goose-ai-tag goose-ai-tag--plus"
          aria-label="打开 AI 设置"
          title="打开 AI 设置"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onOpenAiPanel?.();
          }}
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
      {props.showSubmit && (
        <button
          type="button"
          className={`goose-inline-ai-send${tags.some((tag) => tag.key === "accept") ? "" : " goose-inline-ai-primary"}`}
          disabled={disabled || !promptTextToUse.trim()}
          aria-label="发送改写要求"
          title="发送（回车）"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (promptTextToUse.trim()) onManualPromptSubmit(promptTextToUse);
          }}
        >
          发送
          <ArrowUp aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
