import { useState, useCallback } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps, type BlockNoteEditor } from "@blocknote/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const EMOJI_LIST = [
  "💡", "⚠️", "❗", "✅", "❌", "🔥", "📌", "💬",
  "📝", "🎯", "🚀", "⭐", "🔔", "💎", "🎨", "🐛",
  "📦", "🔒", "🔑", "🏗️", "📊", "🔍", "⚡", "🛠️",
  "🌍", "🎉", "👍", "👎", "❓", "🤔", "👋", "💪",
];

function CalloutIconPicker({
  icon,
  onPick,
}: {
  icon: string;
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-[2px] flex h-6 w-6 shrink-0 select-none items-center justify-center rounded text-base leading-none transition-colors hover:bg-foreground/10"
          onClick={() => setOpen(true)}
          data-callout-icon-trigger
        >
          {icon || "💡"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-2"
        side="bottom"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded text-base transition-colors hover:bg-foreground/10"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
            >
              {emoji}
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
        default: "💡",
      },
    },
    content: "inline",
  },
  {
    render: ({ block, contentRef, editor }) => {
      const icon = (block.props.icon as string) || "💡";

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
          className="callout-block group flex w-full items-start gap-2.5 rounded-r-lg border-l-[3px] border-l-primary/60 bg-muted/40 px-3.5 py-2.5"
          data-callout="true"
        >
          <CalloutIconPicker icon={icon} onPick={handleIconPick} />
          <div
            ref={contentRef}
            className="min-w-0 flex-1 text-sm leading-relaxed"
          />
        </div>
      );
    },
    toExternalHTML: ({ block, contentRef }) => {
      return (
        <div
          className="flex items-start gap-2 rounded-r-md border-l-[3px] border-l-primary/60 bg-muted/40 px-4 py-3"
          data-callout="true"
        >
          <span className="mt-0.5 select-none text-base leading-none">
            {(block.props.icon as string) || "💡"}
          </span>
          <div ref={contentRef} className="min-w-0 flex-1 text-sm leading-relaxed" />
        </div>
      );
    },
  },
)();
