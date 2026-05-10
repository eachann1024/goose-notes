import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";

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
    render: ({ block, contentRef }) => {
      return (
        <div
          className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-4 py-3"
          data-callout="true"
        >
          <span className="mt-0.5 select-none text-base leading-none">
            {(block.props.icon as string) || "💡"}
          </span>
          <div ref={contentRef} className="min-w-0 flex-1 text-sm leading-relaxed" />
        </div>
      );
    },
    toExternalHTML: ({ block, contentRef }) => {
      return (
        <div
          className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-4 py-3"
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
