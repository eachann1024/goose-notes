import { useState, useCallback } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps, type BlockNoteEditor } from "@blocknote/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/editor/ui/popover";
import * as LucideIcons from "lucide-react";
import { cn } from "@/components/editor/utils/cn";

const ICON_LIST = [
  "Lightbulb",
  "AlertTriangle",
  "CircleAlert",
  "CircleCheck",
  "Flame",
  "Pin",
  "MessageSquare",
  "Target",
  "Rocket",
  "Star",
  "Bell",
  "Bug",
];

export const DEFAULT_CALLOUT_ICON = ICON_LIST[0];

/** Lucide 图标名 → 语义对应 emoji，供导出端使用 */
export const LUCIDE_ICON_TO_EMOJI: Record<string, string> = {
  Lightbulb: "💡",
  AlertTriangle: "⚠️",
  CircleAlert: "❗",
  CircleCheck: "✅",
  Flame: "🔥",
  Pin: "📌",
  MessageSquare: "💬",
  Target: "🎯",
  Rocket: "🚀",
  Star: "⭐",
  Bell: "🔔",
  Bug: "🐛",
};

/** 将 Lucide 名（新存）或 emoji（存量）统一渲染为 React 元素 */
function renderCalloutIcon(iconStr: string, className?: string) {
  const resolved = iconStr || DEFAULT_CALLOUT_ICON;
  if (!resolved.match(/\p{Emoji}/u) && (LucideIcons as any)[resolved]) {
    const IconComp = (LucideIcons as any)[resolved] as React.ElementType;
    return (
      <IconComp
        className={cn("h-[18px] w-[18px] stroke-[1.75]", className)}
      />
    );
  }
  return (
    <span className={cn("text-base leading-none", className)}>
      {resolved}
    </span>
  );
}

function CalloutIconPicker({
  icon,
  onPick,
}: {
  icon: string;
  onPick: (iconName: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-[1lh] w-6 shrink-0 select-none items-center justify-center rounded text-[calc(var(--editor-font-size)+1px)] leading-relaxed transition-colors hover:bg-[var(--goose-interactive-hover)]"
          onClick={() => setOpen(true)}
          data-callout-icon-trigger
        >
          {renderCalloutIcon(icon)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-2"
        side="bottom"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-6 gap-0.5">
          {ICON_LIST.map((name) => (
            <button
              key={name}
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded text-base transition-colors hover:bg-[var(--goose-interactive-hover)]"
              onClick={() => {
                onPick(name);
                setOpen(false);
              }}
            >
              {renderCalloutIcon(name)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const calloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      ...defaultProps,
      icon: {
        default: DEFAULT_CALLOUT_ICON,
      },
    },
    content: "inline",
  },
  {
    render: ({ block, contentRef, editor }) => {
      const icon = (block.props.icon as string) || DEFAULT_CALLOUT_ICON;

      const handleIconPick = useCallback(
        (emoji: string) => {
          (editor as BlockNoteEditor<any, any, any>).updateBlock(block, {
            props: { icon: emoji },
          });
        },
        [editor, block],
      );

      return (
        <div
          className="callout-block group flex w-full items-start gap-3 rounded-lg border border-[var(--goose-callout-border)] bg-[var(--goose-callout-bg)] px-3 py-2 text-[calc(var(--editor-font-size)+1px)] leading-relaxed"
          data-callout="true"
        >
          <CalloutIconPicker icon={icon} onPick={handleIconPick} />
          <div
            ref={contentRef}
            className="callout-content min-w-0 flex-1"
          />
        </div>
      );
    },
    toExternalHTML: ({ block, contentRef }) => {
      return (
        <div
          className="flex items-start gap-3 rounded-lg border border-[var(--goose-callout-border)] bg-[var(--goose-callout-bg)] px-3 py-2 text-[calc(var(--editor-font-size)+1px)] leading-relaxed"
          data-callout="true"
        >
              <span className="flex h-[1lh] w-6 shrink-0 select-none items-center justify-center text-[calc(var(--editor-font-size)+1px)] leading-relaxed">
              {renderCalloutIcon(
                (block.props.icon as string) || DEFAULT_CALLOUT_ICON,
              )}
            </span>
          <div
            ref={contentRef}
            className="callout-content min-w-0 flex-1"
          />
        </div>
      );
    },
  },
)();
