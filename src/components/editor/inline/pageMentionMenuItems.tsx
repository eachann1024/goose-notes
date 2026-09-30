import { FileText } from "lucide-react";
import type { BlockNoteEditor } from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { Fragment } from "@tiptap/pm/model";
import type { AiReferenceSuggestionItem } from "@/components/editor/ai/composer/referenceLookup";
import type { SlashMenuItem } from "@/components/editor/core/blocknoteSlashItems";
import { PAGE_MENTION_TYPE, wikiTargetFromReference } from "./pageMention";
import { mentionTriggerDeleteRange } from "@/components/editor/utils/slashMenuPolicy";

export function insertPageMentionFromMenu(
  editor: BlockNoteEditor<any, any, any>,
  item: AiReferenceSuggestionItem,
) {
  const title = item.titleSnapshot || item.title;
  const props = {
    pageId: item.pageId,
    workspaceId: item.workspaceId,
    title,
    notebookName: item.notebookNameSnapshot ?? "",
    wikiTarget: wikiTargetFromReference(item) || title,
  };

  const view = editor.prosemirrorView;
  const mentionType = view?.state.schema.nodes[PAGE_MENTION_TYPE];
  if (view && mentionType) {
    const { selection } = view.state;
    if (selection.empty) {
      const $from = selection.$from;
      const textBefore = $from.parent.textBetween(
        0,
        $from.parentOffset,
        undefined,
        "\ufffc",
      );
      const range = mentionTriggerDeleteRange(
        $from.start(),
        textBefore,
        selection.from,
      );
      if (range) {
        const mentionNode = mentionType.create(props);
        const nodes = [mentionNode];
        const space = view.state.schema.text(" ");
        if (space) nodes.push(space);
        view.dispatch(
          view.state.tr.replaceWith(range.from, range.to, Fragment.from(nodes)),
        );
        editor.getExtension(SuggestionMenu)?.closeMenu();
        return;
      }
    }
  }

  editor.insertInlineContent([
    {
      type: PAGE_MENTION_TYPE,
      props,
    },
    " ",
  ]);
  editor.getExtension(SuggestionMenu)?.closeMenu();
}

export function getPageMentionMenuItems(
  editor: BlockNoteEditor<any, any, any>,
  items: AiReferenceSuggestionItem[],
): SlashMenuItem[] {
  if (items.length === 0) {
    return [
      {
        title: "未找到匹配笔记",
        disabled: true,
        disabledReason: "换个关键词试试",
        onItemClick: () => {},
      },
    ];
  }

  return items.map((item) => ({
    title: item.title,
    description: item.description,
    icon: <FileText size={18} />,
    onItemClick: () => insertPageMentionFromMenu(editor, item),
  }));
}
