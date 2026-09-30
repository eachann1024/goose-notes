import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps, type BlockNoteEditor } from "@blocknote/core";
import { resolvePageIcon } from "@/lib/resolvePageIcon";
import { cn } from "@/components/editor/utils/cn";
import {
  DEFAULT_CALLOUT_ICON,
  LUCIDE_ICON_TO_EMOJI,
  normalizeCalloutIcon,
} from "./calloutIcons";

export { DEFAULT_CALLOUT_ICON, LUCIDE_ICON_TO_EMOJI, normalizeCalloutIcon };

/** 将 Lucide 名（新存）或 emoji（存量）统一渲染为 React 元素 */
function renderCalloutIcon(iconStr: string, className?: string) {
  const resolved = normalizeCalloutIcon(iconStr);
  const IconComp = resolvePageIcon(resolved);
  if (IconComp) {
    return (
      <IconComp className={cn("h-[1em] w-[1em] stroke-[1.75]", className)} />
    );
  }
  return (
    <span className={cn("text-[1em] leading-none", className)}>{resolved}</span>
  );
}

function CalloutBlockView({
  block,
  contentRef,
}: {
  block: any;
  contentRef: (node: HTMLElement | null) => void;
  editor: BlockNoteEditor<any, any, any>;
}) {
  const icon = (block.props.icon as string) || DEFAULT_CALLOUT_ICON;

  return (
    <div
      className="callout-block group flex w-full items-start gap-3 rounded-lg border border-[var(--goose-callout-border)] bg-[var(--goose-callout-bg)] px-3 py-2 text-[length:var(--editor-module-sm-font-size)] leading-[1.5]"
      data-callout="true"
    >
      <div contentEditable={false} className="callout-icon-slot shrink-0">
        {renderCalloutIcon(icon)}
      </div>
      <div
        ref={contentRef}
        className="callout-content min-w-0 flex-1"
      />
    </div>
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
    meta: { isolating: false },
    render: (props) => (
      <CalloutBlockView
        block={props.block}
        contentRef={props.contentRef}
        editor={props.editor as BlockNoteEditor<any, any, any>}
      />
    ),
    toExternalHTML: ({ block, contentRef }) => {
      return (
        <div
          className="flex items-start gap-3 rounded-lg border border-[var(--goose-callout-border)] bg-[var(--goose-callout-bg)] px-3 py-2 text-[length:var(--editor-module-sm-font-size)] leading-[1.5]"
          data-callout="true"
        >
          <span className="callout-icon-slot shrink-0">
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
