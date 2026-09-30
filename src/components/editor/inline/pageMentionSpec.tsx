import { createReactInlineContentSpec } from "@blocknote/react";
import { isPlatformPrimaryModifierEvent } from "@/lib/shortcut-platform";
import { requestOpenPageMention } from "./pageMentionBridge";
import {
  PAGE_MENTION_TYPE,
  mentionOpenPayload,
  pageMentionLabel,
  type PageMentionProps,
} from "./pageMention";

function PageMentionTag({ props }: { props: PageMentionProps }) {
  const label = pageMentionLabel(props);
  const open = mentionOpenPayload(props);
  return (
    <span
      className="goose-page-mention"
      data-page-id={open.pageId}
      data-wiki-target={open.wikiTarget}
      title={props.notebookName ? `${label} · ${props.notebookName}` : label}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        if (!open.pageId && !open.wikiTarget) return;
        const newTab = isPlatformPrimaryModifierEvent(event);
        const opened = requestOpenPageMention(
          open.pageId,
          open.wikiTarget,
          newTab ? { newTab: true } : { splitOnly: true },
        );
        if (!newTab && !opened) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {label}
    </span>
  );
}

export const pageMentionSpec = createReactInlineContentSpec(
  {
    type: PAGE_MENTION_TYPE,
    propSchema: {
      pageId: { default: "" },
      workspaceId: { default: "" },
      title: { default: "未命名" },
      notebookName: { default: "" },
      wikiTarget: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => (
      <PageMentionTag props={props.inlineContent.props as PageMentionProps} />
    ),
    toExternalHTML: (props) => (
      <span>{pageMentionLabel(props.inlineContent.props as PageMentionProps)}</span>
    ),
  },
);
